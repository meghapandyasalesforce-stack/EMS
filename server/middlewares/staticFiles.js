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
    // Production: Strict CORS based on allowed origins
    if (origin) {
      if (allowedOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else if (origin === "https://paarsiv.vercel.app") {
        // Explicitly allow Vercel origin in production
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        // Reject unknown origins in production (no wildcard)
        logger.warn('CORS rejected origin for static files', { origin });
        // Still set headers but without credentials
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    } else {
      // No origin header - use wildcard but without credentials
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
  // Check if file exists before serving (helps debug 404s for profile photos)
  const requestedPath = req.path;
  if (requestedPath.includes('profile-photos')) {
    const fullPath = path.join(__dirname, "..", "uploads", requestedPath);
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
  }
  next();
};

/**
 * Configure static file serving with proper headers
 */
export const staticFilesConfig = express.static(path.join(__dirname, "..", "uploads"), {
  setHeaders: (res, filePath, stat) => {
    // CRITICAL: Get origin from request - this is essential for CORS
    const req = res.req || res.locals?.req;
    const origin = req?.headers?.origin || req?.get?.('origin');
    const allowedOrigins = getAllowedOrigins();
    
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
      // Production: Strict CORS
      if (origin) {
        if (allowedOrigins.includes(origin)) {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        } else if (origin === "https://paarsiv.vercel.app") {
          res.setHeader("Access-Control-Allow-Origin", origin);
          res.setHeader("Access-Control-Allow-Credentials", "true");
        } else {
          res.setHeader("Access-Control-Allow-Origin", "*");
        }
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
  },
  // Add fallthrough to handle missing files gracefully
  fallthrough: true
});

