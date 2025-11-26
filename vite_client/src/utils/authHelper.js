/**
 * Authentication Helper Utilities
 * Provides secure token retrieval methods
 * 
 * SECURITY: Tokens are stored in httpOnly cookies by the server
 * This helper provides utilities to work with cookie-based authentication
 */

/**
 * Get JWT token from cookie (if non-httpOnly cookie exists)
 * Note: Most tokens are in httpOnly cookies and cannot be read by JavaScript
 * This is a fallback for cross-site scenarios where non-httpOnly cookies might be used
 * 
 * @returns {string|null} Token if found, null otherwise
 */
export const getTokenFromCookie = () => {
  if (typeof document === 'undefined') return null;
  
  try {
    const cookies = document.cookie.split('; ');
    const jwtCookie = cookies.find(c => c.startsWith('jwt='));
    return jwtCookie ? jwtCookie.split('=')[1] : null;
  } catch {
    return null;
  }
};

/**
 * Get CSRF token from cookie or localStorage
 * CSRF tokens are safe to store in localStorage (they're not secrets)
 * See SECURITY.md for documentation
 * 
 * @returns {string|null} CSRF token if found, null otherwise
 */
export const getCsrfToken = () => {
  if (typeof document === 'undefined') return null;
  
  try {
    // First try cookie (preferred)
    const cookies = document.cookie.split('; ');
    const csrfCookie = cookies.find(c => c.startsWith('csrfToken='));
    if (csrfCookie) {
      return csrfCookie.split('=')[1];
    }
    
    // Fallback to localStorage (acceptable for CSRF tokens)
    if (typeof window !== 'undefined') {
      return localStorage.getItem('csrfToken');
    }
  } catch {
    // Silently fail
  }
  
  return null;
};

/**
 * Check if user is authenticated
 * This checks for the presence of auth cookies (httpOnly cookies are sent automatically)
 * 
 * @returns {boolean} True if authenticated, false otherwise
 */
export const isAuthenticated = () => {
  // Check if auth cookie exists (even if httpOnly, we can check if cookie domain is set)
  // For httpOnly cookies, we rely on the server to validate
  // This is a best-effort check
  if (typeof document === 'undefined') return false;
  
  try {
    const cookies = document.cookie.split('; ');
    // Check for jwt cookie (might be httpOnly, but we can check if it's in the cookie string)
    // If httpOnly, it won't be in document.cookie, but the server will still receive it
    // So we return true optimistically if we're in a browser context
    return cookies.some(c => c.startsWith('jwt=')) || 
           cookies.some(c => c.startsWith('refreshToken='));
  } catch {
    return false;
  }
};

/**
 * Get user role from Redux store or localStorage (UI state only)
 * Role is not sensitive data, but should come from JWT token ideally
 * 
 * @returns {string|null} User role if found, null otherwise
 */
export const getUserRole = () => {
  // Try to get from Redux store first (if available)
  if (typeof window !== 'undefined' && window.__REDUX_STORE__) {
    try {
      const state = window.__REDUX_STORE__.getState();
      return state?.auth?.user?.role || null;
    } catch {
      // Fallback to localStorage (UI state only)
    }
  }
  
  // Fallback to localStorage (acceptable for UI state)
  if (typeof window !== 'undefined') {
    return localStorage.getItem('role');
  }
  
  return null;
};

/**
 * Get Authorization header value
 * Tries to get token from cookie first, falls back to checking if cookie-based auth is available
 * 
 * @returns {string|null} Authorization header value or null
 */
export const getAuthorizationHeader = () => {
  const token = getTokenFromCookie();
  return token ? `Bearer ${token}` : null;
};

