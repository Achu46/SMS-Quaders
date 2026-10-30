import { api } from './api';

// Register a new School (and admin)
export const registerSchool = async (schoolData) => {
  const data = await api.post('/auth/register-school', schoolData);
  if (data.token) {
    api.setToken(data.token);
  }
  return data;
};

// General User Registration
export const registerUser = async (email, password, role, additionalData = {}) => {
  const data = await api.post('/auth/register', {
    email,
    password,
    role: role?.toUpperCase() || 'PARENT',
    ...additionalData
  });
  if (data.token) {
    api.setToken(data.token);
  }
  return data.user || data;
};

// Universal Login
export const loginUser = async (email, password) => {
  const data = await api.post('/auth/login', { email, password });
  if (data.token) {
    api.setToken(data.token);
  }
  return data.user;
};

// Parent Login with Admission Number
export const loginWithAdmissionNumber = async (admissionNo, password, schoolId) => {
  const data = await api.post('/auth/login-admission', { admissionNo, password, schoolId });
  if (data.token) {
    api.setToken(data.token);
  }
  return data.user;
};

// Logout
export const logoutUser = async () => {
  api.setToken(null);
};

// Get Current User Profile (Fresh from DB via /auth/me)
export const getUserProfile = async () => {
  try {
    const token = api.getToken();
    if (!token) return null;
    try {
      return await api.get('/auth/me');
    } catch (e) {
      return await api.get('/auth/profile');
    }
  } catch (error) {
    return null;
  }
};

// Request Password Reset
export const resetPassword = async (email) => {
  return await api.post('/auth/forgot-password', { email });
};

export const getToken = () => api.getToken();
export const setToken = (token) => api.setToken(token);
