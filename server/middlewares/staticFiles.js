import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import logger from "../helpers/logger.js";
import { getAllowedOrigins } from "./corsConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Middleware to set CORS headers for static file requests
 * This is critical for images to work with html2canvas and other CORS contexts
 */
export const staticFilesCorsMiddleware = (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  // Set CORS headers for static files BEFORE serving
  // CRITICAL: Always set CORS headers for images to work with html2canvas and other CORS contexts
  
  // Development: More permissive CORS for easier local development
  if (process.env.NODE_ENV === "development") {
    if (origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  } else {
    // Production: More permissive CORS for static files (images need to load from anywhere)
    // Static files (images) are generally safe to serve with permissive CORS
    if (origin) {
      // Allow any origin for static files in production
      // This is safe because images don't contain sensitive data
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      // No origin header - use wildcard for static files
      res.setHeader("Access-Control-Allow-Origin", "*");
    }
  }
  
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS, HEAD");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, Accept, Origin");
  res.setHeader("Access-Control-Expose-Headers", "Content-Length, Content-Type, Content-Disposition");
  res.setHeader("Access-Control-Max-Age", "86400"); // Cache preflight for 24 hours
  
  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  
  // Continue to static file serving
  next();
};

/**
 * Middleware to check file existence and log warnings
 * Helps debug 404s for profile photos
 */
export const staticFilesCheckMiddleware = (req, res, next) => {
  try {
    // Check if file exists before serving (helps debug 404s for profile photos)
    const requestedPath = req.path;
    if (requestedPath.includes('profile-photos')) {
      const fullPath = path.join(__dirname, "..", "uploads", requestedPath);
      try {
        if (!fs.existsSync(fullPath)) {
          logger.warn('File not found', {
            requestedPath,
            fullPath,
            url: req.url,
            timestamp: new Date().toISOString()
          });
          // Don't return 404 here - let express.static handle it
          // But log it for debugging Render ephemeral filesystem issues
        }
      } catch (fsError) {
        // Log filesystem errors but don't block the request
        logger.error('Error checking file existence', {
          error: fsError.message,
          requestedPath,
          fullPath,
          stack: fsError.stack
        });
      }
    }
    next();
  } catch (error) {
    // Catch any unexpected errors in the middleware
    logger.error('Error in staticFilesCheckMiddleware', {
      error: error.message,
      stack: error.stack,
      url: req.url
    });
    // Continue to next middleware - don't block the request
    next();
  }
};

/**
 * Middleware to handle 404s for missing static files
 * This runs after express.static to catch requests that didn't match any files
 */
export const staticFiles404Handler = (req, res, next) => {
  // Only handle requests to /uploads that look like file requests
  if (req.path.startsWith('/uploads/') && req.path.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i)) {
    // If response hasn't been sent and status is not set, file wasn't found
    if (!res.headersSent) {
      logger.warn('Static file not found - returning 404', {
        path: req.path,
        url: req.url,
        method: req.method
      });
      return res.status(404).json({ 
        message: 'File not found',
        path: req.path 
      });
    }
  }
  next();
};

/**
 * Configure static file serving with proper headers
 */
export const staticFilesConfig = express.static(path.join(__dirname, "..", "uploads"), {
  setHeaders: (res, filePath, stat) => {
    try {
      // CRITICAL: Get origin from request - this is essential for CORS
      const req = res.req || res.locals?.req;
      const origin = req?.headers?.origin || req?.get?.('origin');
      
      // Set CORS headers for the file response - MUST match what middleware set
      // Development: More permissive CORS
      if (process.env.NODE_ENV === "development") {
        if (origin) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
      } else {
        // Production: More permissive CORS for static files (images need to load from anywhere)
        if (origin) {
          // Allow any origin for static files in production
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
      }
      
      // Set appropriate content type for images
      if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
        res.setHeader("Content-Type", "image/jpeg");
      } else if (filePath.endsWith('.png')) {
        res.setHeader("Content-Type", "image/png");
      } else if (filePath.endsWith('.gif')) {
        res.setHeader("Content-Type", "image/gif");
      } else if (filePath.endsWith('.webp')) {
        res.setHeader("Content-Type", "image/webp");
      }
      
      // Cache control for images
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
    } catch (error) {
      // Log error but don't throw - allow Express static to handle file serving
      logger.error('Error setting static file headers', {
        error: error.message,
        filePath,
        stack: error.stack
      });
      // Set basic CORS headers as fallback
      try {
        res.setHeader("Access-Control-Allow-Origin", "*");
      } catch (headerError) {
        // If even setting headers fails, log and continue
        logger.error('Failed to set fallback CORS headers', { error: headerError.message });
      }
    }
  },
  // Add fallthrough to handle missing files gracefully
  fallthrough: true
});

