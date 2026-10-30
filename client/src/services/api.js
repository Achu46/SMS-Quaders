const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

class ApiClient {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }

  getToken() {
    return localStorage.getItem('token');
  }

  setToken(token) {
    if (token) {
      localStorage.setItem('token', token);
    } else {
      localStorage.removeItem('token');
    }
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const token = this.getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
      ...(options.headers || {})
    };

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(url, config);

      // Check for X-Permissions-Changed header or 403 response
      const permChangedHeader = response.headers.get('X-Permissions-Changed');
      if (permChangedHeader === 'true' || response.status === 403) {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('quaders:permissions_changed'));
        }
      }

      if (response.status === 401) {
        // Unauthorized token expired
        this.setToken(null);
        const path = window.location.pathname;
        const isPublicPath = path === '/' || 
          path === '/login' || 
          path === '/forgot-password' || 
          path.startsWith('/register') || 
          path.startsWith('/school-registration') ||
          path.startsWith('/signup') ||
          path.startsWith('/sign-up') ||
          path.startsWith('/admission') || 
          path.startsWith('/apply') || 
          path.startsWith('/leads') ||
          path.startsWith('/staff/register');

        if (!isPublicPath) {
          window.location.href = '/login';
        }
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      return data;
    } catch (error) {
      console.error(`API Request failed on ${endpoint}:`, error);
      throw error;
    }
  }

  get(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'GET' });
  }

  post(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      body: JSON.stringify(body)
    });
  }

  put(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      body: JSON.stringify(body)
    });
  }

  patch(endpoint, body, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PATCH',
      body: JSON.stringify(body)
    });
  }

  delete(endpoint, options = {}) {
    return this.request(endpoint, { ...options, method: 'DELETE' });
  }
}

export const api = new ApiClient(API_BASE_URL);
export default api;
