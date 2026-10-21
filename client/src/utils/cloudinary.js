const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

/**
 * Uploads a file via the backend StorageService abstraction.
 * Automatically handles Cloudinary or local disk fallback, validation, and tenant scoping.
 * @param {File} file - The file to upload
 * @param {string} schoolId - Tenant schoolId
 * @param {string} [folderOrPath] - Folder or module path for the file
 * @returns {Promise<string>} The URL of the uploaded file
 */
export const uploadFileToCloudinaryOrFirebase = async (file, schoolId, folderOrPath) => {
  if (!file) throw new Error("No file provided for upload");

  const formData = new FormData();
  formData.append("file", file);
  if (folderOrPath) {
    const folder = typeof folderOrPath === 'string' ? folderOrPath.split('/')[0] : 'general';
    formData.append("folder", folder);
  }

  const token = localStorage.getItem('token');
  const endpoint = schoolId ? `${API_BASE_URL}/schools/${schoolId}/upload` : `${API_BASE_URL}/upload`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: formData
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.error || 'File upload failed');
  }

  // If relative url from local storage, prefix with backend origin
  if (data.url && data.url.startsWith('/uploads/')) {
    const origin = API_BASE_URL.replace(/\/api\/?$/, '');
    return `${origin}${data.url}`;
  }

  return data.url;
};

export const uploadCustomDataFiles = async (customData, schoolId, moduleName) => {
  if (!customData || typeof customData !== 'object') return customData;
  const newData = { ...customData };
  const uploadPromises = Object.entries(newData).map(async ([key, value]) => {
    if (value instanceof File) {
      const folder = moduleName ? moduleName.replace(/[^a-z0-9]/gi, '_').trim() : 'custom';
      const url = await uploadFileToCloudinaryOrFirebase(value, schoolId, folder);
      return { key, url };
    }
    return null;
  });

  const results = await Promise.all(uploadPromises);
  results.forEach(res => {
    if (res) {
      newData[res.key] = res.url;
    }
  });

  return newData;
};
