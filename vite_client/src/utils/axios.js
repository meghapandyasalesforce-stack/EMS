import axios from 'axios';

// Determine base URL: use env var, or default to backend URL in production, or relative path in dev
const getBaseURL = () => {
  if (import.meta.env.VITE_API_URL) {
    return import.meta.env.VITE_API_URL;
  }
  // In production, use full backend URL (different domain)
  // Check both PROD and MODE to handle Vercel deployments correctly
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  if (isProduction) {
    return 'https://ems-te2n.onrender.com/api';
  }
  // In development, use relative path (vite proxy handles it)
  // This will be proxied to http://localhost:5000 by vite.config.js
  return '/api';
};

// Debug logging (both dev and prod for troubleshooting)
if (import.meta.env.DEV || import.meta.env.PROD) {
  console.log('🔧 API Base URL:', getBaseURL());
  console.log('🔧 Environment:', {
    MODE: import.meta.env.MODE,
    DEV: import.meta.env.DEV,
    PROD: import.meta.env.PROD,
    VITE_API_URL: import.meta.env.VITE_API_URL,
    VITE_API_BASE_URL: import.meta.env.VITE_API_BASE_URL
  });
}

const instance = axios.create({
  baseURL: getBaseURL(),
  withCredentials: true, // Essential for cookies
});

// Request interceptor to add Authorization header and CSRF token
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
    } catch {
      // ignore
    }

    // Add Authorization header from localStorage if available
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token && !config.headers.Authorization) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      // intentionally ignored
    }

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
    } catch {
      // intentionally ignored
    }

    // Log request details (both dev and prod for troubleshooting)
    if (import.meta.env.DEV || import.meta.env.PROD) {
      const fullUrl = config.baseURL && config.url ? `${config.baseURL}${config.url}` : config.url;
      console.log('Making request to:', fullUrl);
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
      console.error('Network error: Server might not be running or CORS issue');
      console.error('Request URL:', error.config?.url);
      console.error('Base URL:', error.config?.baseURL);
      console.error('Full URL:', error.config?.baseURL && error.config?.url ? `${error.config.baseURL}${error.config.url}` : 'Unknown');
    }
    
    // Handle CORS errors
    if (error.message && error.message.includes('CORS')) {
      console.error('CORS error: Check backend CORS configuration');
      console.error('Frontend origin:', window.location.origin);
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