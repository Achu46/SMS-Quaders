const express = require('express');
const router = express.Router({ mergeParams: true });
const multer = require('multer');
const { authenticateToken, requireTenantAccess } = require('../middleware');
const storageService = require('../services/storageService');

// Use multer memory storage to inspect buffer and delegate to storageService
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 } // 15MB cap
});

// POST /api/upload (or /api/schools/:schoolId/upload)
router.post('/', authenticateToken, requireTenantAccess, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file provided in request' });
    }

    const schoolId = req.schoolId;
    const folder = req.body.folder || req.body.moduleName || 'general';

    const result = await storageService.upload({
      buffer: req.file.buffer,
      originalname: req.file.originalname,
      mimetype: req.file.mimetype,
      schoolId,
      folder
    });

    res.status(201).json(result);
  } catch (error) {
    console.error('Upload route error:', error);
    res.status(400).json({ error: error.message || 'File upload failed' });
  }
});

// DELETE /api/upload
router.delete('/', authenticateToken, requireTenantAccess, async (req, res) => {
  try {
    const { fileUrl } = req.body;
    const schoolId = req.schoolId;

    if (!fileUrl) {
      return res.status(400).json({ error: 'fileUrl is required' });
    }

    const result = await storageService.delete({ fileUrl, schoolId });
    res.json(result);
  } catch (error) {
    console.error('Delete file error:', error);
    res.status(403).json({ error: error.message || 'Failed to delete file' });
  }
});

module.exports = router;
