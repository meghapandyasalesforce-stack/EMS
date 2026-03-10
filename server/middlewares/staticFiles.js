import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import logger from "../helpers/logger.js";
import { getAllowedOrigins } from "./corsConfig.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "..", "uploads");
const profilePhotosDir = path.join(uploadsDir, "profile-photos");

try {
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
        logger.info('Created uploads directory', { path: uploadsDir });
    }
    if (!fs.existsSync(profilePhotosDir)) {
        fs.mkdirSync(profilePhotosDir, { recursive: true });
        logger.info('Created profile-photos directory', { path: profilePhotosDir });
    }
} catch (error) {
    logger.error('Failed to create uploads directories', {
        error: error.message,
        uploadsDir,
        profilePhotosDir
    });
}

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
 * CRITICAL: This must return a proper response to prevent route handlers from catching it
 */
export const staticFiles404Handler = (req, res, next) => {
  // Only handle GET requests to /uploads that look like file requests
  if (req.method === 'GET' && req.path.startsWith('/uploads/')) {
    // Check if response was already sent by express.static (file was found and served)
    if (res.headersSent) {
      // File was found and served, continue normally
      return next();
    }
    
    // If we reach here and it's a file request, express.static didn't find it
    // Check if it's a file request (has extension)
    if (req.path.match(/\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i)) {
      const requestedPath = req.path.replace(/^\/uploads\//, '');
      const fullPath = path.join(__dirname, "..", "uploads", requestedPath);
      
      // Check if file exists
      let fileExists = false;
      try {
        fileExists = fs.existsSync(fullPath);
      } catch (fsError) {
        logger.error('Error checking file existence', {
          error: fsError.message,
          fullPath,
          path: req.path
        });
      }
      
      if (!fileExists) {
        // Legacy: try public/uploads (e.g. documents previously saved by multer to public/uploads/documents)
        const legacyPath = path.join(process.cwd(), 'public', req.path);
        try {
          if (fs.existsSync(legacyPath)) {
            const origin = req.headers.origin;
            if (origin) {
              res.setHeader("Access-Control-Allow-Origin", origin);
              res.setHeader("Access-Control-Allow-Credentials", "true");
            } else {
              res.setHeader("Access-Control-Allow-Origin", "*");
            }
            res.sendFile(path.resolve(legacyPath));
            return;
          }
        } catch (legacyErr) {
          logger.warn('Legacy static file serve failed', { path: req.path, error: legacyErr?.message });
        }

        logger.warn('Static file not found - returning 404', {
          path: req.path,
          fullPath,
          url: req.url,
          method: req.method,
          timestamp: new Date().toISOString()
        });
        
        // Return a proper 404 response with appropriate headers
        const origin = req.headers.origin;
        if (origin) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
        res.setHeader("Content-Type", "application/json");
        
        res.status(404).json({ 
          success: false,
          message: 'File not found',
          path: req.path 
        });
        return;
      } else {
        // File exists but express.static didn't serve it - this shouldn't happen
        // Log warning but continue to next middleware
        logger.warn('File exists but express.static did not serve it', {
          path: req.path,
          fullPath
        });
      }
    }
  }
  // If it's not a static file request or file exists, continue to next middleware
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

