/**
 * Frontend Logger Utility
 * Replaces console.log with a proper logging system
 * 
 * SECURITY: Automatically sanitizes sensitive data before logging
 * In production, only errors are logged to console
 */

const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;
const isProduction = import.meta.env.MODE === 'production' || import.meta.env.PROD;

/**
 * Sanitize sensitive data before logging
 * @param {any} data - Data to sanitize
 * @returns {any} Sanitized data
 */
const sanitize = (data) => {
  if (typeof data !== 'object' || data === null) return data;
  
  const sensitiveKeys = [
    'password', 'token', 'jwt', 'authorization', 'cookie',
    'refreshToken', 'csrfToken', 'accessToken', 'apiKey',
    'secret', 'privateKey', 'email', 'phone'
  ];
  
  const sanitized = { ...data };
  for (const key in sanitized) {
    const lowerKey = key.toLowerCase();
    if (sensitiveKeys.some(sk => lowerKey.includes(sk.toLowerCase()))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null) {
      sanitized[key] = sanitize(sanitized[key]);
    }
  }
  return sanitized;
};

/**
 * Log levels
 */
const LOG_LEVELS = {
    ERROR: 0,
    WARN: 1,
    INFO: 2,
    DEBUG: 3
};

/**
 * Current log level (only show errors in production)
 */
const currentLogLevel = isDevelopment ? LOG_LEVELS.DEBUG : LOG_LEVELS.ERROR;

/**
 * Logger class
 */
class Logger {
    /**
     * Log error messages
     * Always logs errors (even in production) but sanitizes data
     * @param {string} message - Error message
     * @param {Object} [data] - Additional data
     */
    error(message, data = null) {
        if (currentLogLevel >= LOG_LEVELS.ERROR) {
            if (data) {
                const sanitized = typeof data === 'object' ? sanitize(data) : data;
                // In production, only log to console if explicitly enabled
                if (isProduction && !import.meta.env.VITE_ENABLE_CONSOLE_ERRORS) {
                    // Could send to error tracking service here (e.g., Sentry)
                    return;
                }
                console.error(`[ERROR] ${message}`, sanitized);
            } else {
                if (isProduction && !import.meta.env.VITE_ENABLE_CONSOLE_ERRORS) {
                    return;
                }
                console.error(`[ERROR] ${message}`);
            }
        }
    }

    /**
     * Log warning messages
     * Only logs in development mode
     * @param {string} message - Warning message
     * @param {Object} [data] - Additional data
     */
    warn(message, data = null) {
        if (currentLogLevel >= LOG_LEVELS.WARN) {
            // In production, suppress warnings unless explicitly enabled
            if (isProduction && !import.meta.env.VITE_ENABLE_CONSOLE_WARNINGS) {
                return;
            }
            if (data) {
                const sanitized = typeof data === 'object' ? sanitize(data) : data;
                console.warn(`[WARN] ${message}`, sanitized);
            } else {
                console.warn(`[WARN] ${message}`);
            }
        }
    }

    /**
     * Log info messages (development only)
     * @param {string} message - Info message
     * @param {Object} [data] - Additional data
     */
    info(message, data = null) {
        if (currentLogLevel >= LOG_LEVELS.INFO && isDevelopment) {
            if (data) {
                const sanitized = typeof data === 'object' ? sanitize(data) : data;
                console.info(`[INFO] ${message}`, sanitized);
            } else {
                console.info(`[INFO] ${message}`);
            }
        }
    }

    /**
     * Log debug messages (development only)
     * @param {string} message - Debug message
     * @param {Object} [data] - Additional data
     */
    debug(message, data = null) {
        if (currentLogLevel >= LOG_LEVELS.DEBUG && isDevelopment) {
            if (data) {
                const sanitized = typeof data === 'object' ? sanitize(data) : data;
                console.debug(`[DEBUG] ${message}`, sanitized);
            } else {
                console.debug(`[DEBUG] ${message}`);
            }
        }
    }

    /**
     * Log method (alias for info, for compatibility)
     * @param {string} message - Log message
     * @param {Object} [data] - Additional data
     */
    log(message, data = null) {
        this.info(message, data);
    }
}

// Export singleton instance
const logger = new Logger();
export default logger;

