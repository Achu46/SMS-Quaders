const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Allowed MIME types whitelist
const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  'audio/mpeg',
  'audio/wav',
  'audio/mp4',
  'audio/webm',
  'audio/ogg'
]);

const MAX_GENERAL_SIZE = 5 * 1024 * 1024; // 5MB
const MAX_MEDIA_SIZE = 15 * 1024 * 1024;   // 15MB for audio/media

class StorageService {
  constructor() {
    this.uploadsDir = path.join(__dirname, '..', 'uploads');
    if (!fs.existsSync(this.uploadsDir)) {
      fs.mkdirSync(this.uploadsDir, { recursive: true });
    }
  }

  /**
   * Sanitizes a filename to prevent directory traversal and injection attacks
   */
  sanitizeFilename(name) {
    if (!name || typeof name !== 'string') return `file_${Date.now()}`;
    const base = path.basename(name).replace(/[^a-zA-Z0-9._-]/g, '_');
    return base || `file_${Date.now()}`;
  }

  /**
   * Validates file properties before storage
   */
  validateFile({ mimetype, size, originalname }) {
    if (!mimetype || !ALLOWED_MIME_TYPES.has(mimetype.toLowerCase())) {
      throw new Error(`File type "${mimetype}" is not permitted. Only images, documents, and safe audio files are allowed.`);
    }

    const isMedia = mimetype.startsWith('audio/') || mimetype.startsWith('video/');
    const limit = isMedia ? MAX_MEDIA_SIZE : MAX_GENERAL_SIZE;

    if (size > limit) {
      const limitMb = Math.round(limit / (1024 * 1024));
      throw new Error(`File size (${(size / (1024 * 1024)).toFixed(2)}MB) exceeds the ${limitMb}MB limit.`);
    }

    // Check for dangerous file extensions even if MIME type was spoofed
    const ext = path.extname(originalname || '').toLowerCase();
    const dangerousExtensions = ['.exe', '.bat', '.cmd', '.sh', '.php', '.pl', '.cgi', '.py', '.js', '.mjs', '.html', '.htm', '.svg'];
    if (dangerousExtensions.includes(ext)) {
      throw new Error(`Files with extension "${ext}" are strictly blocked for security.`);
    }
  }

  /**
   * Check if Cloudinary is configured
   */
  isCloudinaryConfigured(tenantConfig = null) {
    if (tenantConfig && tenantConfig.cloudName && tenantConfig.uploadPreset) {
      return true;
    }
    return Boolean(
      process.env.CLOUDINARY_URL || 
      (process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET)
    );
  }

  /**
   * Upload file with automatic fallback to local disk if Cloudinary is unavailable
   */
  async upload({ buffer, originalname, mimetype, schoolId, folder = 'general', tenantCloudinaryConfig = null }) {
    if (!buffer) throw new Error('No file buffer provided for upload');
    const safeSchoolId = (schoolId || 'global').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeFolder = (folder || 'general').replace(/[^a-zA-Z0-9_-]/g, '_');
    const safeName = this.sanitizeFilename(originalname);

    this.validateFile({ mimetype, size: buffer.length, originalname: safeName });

    // 1. Attempt Cloudinary upload if configured
    if (this.isCloudinaryConfigured(tenantCloudinaryConfig)) {
      try {
        const cloudResult = await this.uploadToCloudinary({ buffer, mimetype, safeName, safeSchoolId, safeFolder, tenantCloudinaryConfig });
        if (cloudResult && cloudResult.url) {
          return {
            success: true,
            provider: 'cloudinary',
            url: cloudResult.url,
            filename: safeName,
            mimetype,
            size: buffer.length
          };
        }
      } catch (cloudErr) {
        console.warn(`[STORAGE] Cloudinary upload failed. Falling back gracefully to local disk:`, cloudErr.message);
      }
    }

    // 2. Local Disk Storage Fallback
    return this.uploadToLocalDisk({ buffer, originalname: safeName, mimetype, schoolId: safeSchoolId, folder: safeFolder });
  }

  /**
   * Save file directly to local disk
   */
  async uploadToLocalDisk({ buffer, originalname, mimetype, schoolId, folder }) {
    const targetDir = path.join(this.uploadsDir, 'tenants', schoolId, folder);
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    const uniquePrefix = `${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const filename = `${uniquePrefix}_${originalname}`;
    const filePath = path.join(targetDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    const relativeUrl = `/uploads/tenants/${schoolId}/${folder}/${filename}`;

    return {
      success: true,
      provider: 'local',
      url: relativeUrl,
      filename,
      mimetype,
      size: buffer.length
    };
  }

  /**
   * Cloudinary upload implementation
   */
  async uploadToCloudinary({ buffer, mimetype, safeName, safeSchoolId, safeFolder, tenantCloudinaryConfig }) {
    const cloudName = tenantCloudinaryConfig?.cloudName || process.env.CLOUDINARY_CLOUD_NAME;
    const uploadPreset = tenantCloudinaryConfig?.uploadPreset || process.env.CLOUDINARY_UPLOAD_PRESET;

    if (!cloudName) {
      throw new Error('Cloudinary cloud name is missing');
    }

    const base64Data = `data:${mimetype};base64,${buffer.toString('base64')}`;

    if (uploadPreset) {
      // Unsigned upload via preset
      const formData = new URLSearchParams();
      formData.append('file', base64Data);
      formData.append('upload_preset', uploadPreset);
      formData.append('folder', `quaders/${safeSchoolId}/${safeFolder}`);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Cloudinary API returned an error');
      return { url: data.secure_url || data.url };
    }

    // If API key & secret exist, do signed upload
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;
    if (apiKey && apiSecret) {
      const timestamp = Math.floor(Date.now() / 1000);
      const folderPath = `quaders/${safeSchoolId}/${safeFolder}`;
      const toSign = `folder=${folderPath}&timestamp=${timestamp}${apiSecret}`;
      const signature = crypto.createHash('sha1').update(toSign).digest('hex');

      const formData = new URLSearchParams();
      formData.append('file', base64Data);
      formData.append('api_key', apiKey);
      formData.append('timestamp', timestamp.toString());
      formData.append('folder', folderPath);
      formData.append('signature', signature);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error?.message || 'Cloudinary signed upload failed');
      return { url: data.secure_url || data.url };
    }

    throw new Error('No valid Cloudinary preset or API credentials found');
  }

  /**
   * Delete a file by URL and schoolId
   */
  async delete({ fileUrl, schoolId }) {
    if (!fileUrl) return { success: false, message: 'No file URL provided' };

    // If local file: verify path belongs to schoolId
    if (fileUrl.startsWith('/uploads/')) {
      const safeSchoolId = (schoolId || '').replace(/[^a-zA-Z0-9_-]/g, '_');
      const expectedTenantPrefix = `/uploads/tenants/${safeSchoolId}/`;

      if (safeSchoolId && !fileUrl.startsWith(expectedTenantPrefix) && safeSchoolId !== 'global') {
        throw new Error('Cannot delete file belonging to another tenant');
      }

      const relativePath = fileUrl.replace(/^\/uploads\//, '');
      const fullPath = path.join(this.uploadsDir, relativePath);

      if (fs.existsSync(fullPath)) {
        await fs.promises.unlink(fullPath);
        return { success: true, message: 'Local file deleted successfully' };
      }
      return { success: true, message: 'File did not exist on disk' };
    }

    // Cloudinary or external URL: acknowledge safely without crashing
    return { success: true, message: 'External file reference unlinked' };
  }

  /**
   * Replace an old file with a new file
   */
  async replace({ oldUrl, buffer, originalname, mimetype, schoolId, folder, tenantCloudinaryConfig }) {
    if (oldUrl) {
      try {
        await this.delete({ fileUrl: oldUrl, schoolId });
      } catch (err) {
        console.warn('[STORAGE] Failed to delete old file during replace:', err.message);
      }
    }

    return this.upload({ buffer, originalname, mimetype, schoolId, folder, tenantCloudinaryConfig });
  }

  /**
   * Resolve complete URL
   */
  getUrl(filePath) {
    if (!filePath) return '';
    if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
      return filePath;
    }
    return filePath;
  }
}

const storageService = new StorageService();
module.exports = storageService;
