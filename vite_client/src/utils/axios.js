import axios from 'axios';

// Determine base URL: use env var, or default to backend URL in production, or relative path in dev
const getBaseURL = () => {
  // Priority 1: Use explicit environment variable
  if (import.meta.env.VITE_API_URL) {
    const apiUrl = import.meta.env.VITE_API_URL;
    // Ensure it ends with /api for consistency
    return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
  }
  
  // Priority 2: Check if we have a backend URL without /api
  if (import.meta.env.VITE_BACKEND_URL) {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    return `${backendUrl}/api`;
  }
  
  // Priority 3: In production, require explicit environment variable
  // Check both PROD and MODE to handle Vercel deployments correctly
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  if (isProduction) {
    // In production, environment variables MUST be set
    // This prevents hardcoded URLs and makes deployments flexible
    const fallbackUrl = import.meta.env.VITE_PRODUCTION_API_URL || import.meta.env.VITE_PRODUCTION_BACKEND_URL;
    if (fallbackUrl) {
      return fallbackUrl.endsWith('/api') ? fallbackUrl : `${fallbackUrl}/api`;
    }
    // If no env var is set, log warning and use relative path (may work if same domain)
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('⚠️ VITE_API_URL or VITE_BACKEND_URL not set in production. Using relative path.');
    }
    return '/api';
  }
  
  // Priority 4: In development, use relative path (vite proxy handles it)
  // This will be proxied to http://localhost:5000 by vite.config.js
  return '/api';
};

// Helper function to get backend base URL (without /api) for static files like uploads
export const getBackendBaseURL = () => {
  // Priority 1: Use explicit backend URL
  if (import.meta.env.VITE_BACKEND_URL) {
    return import.meta.env.VITE_BACKEND_URL;
  }
  
  // Priority 2: Derive from API URL
  if (import.meta.env.VITE_API_URL) {
    // Remove /api if present
    return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
  }
  
  // Priority 3: Production - require explicit environment variable
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  if (isProduction) {
    // Use environment variable if set
    const prodUrl = import.meta.env.VITE_PRODUCTION_BACKEND_URL || import.meta.env.VITE_PRODUCTION_API_URL;
    if (prodUrl) {
      return prodUrl.replace(/\/api\/?$/, '');
    }
    // Fallback to relative path (may work if frontend and backend are on same domain)
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('⚠️ VITE_BACKEND_URL or VITE_API_URL not set in production. Using relative path.');
    }
    return ''; // Empty string means relative path
  }
  
  // Priority 4: Development default
  return 'http://localhost:5000';
};

// Helper function to convert relative upload paths to full URLs
export const getUploadUrl = (relativePath) => {
  // Handle null, undefined, or empty values
  if (!relativePath) return null;
  
  // Convert to string if it's not already (handles objects, numbers, etc.)
  let path = relativePath;
  if (typeof relativePath !== 'string') {
    // If it's an object with a url property, use that
    if (relativePath && typeof relativePath === 'object' && relativePath.url) {
      path = relativePath.url;
    } else if (relativePath && typeof relativePath === 'object' && relativePath.filename) {
      // If it has filename, construct path
      path = `/uploads/${relativePath.filename}`;
    } else {
      // Try to convert to string
      path = String(relativePath);
    }
  }
  
  // Ensure it's a string at this point
  if (typeof path !== 'string' || !path) {
    return null;
  }
  
  // If already a full URL, return as is
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  
  // If it's a relative path starting with /uploads, prepend backend URL
  if (path.startsWith('/uploads')) {
    return `${getBackendBaseURL()}${path}`;
  }
  
  // If it's just a filename or path without leading slash, add /uploads
  if (path.startsWith('uploads')) {
    return `${getBackendBaseURL()}/${path}`;
  }
  
  // Default: assume it's a relative path
  return `${getBackendBaseURL()}/uploads/${path}`;
};

// Debug logging (development only - removed from production for security)
// Check multiple conditions to ensure we're truly in development
// In production builds, PROD should be true, DEV should be false, and MODE should be 'production'
const isDevelopment = import.meta.env.MODE === 'development' || (import.meta.env.DEV && !import.meta.env.PROD);
// Removed console.log statements for production

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
        
        // Check if this is an auth endpoint (login/register) - tokens are expected to be missing
        const isAuthEndpoint = config.url && (
          config.url.includes('/auth/login') || 
          config.url.includes('/auth/register') ||
          config.url.includes('/password/forgot-password') ||
          config.url.includes('/password/reset-password')
        );
        
        if (token) {
          config.headers = config.headers || {};
          // Only add if not already set (allows manual override if needed)
          if (!config.headers.Authorization) {
            config.headers.Authorization = `Bearer ${token}`;
          }
        } else {
          // Removed console.warn for production
        }
      }
    } catch (error) {
      // Silently handle error
    }

    // Add CSRF header for state-changing requests
    // Check both cookie (for same-site) and localStorage (for cross-site)
    try {
      const method = (config.method || 'get').toLowerCase();
      if (typeof document !== 'undefined' && ['post','put','patch','delete'].includes(method)) {
        // Check if this is an auth endpoint that doesn't require CSRF (login/register/password reset)
        const isAuthEndpoint = config.url && (
          config.url.includes('/auth/login') || 
          config.url.includes('/auth/register') ||
          config.url.includes('/password/forgot-password') ||
          config.url.includes('/password/reset-password')
        );
        
        // CSRF tokens are not required for login/register/password reset endpoints
        // These are allowlisted in the backend CSRF middleware
        if (!isAuthEndpoint) {
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
            // Removed console.warn for production
          }
        }
      }
    } catch (error) {
      // Silently handle error
    }

    // Removed console.log statements for production
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
    // Removed console.error statements for production
    // Network and CORS errors are handled silently
    
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
        // Removed console.error for production
        // Don't auto-redirect for 403, let user see the error message
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance;