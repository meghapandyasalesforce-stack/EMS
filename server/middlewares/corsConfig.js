import cors from "cors";
import logger from "../helpers/logger.js";

/**
 * Get allowed origins based on environment configuration
 * @returns {string[]} Array of allowed origin URLs
 */
export const getAllowedOrigins = () => {
  const origins = [];
  
  // Add FRONTEND_URL if set
  if (process.env.FRONTEND_URL) {
    origins.push(process.env.FRONTEND_URL);
  }
  
  // Add additional allowed origins from environment (comma-separated)
  if (process.env.ALLOWED_ORIGINS) {
    origins.push(...process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()));
  }
  
  // Default origins for development
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:5173', 'http://localhost:3000');
  }
  
  // Production: Use FRONTEND_URL if set, otherwise no hardcoded defaults
  // This allows flexibility for different deployments
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL && !process.env.ALLOWED_ORIGINS) {
    // Only add default if no configuration is provided (backward compatibility)
    // Log warning to encourage explicit configuration
    logger.warn('CORS: No FRONTEND_URL or ALLOWED_ORIGINS set in production. Consider setting these explicitly.');
  }
  
  // Remove duplicates and filter out empty strings
  const uniqueOrigins = [...new Set(origins.filter(origin => origin && origin.trim()))];
  
  // SECURITY: In production, fail fast if no origins are configured
  // Never fall back to localhost in production - this is a critical security risk
  if (process.env.NODE_ENV === 'production') {
    if (uniqueOrigins.length === 0) {
      logger.error('CORS: No allowed origins configured in production. This is a critical security risk!');
      throw new Error('CORS configuration error: At least one origin must be configured in production via FRONTEND_URL or ALLOWED_ORIGINS environment variables.');
    }
    return uniqueOrigins;
  }
  
  // Development: Allow localhost fallback for convenience
  return uniqueOrigins.length > 0 ? uniqueOrigins : ['http://localhost:5173'];
};

/**
 * CORS middleware configuration
 * Handles cross-origin requests with environment-aware settings
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
    // Same-origin requests don't send Origin header - allow them
    // This is correct behavior per CORS spec: same-origin requests bypass CORS entirely
    // Only cross-origin requests need CORS validation
    if (!origin) {
      logger.debug('CORS: Same-origin request (no Origin header) - allowing');
      return callback(null, true);
    }
    
    // Validate cross-origin requests (when Origin header is present)
    if (process.env.NODE_ENV === 'production') {
      // In production, validate cross-origin requests strictly
      // Check if origin is in allowed list (strict matching)
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // Log rejected origins for security monitoring (sanitized by logger)
      logger.warn('CORS: Origin rejected in production', { 
        origin,
        allowedOrigins: allowedOrigins.length > 0 ? '[CONFIGURED]' : '[NONE]'
      });
      callback(new Error('Not allowed by CORS'));
      return;
    }
    
    // Development mode: Validate cross-origin requests
    // Check if origin is in allowed list (strict matching)
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, reject unknown origins (more secure)
    // Log for debugging
    logger.warn('CORS: Origin rejected in development', { 
      origin,
      allowedOrigins: allowedOrigins.length > 0 ? allowedOrigins : '[NONE]',
      hint: 'Add origin to FRONTEND_URL or ALLOWED_ORIGINS environment variable'
    });
    
    // Reject unknown origins even in development
    callback(new Error('Not allowed by CORS'));
    return;
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200
});

