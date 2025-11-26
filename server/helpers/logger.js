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
    // Always log errors, but sanitize sensitive data
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return logger.sanitize(arg);
      }
      return arg;
    });
    console.error(`[ERROR] ${message}`, ...sanitizedArgs);
  },

  warn: (message, ...args) => {
    // Always log warnings, but sanitize sensitive data
    const sanitizedArgs = args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        return logger.sanitize(arg);
      }
      return arg;
    });
    console.warn(`[WARN] ${message}`, ...sanitizedArgs);
  },

  debug: (message, ...args) => {
    if (isDevelopment) {
      console.log(`[DEBUG] ${message}`, ...args);
    }
  },

  // Sanitize sensitive data before logging
  // SECURITY: Never log secrets, tokens, passwords, or sensitive environment variables
  sanitize: (data) => {
    if (typeof data !== 'object' || data === null) return data;
    
    const sanitized = { ...data };
    
    // List of sensitive keys to redact
    const sensitiveKeys = [
      'password', 'token', 'jwt', 'cookies', 'authorization', 'cookie',
      'refreshToken', 'csrfToken', 'accessToken', 'apiKey', 'apikey',
      'secret', 'privateKey', 'private_key', 'secretKey', 'secret_key',
      'mongo_uri', 'mongodb_uri', 'database_url', 'db_password',
      'email_pass', 'email_password', 'smtp_password',
      'redis_password', 'redis_url', 'vapid_private_key',
      'jwt_secret', 'session_secret', 'encryption_key'
    ];
    
    // Recursively sanitize nested objects
    const sanitizeRecursive = (obj) => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) {
        return obj.map(item => sanitizeRecursive(item));
      }
      
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        
        // Check if key contains sensitive terms
        const isSensitive = sensitiveKeys.some(sensitive => 
          lowerKey.includes(sensitive.toLowerCase())
        );
        
        if (isSensitive) {
          result[key] = '[REDACTED]';
        } else if (typeof value === 'object' && value !== null) {
          result[key] = sanitizeRecursive(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    };
    
    return sanitizeRecursive(sanitized);
  },

  // Safe log that sanitizes sensitive data
  safe: (message, data) => {
    if (isDevelopment) {
      console.log(`[SAFE] ${message}`, logger.sanitize(data));
    }
  }
};

export default logger;

