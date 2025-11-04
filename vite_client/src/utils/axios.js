import axios from 'axios';

// Determine base URL: use env var, or default to backend URL in production, or relative path in dev
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, use full backend URL (different domain)
  if (import.meta.env.PROD) {
    return 'https://ems-v6j5.onrender.com/api';
  }
  // In development, use relative path (vite proxy handles it)
  // This will be proxied to http://localhost:5000 by vite.config.js
  return '/api';
};

// Debug logging in development
if (import.meta.env.DEV) {
  console.log('🔧 API Base URL:', getBaseURL());
  console.log('🔧 Environment:', {
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    VITE_API_URL: import.meta.env.VITE_API_URL
  });
}

const instance = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // Essential for cookies
});

// Request interceptor to add debugging (only in development)
instance.interceptors.request.use(
  (config) => {
    // Normalize URL to avoid double /api when baseURL ends with /api
    try {
      const base = instance.defaults.baseURL || '';
      if (typeof config.url === 'string') {
        const endsWithApi = /\/api\/?$/.test(base);
        if (endsWithApi && config.url.startsWith('/api/')) {
          // Strip the leading /api from the path so base/api + /v1/...
          config.url = config.url.replace(/^\/api\//, '/');
        }
      }
    } catch (_) {}

    // Add CSRF header for state-changing requests if token cookie exists
    try {
      const method = (config.method || 'get').toLowerCase();
      if (typeof document !== 'undefined' && ['post','put','patch','delete'].includes(method)) {
        const csrfCookie = document.cookie.split('; ').find(c => c.startsWith('csrfToken='));
        const csrf = csrfCookie ? csrfCookie.split('=')[1] : undefined;
        if (csrf) {
          config.headers = config.headers || {};
          config.headers['x-csrf-token'] = csrf;
        }
      }
    } catch (_) {}

    // Only log in development, never log cookies
    if (import.meta.env.DEV) {
      console.log('Making request to:', config.url);
      // Never log cookies or sensitive headers
      const safeHeaders = { ...config.headers };
      if (safeHeaders.Authorization) {
        safeHeaders.Authorization = '[REDACTED]';
      }
      console.log('Request headers:', safeHeaders);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to handle errors
instance.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (error.code === 'ERR_NETWORK') {
      console.error('Network error: Server might not be running');
    }
    
    // Handle 401 errors
    if (error.response?.status === 401) {
      // Only redirect if not already on login page
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance;