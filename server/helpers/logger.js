// Logger utility to replace console.log with proper logging
// This helps control what gets logged in production

const isDevelopment = process.env.NODE_ENV === 'development';

const logger = {
  info: (message, ...args) => {
    if (isDevelopment) {
      console.log(`[INFO] ${message}`, ...args);
    }
  },

  error: (message, ...args) => {
    // Always log errors
    console.error(`[ERROR] ${message}`, ...args);
  },

  warn: (message, ...args) => {
    // Always log warnings
    console.warn(`[WARN] ${message}`, ...args);
  },

  debug: (message, ...args) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  // Sanitize sensitive data before logging
  sanitize: (data) => {
    if (typeof data !== 'object') return data;
    
    const sanitized = { ...data };
    const sensitiveKeys = ['password', 'token', 'jwt', 'cookies', 'authorization', 'cookie'];
    
    sensitiveKeys.forEach(key => {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  },

  // Safe log that sanitizes sensitive data
  safe: (message, data) => {
    if (isDevelopment) {
      console.log(`[SAFE] ${message}`, logger.sanitize(data));
    }
  }
};

export default logger;

