const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

// Helper to store token
export const setToken = (token) => {
  if (token) {
    localStorage.setItem('token', token);
  } else {
    localStorage.removeItem('token');
  }
};

// Helper to get token
export const getToken = () => localStorage.getItem('token');

// Register User
export const registerUser = async (email, password, role, additionalData = {}) => {
  try {
    // We assume the frontend passes the required fields including schoolId
    const response = await fetch(`${API_URL}/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email,
        password,
        role: role?.toUpperCase() || 'PARENT',
        ...additionalData
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to register');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Error registering user:", error);
    throw error;
  }
};

// Login User with Email
export const loginUser = async (email, password) => {
  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email, password })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Failed to login');
    }

    const data = await response.json();
    setToken(data.token);
    return data.user;
  } catch (error) {
    console.error("Error logging in:", error);
    throw error;
  }
};

// Login Parent with Admission Number (Synthetic Email pattern maintained for backwards compat)
export const loginWithAdmissionNumber = async (admissionNumber, password) => {
  try {
    const syntheticEmail = `${admissionNumber.replace(/[^a-zA-Z0-9]/g, '')}@parent.School.com`.toLowerCase();
    return await loginUser(syntheticEmail, password);
  } catch (error) {
    console.error("Error logging in with admission number:", error);
    throw error;
  }
};

// Logout User
export const logoutUser = async () => {
  try {
    setToken(null);
  } catch (error) {
    console.error("Error logging out:", error);
    throw error;
  }
};

// Reset Password
export const resetPassword = async (email) => {
  try {
    // To be implemented on backend
    console.warn("Password reset via API not fully implemented yet");
  } catch (error) {
    console.error("Error resetting password:", error);
    throw error;
  }
};

// Get User Profile
export const getUserProfile = async (uid) => {
  try {
    const token = getToken();
    if (!token) return null;

    const response = await fetch(`${API_URL}/auth/profile`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        setToken(null);
      }
      return null;
    }

    const user = await response.json();
    
    // Normalize role string format to maintain compatibility with existing frontend
    if (user.role) {
      user.role = user.role.toLowerCase();
    }
    
    return user;
  } catch (error) {
    console.error("Error getting user profile:", error);
    throw error;
  }
};
