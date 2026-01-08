import { toast } from 'react-toastify';
import logger from './logger';

/**
 * Standardized error handling utility
 * Handles API errors consistently across the application
 */

/**
 * Handle API errors with standardized messaging
 * @param {Error} error - The error object
 * @param {Object} options - Error handling options
 * @param {string} options.context - Context where error occurred (e.g., 'Dashboard', 'Employee')
 * @param {boolean} options.showToast - Whether to show toast notification (default: true)
 * @param {string} options.fallbackMessage - Custom fallback message
 * @param {function} options.onError - Custom error handler callback
 * @returns {Object} Error information object
 */
export const handleApiError = (error, options = {}) => {
  const {
    context = 'Application',
    showToast = true,
    fallbackMessage = 'An unexpected error occurred',
    onError,
  } = options;

  // Extract error information
  const status = error?.response?.status;
  const statusText = error?.response?.statusText;
  const message = error?.response?.data?.message || error?.message || fallbackMessage;
  const code = error?.response?.data?.code;

  // Handle backend unavailable (503) - don't log or show toast
  if (status === 503 || error.isBackendUnavailable) {
    // Backend is not running - return silently without logging
    return {
      status: 503,
      message: 'Service unavailable',
      code: 'SERVICE_UNAVAILABLE',
      type: 'info',
      originalError: error,
    };
  }

  // Log error for debugging (skip for 503)
  logger.error(`${context} Error`, {
    status,
    statusText,
    message,
    code,
    url: error?.config?.url,
    method: error?.config?.method,
    error: error.message,
    stack: error.stack,
  });

  // Handle specific error codes
  let userMessage = message;
  let errorType = 'error';

  if (status === 401) {
    userMessage = 'Your session has expired. Please log in again.';
    errorType = 'warning';
    // Don't show toast for 401 - let axios interceptor handle redirect
    if (showToast && typeof window !== 'undefined' && window.location.pathname !== '/login') {
      setTimeout(() => {
        window.location.href = '/login';
      }, 2000);
    }
    return { status, message: userMessage, code, type: errorType };
  }

  if (status === 403) {
    userMessage = 'You do not have permission to perform this action.';
    errorType = 'warning';
  }

  if (status === 404) {
    userMessage = 'The requested resource was not found.';
    errorType = 'info';
  }

  if (status === 429) {
    userMessage = 'Too many requests. Please try again later.';
    errorType = 'warning';
  }

  if (status >= 500) {
    userMessage = 'Server error. Please try again later.';
    errorType = 'error';
  }

  // Network errors
  if (error.code === 'ECONNREFUSED' || error.message?.includes('Network Error')) {
    userMessage = 'Unable to connect to server. Please check your connection.';
    errorType = 'error';
  }

  // Show toast notification
  if (showToast) {
    switch (errorType) {
      case 'warning':
        toast.warning(userMessage);
        break;
      case 'info':
        toast.info(userMessage);
        break;
      default:
        toast.error(userMessage);
    }
  }

  // Call custom error handler if provided
  if (onError && typeof onError === 'function') {
    onError({ status, message: userMessage, code, originalError: error });
  }

  return {
    status,
    message: userMessage,
    code,
    type: errorType,
    originalError: error,
  };
};

/**
 * Handle multiple API errors (for Promise.allSettled scenarios)
 * @param {Array} results - Array of results from Promise.allSettled
 * @param {Object} options - Error handling options
 * @returns {Object} Processed results with error information
 */
export const handleMultipleErrors = (results, options = {}) => {
  const { context = 'Batch Request', showToast = true } = options;
  
  const errors = [];
  const successful = [];

  results.forEach((result, index) => {
    if (result.status === 'rejected') {
      const errorInfo = handleApiError(result.reason, {
        context: `${context} (Request ${index + 1})`,
        showToast: false, // Don't show individual toasts
      });
      errors.push({ index, error: errorInfo });
    } else {
      successful.push({ index, data: result.value });
    }
  });

  // Show summary toast if there are errors
  if (errors.length > 0 && showToast) {
    const errorCount = errors.length;
    const totalCount = results.length;
    toast.warning(
      `Failed to load ${errorCount} of ${totalCount} items. Some data may be incomplete.`
    );
  }

  return {
    errors,
    successful,
    hasErrors: errors.length > 0,
    allSuccessful: errors.length === 0,
  };
};

/**
 * Create a safe async function wrapper that handles errors
 * @param {Function} asyncFn - Async function to wrap
 * @param {Object} options - Error handling options
 * @returns {Function} Wrapped function
 */
export const withErrorHandling = (asyncFn, options = {}) => {
  return async (...args) => {
    try {
      return await asyncFn(...args);
    } catch (error) {
      handleApiError(error, options);
      throw error; // Re-throw to allow caller to handle if needed
    }
  };
};

export default {
  handleApiError,
  handleMultipleErrors,
  withErrorHandling,
};

