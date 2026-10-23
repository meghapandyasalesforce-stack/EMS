import axios from 'axios';
import logger from './logger.js';
import { isPublicGuestRoute, isPlatformRoute } from './authSessionUtils.js';

/**
 * Clear persisted auth and UI state before redirecting to login on 401.
 * Prevents login↔dashboard loop when user was deleted or session expired but Redux still had stale user.
 */
function clearAuthAndRedirectToLogin() {
  if (typeof window === 'undefined') return;

  const path = window.location.pathname || '';
  const isPlatform = path.startsWith('/platform');
  const loginPath = isPlatform ? '/platform/login' : '/login';
  const alreadyOnAuthScreen =
    path === loginPath ||
    path.startsWith('/login') ||
    path.startsWith('/platform/login') ||
    path.startsWith('/platform/forgot-password') ||
    path.startsWith('/platform/reset-password') ||
    path.startsWith('/forgot-password') ||
    path.startsWith('/reset-password') ||
    path.startsWith('/register') ||
    path.startsWith('/organization/login') ||
    path.startsWith('/organization/register');

  try {
    localStorage.removeItem('persist:root');
    localStorage.removeItem('csrfToken');
    localStorage.removeItem('role');
    localStorage.removeItem('email');
    localStorage.removeItem('organizationId');
    localStorage.removeItem('userId');
    localStorage.removeItem('isOrganizationLogin');
    localStorage.removeItem('activePortal');
    // role / refreshTokenPresent are readable cookies — clear so platform sessions
    // cannot retrigger PLATFORM_SESSION_DEAD → /login forever.
    const expire = 'Max-Age=0; path=/';
    document.cookie = `role=; ${expire}`;
    document.cookie = `refreshTokenPresent=; ${expire}`;
    document.cookie = `csrfToken=; ${expire}`;
  } catch (e) {
    logger.warn('clearAuthAndRedirectToLogin', e?.message);
  }

  // Already on login: clearing storage is enough. Re-assigning href causes a reload loop.
  if (alreadyOnAuthScreen) return;

  window.location.href = loginPath;
}

/** Session probe calls — reject quietly; never refresh tokens or redirect to login.
 * Keep permissions-only: get-my-details must be allowed to refresh on 401/NO_TOKEN
 * so dashboards don't hard-fail when the short-lived jwt cookie expired. */
function isSessionProbeRequest(url = '') {
  return url.includes('/auth/permissions');
}

/** Soft auth failures during bootstrap — never hard-redirect the whole app. */
function isBootstrapAuthRequest(url = '') {
  return (
    url.includes('/auth/permissions') ||
    url.includes('/profile-details/get-my-details')
  );
}

function maybeRedirectToLoginOn401(errorCode) {
  // Logout only via explicit Logout button — never on generic 401 or refresh failure.
  // PASSWORD_CHANGED and hard platform refresh failures clear session and redirect.
  if (errorCode === 'PASSWORD_CHANGED' || errorCode === 'PLATFORM_SESSION_DEAD') {
    clearAuthAndRedirectToLogin();
  }
}

// Determine base URL: use env var, or default to backend URL in production, or relative path in dev
const getBaseURL = () => {
  // Priority 1: In development mode, always use relative path (Vite proxy)
  // This ensures local development uses localhost:10000 via Vite proxy
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  if (isDevelopment) {
    // In development, always use relative path which Vite proxies to localhost:10000
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
    logger.warn('VITE_API_URL or VITE_BACKEND_URL not set in production. Using relative path.');
    return '/api';
  }
  
  // Fallback: use relative path
  return '/api';
};

// Helper function to get backend base URL (without /api) for static files like uploads
export const getBackendBaseURL = () => {
  // Development: use same-origin so /uploads hits Vite proxy
  const isDevelopment = import.meta.env.DEV || import.meta.env.MODE === 'development';
  if (isDevelopment) {
    return '';
  }

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
    const prodUrl = import.meta.env.VITE_PRODUCTION_BACKEND_URL || import.meta.env.VITE_PRODUCTION_API_URL;
    if (prodUrl) {
      return prodUrl.replace(/\/api\/?$/, '');
    }
    if (import.meta.env.VITE_API_URL) {
      return import.meta.env.VITE_API_URL.replace(/\/api\/?$/, '');
    }
    // Same-origin production (nginx proxies /uploads and /api)
    if (typeof window !== 'undefined' && window.location?.origin) {
      return window.location.origin;
    }
    return '';
  }
  
  // Priority 4: Development default (matches backend default port)
  return 'http://localhost:10000';
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
      const fn = relativePath.filename;
      path = fn.includes('profile-') || fn.startsWith('profile-')
        ? `/uploads/profile-photos/${fn}`
        : `/uploads/${fn}`;
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

  if (path.startsWith('/uploads')) {
    const base = getBackendBaseURL();
    if (base) {
      return `${base}${path}`;
    }
    if (typeof window !== 'undefined' && window.location?.origin) {
      return `${window.location.origin}${path}`;
    }
    return path;
  }

  // If it's just a filename or path without leading slash, add /uploads
  if (path.startsWith('uploads')) {
    return `${getBackendBaseURL()}/${path}`;
  }

  // Default: assume it's a relative path
  return `${getBackendBaseURL()}/uploads/${path}`;
};

// Safe wrapper that normalizes file input before calling getUploadUrl
export const normalizeUploadInput = (file) => {
  if (!file) return '';

  if (typeof file === 'string') {
    return file;
  }

  if (typeof file === 'object') {
    return (
      file.url ||
      file.path ||
      file.filename ||
      file.fileName ||
      file.secure_url ||
      ''
    );
  }

  return '';
};

export const getSafeUploadUrl = (file) => {
  const normalized = normalizeUploadInput(file);
  return normalized ? getUploadUrl(normalized) : '';
};

/** Resolve profile photo to a full URL (localhost proxy + production backend). */
export const getProfilePhotoUrl = (profilePhoto) => {
  if (!profilePhoto) return null;

  const withVersion = (base) => {
    if (!base) return null;
    const uploadedAt = typeof profilePhoto === 'object' ? profilePhoto.uploadedAt : null;
    const version = uploadedAt ? new Date(uploadedAt).getTime() : null;
    return version ? `${base}${base.includes('?') ? '&' : '?'}v=${version}` : base;
  };

  if (typeof profilePhoto === 'string') {
    const path = profilePhoto.startsWith('/') ? profilePhoto : `/uploads/profile-photos/${profilePhoto}`;
    return withVersion(getUploadUrl(path));
  }

  if (profilePhoto.url) {
    return withVersion(getUploadUrl(profilePhoto.url));
  }

  if (profilePhoto.filename) {
    return withVersion(getUploadUrl(`/uploads/profile-photos/${profilePhoto.filename}`));
  }

  return withVersion(getUploadUrl(profilePhoto));
};

// Short-lived signed URLs for profile photos, cached until they expire (15 min).
// Profiles are private S3 objects; a fresh signed URL is fetched only when a photo is displayed.
let _profilePhotoCache = {};

/** True only for short-lived S3 pre-signed URLs (safe to display as-is). */
function isPresignedS3Url(url) {
  return (
    typeof url === 'string' &&
    /^https?:\/\//i.test(url) &&
    /[?&]X-Amz-Signature=/i.test(url)
  );
}

/**
 * Resolve a displayable, short-lived signed URL for a private profile photo.
 * Fetches via the authorization-aware GET /v1/both/profile-photo/:userType/:userId
 * endpoint and caches the result for 15 minutes.
 *
 * Stored https://…amazonaws.com/… object URLs are NOT reused — the bucket is
 * private, so only freshly signed URLs (or cached ones) are returned.
 *
 * Local /uploads paths and already-signed URLs are returned immediately.
 */
export async function resolveProfileSignedUrl(profilePhoto, { userType, userId, preferFull = false } = {}) {
  const photo = profilePhoto && typeof profilePhoto === 'object'
    ? profilePhoto
    : profilePhoto
      ? { url: profilePhoto }
      : null;

  // Prefer an already-signed URL handed back by the server
  const preSigned =
    (isPresignedS3Url(photo?.signedUrl) && photo.signedUrl) ||
    (isPresignedS3Url(photo?.url) && photo.url) ||
    (isPresignedS3Url(photo?.thumbnailUrl) && photo.thumbnailUrl) ||
    null;
  if (preSigned) return preSigned;

  // S3-backed photos (private) — never treat `filename` alone as a local disk path.
  // New uploads store url/s3Key as the object key plus a filename; local /uploads
  // must only be used when the stored url is actually under /uploads/.
  const hasS3Ref = Boolean(
    photo?.s3Key ||
      photo?.thumbS3Key ||
      (typeof photo?.url === 'string' &&
        photo.url &&
        !photo.url.startsWith('/') &&
        photo.url !== '__fetch__' &&
        !/^https?:\/\//i.test(photo.url)) ||
      (typeof photo?.url === 'string' && /amazonaws\.com\//i.test(photo.url))
  );

  if (!hasS3Ref) {
    const localPath =
      (typeof photo?.url === 'string' && photo.url.startsWith('/uploads/') && photo.url) ||
      (typeof photo === 'string' && photo.startsWith('/uploads/') && photo) ||
      (photo?.filename && !photo?.url
        ? `/uploads/profile-photos/${photo.filename}`
        : null);
    if (localPath) {
      return getProfilePhotoUrl(photo?.url?.startsWith('/uploads/') ? photo : localPath);
    }
  }

  if (!userId || !userType) return null;

  const cacheId = `${userType}:${userId}:${preferFull ? 'full' : 'thumb'}`;
  const now = Date.now();
  const cached = _profilePhotoCache[cacheId];
  if (cached && cached.expiresAt > now) return cached.url;

  try {
    const { data } = await instance.get(`/v1/both/profile-photo/${userType}/${userId}`);
    const url = preferFull
      ? data?.profilePhoto?.url || data?.profilePhoto?.thumbnailUrl
      : data?.profilePhoto?.thumbnailUrl || data?.profilePhoto?.url || null;
    if (url) {
      const displayUrl = url.startsWith('/uploads/') ? getProfilePhotoUrl(url) : url;
      _profilePhotoCache = {
        ..._profilePhotoCache,
        [cacheId]: { url: displayUrl, expiresAt: now + 15 * 60 * 1000 },
      };
      return displayUrl;
    }
    return null;
  } catch {
    // No photo found / unauthorized — caller falls back to initials.
    return null;
  }
}

/** Drop cached signed URLs for a user (call after upload/delete). */
export function invalidateProfilePhotoCache(userType, userId) {
  if (!userType || !userId) {
    _profilePhotoCache = {};
    return;
  }
  const prefix = `${userType}:${userId}:`;
  _profilePhotoCache = Object.fromEntries(
    Object.entries(_profilePhotoCache).filter(([key]) => !key.startsWith(prefix))
  );
}

/** Employee-specific download (legacy embedded docs + job uploads). */
export const getEmployeeDocumentDownloadUrl = (employeeId, documentId, { inline = false } = {}) => {
  if (!employeeId || !documentId) return null;
  const base = (getBaseURL() || '/api').replace(/\/$/, '');
  const params = new URLSearchParams();
  if (inline) params.set('inline', '1');
  const qs = params.toString();
  return `${base}/v1/both/document/${employeeId}/documents/${documentId}/download${qs ? `?${qs}` : ''}`;
};

/** Authenticated document download URL (use instead of raw /uploads links in production). */
export const getDocumentDownloadUrl = (documentId, { scope = 'both', version } = {}) => {
  if (!documentId) return null;
  const base = (getBaseURL() || '/api').replace(/\/$/, '');
  const segment = scope === 'admin' ? 'admin' : 'both';
  const params = new URLSearchParams();
  if (version != null) params.set('version', String(version));
  const qs = params.toString();
  return `${base}/v1/${segment}/documents/${documentId}/download${qs ? `?${qs}` : ''}`;
};

/** Authenticated inline preview URL — opens in browser (PDF/images). */
export const getDocumentPreviewUrl = (documentId, { scope = 'both', version } = {}) => {
  if (!documentId) return null;
  const base = (getBaseURL() || '/api').replace(/\/$/, '');
  const segment = scope === 'admin' ? 'admin' : 'both';
  const params = new URLSearchParams({ inline: '1' });
  if (version != null) params.set('version', String(version));
  return `${base}/v1/${segment}/documents/${documentId}/download?${params.toString()}`;
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

    // SECURITY FIX: Tokens are stored in httpOnly cookies by the server
    // HttpOnly cookies are sent automatically with requests when withCredentials: true
    // The server's extractToken() function checks cookies first, then Authorization header
    // We ensure withCredentials is true for all requests to send cookies automatically
    config.withCredentials = true;
    
    // Try to get token from cookie (if non-httpOnly cookie exists) for Authorization header
    // This is a fallback - httpOnly cookies are sent automatically but can't be read by JS
    try {
      if (typeof document !== 'undefined') {
        // Check if this is an auth endpoint (login/register) - tokens are expected to be missing
        const isAuthEndpoint = config.url && (
          config.url.includes('/auth/login') ||
          config.url.includes('/auth/register') ||
          config.url.includes('/auth/refresh-token') ||
          config.url.includes('/auth/forgot-password') ||
          config.url.includes('/auth/reset-password') ||
          config.url.includes('/password/forgot-password') ||
          config.url.includes('/password/reset-password')
        );
        
        if (!isAuthEndpoint) {
          // Try to get token from cookie (if non-httpOnly cookie exists)
          // Most tokens are httpOnly and can't be read, but we try as fallback
          const cookies = document.cookie.split('; ');
          const jwtCookie = cookies.find(c => c.startsWith('jwt='));
          
          if (jwtCookie) {
            const token = jwtCookie.split('=')[1];
            config.headers = config.headers || {};
            // Only add if not already set (allows manual override if needed)
            if (!config.headers.Authorization && token) {
              config.headers.Authorization = `Bearer ${token}`;
            }
          }
          // If no cookie token found, rely on httpOnly cookie being sent automatically
          // The server will authenticate via cookie if Authorization header is missing
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
        // Check if this is an auth endpoint that doesn't require CSRF (login/register/password reset/refresh)
        const isAuthEndpoint = config.url && (
          config.url.includes('/auth/login') ||
          config.url.includes('/auth/register') ||
          config.url.includes('/auth/refresh-token') ||
          config.url.includes('/auth/forgot-password') ||
          config.url.includes('/auth/reset-password') ||
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
          
          // SECURITY NOTE: CSRF tokens in localStorage are acceptable for cross-site scenarios
          // CSRF tokens are not sensitive secrets - they're meant to be readable by JavaScript
          // for the double-submit cookie pattern. They cannot be used alone to authenticate.
          // See SECURITY.md for full documentation.
          // If not in cookie, try localStorage (cross-site scenario only)
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
    // SECURITY FIX: Refresh tokens are stored in httpOnly cookies by the server
    // Do not store tokens in localStorage (XSS vulnerability)
    // Cookies are automatically sent with withCredentials: true
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    
    // Handle connection errors gracefully (backend not running)
    const isConnectionError = error.code === 'ECONNREFUSED' || 
                             error.code === 'ECONNRESET' ||
                             error.message?.includes('Network Error') ||
                             error.message?.includes('ERR_CONNECTION_REFUSED') ||
                             error.message?.includes('ERR_NETWORK');
    
    if (isConnectionError) {
      // Backend is not running - reject silently without logging
      // This prevents noisy console errors when backend is down
      return Promise.reject(error);
    }
    
    // Handle 401 errors - attempt token refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      const requestUrl = originalRequest.url || '';
      const pathname =
        typeof window !== 'undefined' ? window.location.pathname : '';
      const onPublicGuestRoute = isPublicGuestRoute(pathname);
      const onPlatformRoute = isPlatformRoute(pathname);

      // Guest/public pages must never trigger refresh or HRMS login redirects.
      // Platform control panel is NOT a guest portal — it may refresh tokens.
      if (onPublicGuestRoute) {
        return Promise.reject(error);
      }

      const isPublicApi =
        requestUrl.includes('/public/recruitment') ||
        requestUrl.includes('/public/lifecycle');

      if (isPublicApi || isSessionProbeRequest(requestUrl)) {
        return Promise.reject(error);
      }

      const errorCode = error.response?.data?.code;
      if (errorCode === 'PASSWORD_CHANGED') {
        if (typeof window !== 'undefined') {
          maybeRedirectToLoginOn401(errorCode);
        }
        return Promise.reject(error);
      }
      // Don't attempt refresh for auth endpoints (login, register, password reset)
      const isAuthEndpoint = originalRequest.url && (
        originalRequest.url.includes('/auth/login') ||
        originalRequest.url.includes('/auth/register') ||
        originalRequest.url.includes('/auth/refresh-token') ||
        originalRequest.url.includes('/auth/forgot-password') ||
        originalRequest.url.includes('/auth/reset-password') ||
        originalRequest.url.includes('/password/forgot-password') ||
        originalRequest.url.includes('/password/reset-password')
      );

      if (isAuthEndpoint) {
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
        // SECURITY FIX: Get refresh token from cookie only (not localStorage)
        // Cookies are automatically sent with withCredentials: true
        // The server sets refreshToken in httpOnly cookie via generateToken()
        // Note: httpOnly cookies cannot be read by JavaScript, but they're sent automatically
        let refreshToken = null;
        let refreshTokenPresent = false;
        
        // Try to get from cookie (for non-httpOnly cookies only, if any)
        // Most refresh tokens should be httpOnly, so this may not be accessible
        if (typeof document !== 'undefined') {
          const cookies = document.cookie.split('; ');
          const refreshCookie = cookies.find(c => c.startsWith('refreshToken='));
          if (refreshCookie) {
            refreshToken = refreshCookie.split('=')[1];
          }
          const refreshFlag = cookies.find(c => c.startsWith('refreshTokenPresent='));
          if (refreshFlag) {
            refreshTokenPresent = true;
          }
        }

        // The readable flag can be missing while the httpOnly refresh cookie is still
        // sent. NO_TOKEN means the access cookie is gone, so still try that refresh.
        const canRefreshWithoutFlag = errorCode === 'NO_TOKEN' || errorCode === 'TOKEN_EXPIRED';
        if (!refreshTokenPresent && !canRefreshWithoutFlag) {
          isRefreshing = false;
          processQueue(error, null);
          if (onPlatformRoute) {
            maybeRedirectToLoginOn401('PLATFORM_SESSION_DEAD');
          }
          return Promise.reject(error);
        }

        // Proceed with refresh - httpOnly cookie will be sent automatically even if we can't read it
        // If refresh fails, we'll redirect to login below

        // Determine which refresh endpoint to use based on role
        // SECURITY: Get role from cookie (set during login), not localStorage or Redux store
        // This is more reliable than accessing Redux store from a utility file
        // Fallback to 'employee' if role cannot be determined
        let role = 'employee';
        try {
          // Get role from cookie (set during login in Auth components)
          if (typeof document !== 'undefined') {
            const cookies = document.cookie.split('; ');
            const roleCookie = cookies.find(c => c.startsWith('role='));
            if (roleCookie) {
              role = roleCookie.split('=')[1];
            }
          }
          
          // If no role cookie found, try to infer from token payload (last resort)
          // Note: This is a fallback - role should always be in cookie after login
          if ((role === 'employee' || !role) && refreshToken) {
            try {
              // Decode JWT token to get role (without verification, just for endpoint selection)
              const tokenParts = refreshToken.split('.');
              if (tokenParts.length === 3) {
                const payload = JSON.parse(atob(tokenParts[1]));
                role = payload.role || 'employee';
              }
            } catch {
              // If decoding fails, use default 'employee'
            }
          }
        } catch {
          // Fallback to employee if role cannot be determined
          role = 'employee';
        }

        if (onPlatformRoute) {
          role = 'platform';
        } else if (role === 'platform') {
          // Platform operator cookie must not drive org HRMS API refresh
          isRefreshing = false;
          processQueue(
            new Error('Platform session cannot access organization APIs'),
            null
          );
          maybeRedirectToLoginOn401('PLATFORM_SESSION_DEAD');
          return Promise.reject(error);
        }
        
        const refreshEndpoint =
          role === 'platform'
            ? '/v1/platform/auth/refresh-token'
            : role === 'admin'
              ? '/v1/admin/auth/refresh-token'
              : '/v1/employee/auth/refresh-token';

        // Call refresh token endpoint
        // SECURITY FIX: Refresh token is sent automatically via httpOnly cookie
        // The server will read the refreshToken from the cookie
        // If we have a readable refresh token (non-httpOnly), include it in header as fallback
        const refreshConfig = {
          withCredentials: true,
        };
        
        // Only add Authorization header if we have a readable refresh token
        // Otherwise, rely on httpOnly cookie being sent automatically
        if (refreshToken) {
          refreshConfig.headers = {
            Authorization: `Bearer ${refreshToken}`,
          };
        }

        const refreshResponse = await axios.post(
          `${instance.defaults.baseURL}${refreshEndpoint}`,
          {},
          refreshConfig
        );

        const { token: newToken, csrfToken: newCsrfToken } = refreshResponse.data;

        // SECURITY FIX: Tokens are stored in httpOnly cookies by the server
        // Do not store tokens in localStorage (XSS vulnerability)
        // The server sets new tokens in httpOnly cookies automatically
        // Use the token from response for Authorization header (temporary, in-memory only)
        // CSRF token is not httpOnly (needs to be readable by JS for double-submit pattern)
        // See SECURITY.md for documentation on CSRF token storage

        // Update the original request with new token
        if (newToken) {
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
        }
        if (newCsrfToken && ['post', 'put', 'patch', 'delete'].includes(originalRequest.method?.toLowerCase())) {
          originalRequest.headers['x-csrf-token'] = newCsrfToken;
          // CSRF token is stored in cookie by server, but we also need it in header
          // This is safe because CSRF tokens are not sensitive (they're meant to be readable)
          try {
            localStorage.setItem('csrfToken', newCsrfToken);
          } catch {
            // ignore
          }
        }

        // Process queued requests (pass token for Authorization header, but don't store)
        processQueue(null, newToken);
        isRefreshing = false;

        // Retry the original request
        return instance(originalRequest);
      } catch (refreshError) {
        // Refresh failed - clear persisted auth so login page doesn't redirect back to dashboard (fixes loop when user deleted or session invalid)
        processQueue(refreshError, null);
        isRefreshing = false;

        if (onPlatformRoute) {
          maybeRedirectToLoginOn401('PLATFORM_SESSION_DEAD');
        }

        return Promise.reject(refreshError);
      }
    }
    
    // Handle 403 errors - log helpful message
    if (error.response?.status === 403) {
      const message = error.response?.data?.message || 'Access forbidden';
      const requestUrl = originalRequest?.url || '';
      const pathname =
        typeof window !== 'undefined' ? window.location.pathname : '';
      const onPlatformRoute = isPlatformRoute(pathname);
      const onPublicGuestRoute = isPublicGuestRoute(pathname);

      // Only hard-redirect when the server explicitly rejected a platform JWT on
      // an org HRMS API — not for every 403 while a leftover role=platform cookie exists.
      if (
        !onPlatformRoute &&
        !onPublicGuestRoute &&
        !isBootstrapAuthRequest(requestUrl) &&
        error.response?.data?.code === 'INSUFFICIENT_PERMISSIONS' &&
        /Platform operator/i.test(message)
      ) {
        maybeRedirectToLoginOn401('PLATFORM_SESSION_DEAD');
      }

      if (message.includes('admin') || message.includes('Access restricted')) {
        // Don't auto-redirect for 403, let user see the error message
      }
    }
    
    return Promise.reject(error);
  }
);

export default instance;

async function parseBlobErrorMessage(blob, fallback = 'Failed to load document') {
  if (!(blob instanceof Blob)) return fallback;
  try {
    const text = await blob.text();
    const parsed = JSON.parse(text);
    return parsed.message || fallback;
  } catch {
    return fallback;
  }
}

/** Fetch document bytes with session auth (works for old + new uploads). */
export async function fetchDocumentBlob(documentId, { version, inline = false, scope = 'both' } = {}) {
  if (!documentId) {
    throw new Error('Document id is required');
  }
  const params = {};
  if (version != null) params.version = version;
  if (inline) params.inline = '1';

  const paths =
    scope === 'admin'
      ? [`/v1/admin/documents/${documentId}/download`, `/v1/both/documents/${documentId}/download`]
      : [`/v1/both/documents/${documentId}/download`, `/v1/admin/documents/${documentId}/download`];

  let lastError = null;

  for (const url of paths) {
    try {
      const response = await instance.get(url, {
        params,
        responseType: 'blob',
        withCredentials: true,
      });

      const blob = response.data;
      const contentType = response.headers?.['content-type'] || '';

      if (blob?.type === 'application/json' || contentType.includes('application/json')) {
        throw new Error(await parseBlobErrorMessage(blob));
      }

      return blob;
    } catch (error) {
      lastError = error;
      const status = error.response?.status;
      const data = error.response?.data;

      if (data instanceof Blob) {
        const message = await parseBlobErrorMessage(
          data,
          status === 404 ? 'Document or file not found' : 'Failed to load document'
        );
        lastError = new Error(message);
      } else if (error.response?.data?.message) {
        lastError = new Error(error.response.data.message);
      }

      // Try fallback path only for route-level 404
      if (status !== 404 || url === paths[paths.length - 1]) {
        break;
      }
    }
  }

  throw lastError || new Error('Failed to load document');
}

/** Fetch document bytes — API first, then employee upload route, then direct /uploads. */
export async function fetchDocumentWithFallback(documentId, options = {}) {
  const { fileUrl, employeeId, ...fetchOptions } = options;
  const params = {};
  if (fetchOptions.version != null) params.version = fetchOptions.version;
  if (fetchOptions.inline) params.inline = '1';

  const tryBlob = async (url) => {
    const response = await instance.get(url, {
      params,
      responseType: 'blob',
      withCredentials: true,
    });
    const blob = response.data;
    const contentType = response.headers?.['content-type'] || '';
    if (blob?.type === 'application/json' || contentType.includes('application/json')) {
      throw new Error(await parseBlobErrorMessage(blob));
    }
    return blob;
  };

  try {
    return await fetchDocumentBlob(documentId, fetchOptions);
  } catch (apiError) {
    if (employeeId) {
      try {
        return await tryBlob(`/v1/both/document/${employeeId}/documents/${documentId}/download`);
      } catch {
        try {
          return await tryBlob(`/v1/upload/${employeeId}/documents/${documentId}/download`);
        } catch {
          /* try next */
        }
      }
    }
    if (fileUrl) {
      const direct = getUploadUrl(fileUrl);
      if (direct) {
        try {
          const response = await fetch(direct, { credentials: 'include' });
          if (response.ok) {
            return await response.blob();
          }
        } catch {
          /* try next */
        }
      }
    }
    throw apiError;
  }
}

function blobForPreview(blob, mimeHint) {
  const mimeType =
    blob?.type && !blob.type.includes('json') && blob.type !== 'application/octet-stream'
      ? blob.type
      : mimeHint || 'application/pdf';
  if (blob?.type === mimeType) return blob;
  return new Blob([blob], { type: mimeType });
}

/** Open document preview in a new tab using fetched bytes (not raw API URL). */
export async function openDocumentPreview(documentId, options = {}) {
  const { fileUrl, fileName, mimeType: mimeHint, ...fetchOptions } = options;
  const blob = await fetchDocumentWithFallback(documentId, {
    fileUrl,
    ...fetchOptions,
    inline: true,
  });
  const viewBlob = blobForPreview(blob, mimeHint);
  const objectUrl = URL.createObjectURL(viewBlob);

  const previewTab = window.open('about:blank', '_blank');
  if (!previewTab) {
    URL.revokeObjectURL(objectUrl);
    throw new Error('Could not open preview. Allow popups for this site.');
  }

  const title = fileName || 'Document';
  if (viewBlob.type.startsWith('image/')) {
    previewTab.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title></head><body style="margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1e293b"><img src="${objectUrl}" alt="" style="max-width:100%;max-height:100vh;object-fit:contain" /></body></html>`
    );
  } else {
    previewTab.document.write(
      `<!DOCTYPE html><html><head><title>${title}</title><style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:100%}</style></head><body><iframe src="${objectUrl}" title="${title}"></iframe></body></html>`
    );
  }
  previewTab.document.close();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 120_000);
}

/** Trigger browser download for a document. */
export async function saveDocumentDownload(documentId, fileName, options = {}) {
  const { fileUrl, ...fetchOptions } = options;
  const blob = await fetchDocumentWithFallback(documentId, fetchOptions);
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName || 'document';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}