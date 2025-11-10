import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import logger from "../helpers/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Register diagnostic/debug routes
 * These routes help with debugging in development
 * @param {Express} app - Express application instance
 */
export const registerDiagnosticRoutes = (app) => {
  // API health check
  app.get("/api", (req, res) => {
    res.json({
      success: true,
      message: "API is running...",
      version: "1.0.0",
    });
  });

  // Diagnostic endpoint to check uploads directory
  app.get("/api/debug/uploads", (req, res) => {
    try {
      const uploadsBasePath = path.join(__dirname, "..", "uploads");
      const profilePhotosPath = path.join(uploadsBasePath, "profile-photos");
      
      // Check if directories exist
      const baseExists = fs.existsSync(uploadsBasePath);
      const photosExists = fs.existsSync(profilePhotosPath);
      
      let files = [];
      let fileCount = 0;
      
      if (photosExists) {
        files = fs.readdirSync(profilePhotosPath);
        fileCount = files.length;
        
        // Get details for first 10 files
        const fileDetails = files.slice(0, 10).map(filename => {
          const filePath = path.join(profilePhotosPath, filename);
          try {
            const stats = fs.statSync(filePath);
            return {
              filename,
              size: stats.size,
              created: stats.birthtime,
              modified: stats.mtime
            };
          } catch (err) {
            return { filename, error: err.message };
          }
        });
        
        return res.json({
          success: true,
          uploadsBasePath,
          profilePhotosPath,
          baseExists,
          photosExists,
          fileCount,
          sampleFiles: fileDetails,
          message: fileCount > 0 
            ? `Found ${fileCount} files in profile-photos directory`
            : "No files found in profile-photos directory"
        });
      }
      
      res.json({
        success: true,
        uploadsBasePath,
        profilePhotosPath,
        baseExists,
        photosExists,
        fileCount: 0,
        message: "Profile photos directory does not exist"
      });
    } catch (error) {
      logger.error('Diagnostic route error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message,
        stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
      });
    }
  });

  // Check specific file existence
  app.get("/api/debug/file/:filename", (req, res) => {
    try {
      const { filename } = req.params;
      const filePath = path.join(__dirname, "..", "uploads", "profile-photos", filename);
      const exists = fs.existsSync(filePath);
      
      if (exists) {
        const stats = fs.statSync(filePath);
        res.json({
          success: true,
          exists: true,
          filename,
          path: filePath,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
          url: `/uploads/profile-photos/${filename}`
        });
      } else {
        res.json({
          success: true,
          exists: false,
          filename,
          path: filePath,
          message: "File not found on server"
        });
      }
    } catch (error) {
      logger.error('File check error', { error: error.message, stack: error.stack });
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  });
};

