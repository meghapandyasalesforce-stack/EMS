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
  
  // Default origins
  if (process.env.NODE_ENV === 'development') {
    origins.push('http://localhost:5173', 'http://localhost:3000');
  }
  
  // Production defaults (Vercel + Render)
  if (process.env.NODE_ENV === 'production') {
    origins.push('https://paarsiv.vercel.app');
  }
  
  return origins.length > 0 ? origins : ['http://localhost:5173'];
};

/**
 * CORS middleware configuration
 * Handles cross-origin requests with environment-aware settings
 */
export const corsMiddleware = cors({
  origin: (origin, callback) => {
    const allowedOrigins = getAllowedOrigins();
    
  // In production, be strict about origins
  if (process.env.NODE_ENV === 'production') {
    // In production, reject requests with no origin
    // Note: Mobile apps should send a proper origin header or use a different authentication method
    if (!origin) {
      logger.warn('CORS: Request with no origin header rejected in production');
      return callback(new Error('Origin header required in production'));
    }
    
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
    
    // Development mode: more lenient
    // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development, allow any origin
    return callback(null, true);
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token", "X-Requested-With", "Accept", "Origin"],
  exposedHeaders: ["Set-Cookie"],
  optionsSuccessStatus: 200
});

