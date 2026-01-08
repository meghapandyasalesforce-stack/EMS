// Logger utility with structured JSON logging support
// This helps control what gets logged in production and enables log aggregation

const isDevelopment = process.env.NODE_ENV === 'development';
const useStructuredLogging = process.env.STRUCTURED_LOGGING === 'true' || process.env.NODE_ENV === 'production';

/**
 * Create structured log entry
 * @param {string} level - Log level (info, error, warn, debug)
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 * @returns {Object} Structured log entry
 */
const createStructuredLog = (level, message, metadata = {}) => {
  const logEntry = {
    timestamp: new Date().toISOString(),
    level: level.toUpperCase(),
    message,
    ...metadata
  };

  // Add environment context
  if (process.env.NODE_ENV) {
    logEntry.environment = process.env.NODE_ENV;
  }

  // Add request ID if available
  if (metadata.requestId) {
    logEntry.requestId = metadata.requestId;
  }

  return logEntry;
};

/**
 * Output log (structured JSON or formatted string)
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} metadata - Additional metadata
 */
const outputLog = (level, message, metadata = {}) => {
  const sanitizedMetadata = metadata && typeof metadata === 'object' 
    ? logger.sanitize(metadata) 
    : metadata;

  if (useStructuredLogging) {
    const logEntry = createStructuredLog(level, message, sanitizedMetadata);
    const output = JSON.stringify(logEntry);
    
    if (level === 'error') {
      console.error(output);
    } else if (level === 'warn') {
      console.warn(output);
    } else {
      console.log(output);
    }
  } else {
    // Traditional formatted logging for development
    const prefix = `[${level.toUpperCase()}]`;
    if (Object.keys(sanitizedMetadata).length > 0) {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${message}`,
        sanitizedMetadata
      );
    } else {
      console[level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log'](
        `${prefix} ${message}`
      );
    }
  }
};

const logger = {
  info: (message, metadata = {}) => {
    if (isDevelopment || useStructuredLogging) {
      outputLog('info', message, metadata);
    }
  },

  error: (message, metadata = {}) => {
    // Always log errors
    outputLog('error', message, metadata);
  },

  warn: (message, metadata = {}) => {
    // Always log warnings
    outputLog('warn', message, metadata);
  },

  debug: (message, metadata = {}) => {
    if (isDevelopment || useStructuredLogging) {
      outputLog('debug', message, metadata);
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

