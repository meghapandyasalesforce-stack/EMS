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
    // Works with both relative paths and full URLs
    try {
      if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        if (token) {
          config.headers = config.headers || {};
          // Only add if not already set (allows manual override if needed)
          if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } else {
          // Debug: Log when token is missing
          if (import.meta.env.DEV || import.meta.env.PROD) {
            console.warn('⚠️ No token found in localStorage for request:', config.url);
          }
        }
      }
    } catch (error) {
      console.error('Error adding Authorization header:', error);
    }

    // Add CSRF header for state-changing requests
    // Check both cookie (for same-site) and localStorage (for cross-site)
    try {
      const method = (config.method || 'get').toLowerCase();
      if (typeof document !== 'undefined' && ['post','put','patch','delete'].includes(method)) {
        // First try to get from cookie (same-site)
        let csrf = undefined;
        try {
          const csrfCookie = document.cookie.split('; ').find(c => c.startsWith('csrfToken='));
          csrf = csrfCookie ? csrfCookie.split('=')[1] : undefined;
        } catch {
          // Cookie parsing failed
        }
        
        // If not in cookie, try localStorage (cross-site scenario)
        if (!csrf && typeof window !== 'undefined') {
          try {
            csrf = localStorage.getItem('csrfToken');
          } catch {
            // localStorage access failed
          }
        }
        
        if (csrf) {
          config.headers = config.headers || {};
          config.headers['x-csrf-token'] = csrf;
        } else {
          // Debug: Log when CSRF token is missing for state-changing requests
          if (import.meta.env.DEV || import.meta.env.PROD) {
            console.warn('⚠️ CSRF token not found in cookies or localStorage for', method.toUpperCase(), 'request to:', config.url);
          }
        }
      }
    } catch (error) {
      console.error('Error adding CSRF token:', error);
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
    
    // Handle 403 errors - log helpful message
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'Access forbidden';
      if (message.includes('admin') || message.includes('Access restricted')) {
        console.error('⚠️ 403 Forbidden: Admin role required. Please log out and log back in as admin.');
        // Don't auto-redirect for 403, let user see the error message
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance;