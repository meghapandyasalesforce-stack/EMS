import axios from 'axios';

// Determine base URL: use env var, or default to backend URL in production, or relative path in dev
const getBaseURL = () => {
  // Priority 1: In development mode, always use relative path (Vite proxy)
  // This ensures local development uses localhost:5000 via Vite proxy
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  if (isDevelopment) {
    // In development, always use relative path which Vite proxies to localhost:5000
    // This allows local backend development without CORS issues
    return '/api';
  }
  
  // Priority 2: In production, use explicit environment variable
  // Check both PROD and MODE to handle Vercel deployments correctly
  const isProduction = import.meta.env.PROD || import.meta.env.MODE === 'production';
  if (isProduction) {
    // Priority 2a: Use explicit API URL
    if (import.meta.env.VITE_API_URL) {
      const apiUrl = import.meta.env.VITE_API_URL;
      // Ensure it ends with /api for consistency
      return apiUrl.endsWith('/api') ? apiUrl : `${apiUrl}/api`;
    }
    
    // Priority 2b: Use backend URL and append /api
    if (import.meta.env.VITE_BACKEND_URL) {
      const backendUrl = import.meta.env.VITE_BACKEND_URL;
      return `${backendUrl}/api`;
    }
    
    // Priority 2c: Try production-specific env vars
    const fallbackUrl = import.meta.env.VITE_PRODUCTION_API_URL || import.meta.env.VITE_PRODUCTION_BACKEND_URL;
    if (fallbackUrl) {
      return fallbackUrl.endsWith('/api') ? fallbackUrl : `${fallbackUrl}/api`;
    }
    
    // Priority 2d: Fallback to relative path (may work if same domain)
    if (typeof console !== 'undefined' && console.warn) {
      console.warn('⚠️ VITE_API_URL or VITE_BACKEND_URL not set in production. Using relative path.');
    }
    return '/api';
  }
  
  // Fallback: use relative path
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

// Track if we're currently refreshing to avoid multiple refresh attempts
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach(prom => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token);
    }
  });
  
  failedQueue = [];
};

// Response interceptor to handle errors and token refresh
instance.interceptors.response.use(
  (response) => {
    // Store refresh token if present in response
    if (response.data?.refreshToken && typeof window !== 'undefined') {
      try {
        localStorage.setItem('refreshToken', response.data.refreshToken);
      } catch (e) {
        // Silently handle localStorage errors
      }
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle 401 errors - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      // Don't attempt refresh for auth endpoints (login, register, password reset)
      const isAuthEndpoint = originalRequest.url && (
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/refresh-token') ||
        originalRequest.url.includes('/password/forgot-password') ||
        originalRequest.url.includes('/password/reset-password')
      );

      if (isAuthEndpoint) {
        // For auth endpoints, redirect to login
        if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
          window.location.href = '/login';
        }
        return Promise.reject(error);
      }

      // If we're already refreshing, queue this request
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then(token => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return instance(originalRequest);
          })
          .catch(err => {
            return Promise.reject(err);
          });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Get refresh token from localStorage or cookie
        let refreshToken = null;
        if (typeof window !== 'undefined') {
          refreshToken = localStorage.getItem('refreshToken');
        }

        // If no refresh token in localStorage, try to get from cookie
        // (cookies are automatically sent with withCredentials: true)
        if (!refreshToken) {
          // Check if we have a refresh token cookie
          const cookies = document.cookie.split('; ');
          const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
          if (refreshCookie) {
            refreshToken = refreshCookie.split('=')[1];
          }
        }

        if (!refreshToken) {
          // No refresh token available, redirect to login
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            // Clear any stored tokens
            if (typeof window !== 'undefined') {
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('csrfToken');
            }
            window.location.href = '/login';
          }
          processQueue(error, null);
          isRefreshing = false;
          return Promise.reject(error);
        }

        // Determine which refresh endpoint to use based on role
        const role = localStorage.getItem('role') || 'employee';
        const refreshEndpoint = role === 'admin' 
          ? '/v1/admin/auth/refresh-token'
          : '/v1/employee/auth/refresh-token';

        // Call refresh token endpoint using the same base URL as the instance
        const refreshResponse = await axios.post(
          `${instance.defaults.baseURL}${refreshEndpoint}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${refreshToken}`,
            },
            withCredentials: true,
          }
        );

        const { token: newToken, csrfToken: newCsrfToken } = refreshResponse.data;

        // Update stored tokens
        if (typeof window !== 'undefined') {
          if (newToken) {
            localStorage.setItem('token', newToken);
          }
          if (newCsrfToken) {
            localStorage.setItem('csrfToken', newCsrfToken);
          }
          if (refreshResponse.data.refreshToken) {
            localStorage.setItem('refreshToken', refreshResponse.data.refreshToken);
          }
        }

        // Update the original request with new token
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        if (newCsrfToken && ['post', 'put', 'patch', 'delete'].includes(originalRequest.method?.toLowerCase())) {
          originalRequest.headers['x-csrf-token'] = newCsrfToken;
        }

        // Process queued requests
        processQueue(null, newToken);
        isRefreshing = false;

        // Retry the original request
        return instance(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        processQueue(refreshError, null);
        isRefreshing = false;

        if (typeof window !== 'undefined') {
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('csrfToken');
          
          if (window.location.pathname !== '/login' && window.location.pathname !== '/') {
            window.location.href = '/login';
          }
        }

        return Promise.reject(refreshError);
      }
    }
    
    // Handle 403 errors - log helpful message
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'Access forbidden';
      if (message.includes('admin') || message.includes('Access restricted')) {
        // Don't auto-redirect for 403, let user see the error message
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance;