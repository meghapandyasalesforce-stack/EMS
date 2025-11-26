/**
 * Frontend Logger Utility
 * Replaces console.log with a proper logging system
 * 
 * SECURITY: Automatically sanitizes sensitive data before logging
 */

const isDevelopment = import.meta.env.MODE === 'development' || import.meta.env.DEV;

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
     * @param {string} message - Error message
     * @param {Object} [data] - Additional data
     */
    error(message, data = null) {
        if (currentLogLevel >= LOG_LEVELS.ERROR) {
            if (data) {
                const sanitized = typeof data === 'object' ? sanitize(data) : data;
                console.error(`[ERROR] ${message}`, sanitized);
            } else {
                console.error(`[ERROR] ${message}`);
            }
        }
    }

    /**
     * Log warning messages
     * @param {string} message - Warning message
     * @param {Object} [data] - Additional data
     */
    warn(message, data = null) {
        if (currentLogLevel >= LOG_LEVELS.WARN) {
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
        if (currentLogLevel >= LOG_LEVELS.INFO) {
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
        if (currentLogLevel >= LOG_LEVELS.DEBUG) {
            if (data) {
                const sanitized = typeof data === 'object' ? sanitize(data) : data;
                console.debug(`[DEBUG] ${message}`, sanitized);
            } else {
                console.debug(`[DEBUG] ${message}`);
            }
        }
    }
}

// Export singleton instance
const logger = new Logger();
export default logger;

