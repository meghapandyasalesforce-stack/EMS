/**
 * EMS-Paarsiv Server
 * Main entry point for the Employee Management System backend
 * 
 * @module server
 * @description Express server with security middleware, route registration, and database connection
 */

import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import connectDB from "./db/database.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import requestLogger from "./middlewares/requestLogger.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import validateEnvironment from "./helpers/envValidator.js";
import { corsMiddleware } from "./middlewares/corsConfig.js";
import { 
  staticFilesCorsMiddleware, 
  staticFilesCheckMiddleware, 
  staticFilesConfig 
} from "./middlewares/staticFiles.js";
import { registerRoutes } from "./config/routes.js";
import { registerDiagnosticRoutes } from "./config/diagnosticRoutes.js";
import csrfProtection from "./middlewares/csrf.js";
import logger from "./helpers/logger.js";

const app = express();

dotenv.config();

// ✅ Validate environment variables
const isValid = validateEnvironment();
if (!isValid && process.env.NODE_ENV === 'production') {
  logger.error("Critical environment variables missing. Exiting...");
  process.exit(1);
}

const PORT = process.env.PORT || 10000;

// ✅ Logger (except tests)
if (process.env.NODE_ENV !== "test") app.use(requestLogger);
app.set("trust proxy", 1);

// ✅ Basic middleware
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ✅ Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);
app.use(mongoSanitize());
app.use(xss());

// ✅ CORS configuration
app.use(corsMiddleware);

// ✅ Static files (before rate limiting/CSRF to avoid unnecessary checks)
app.use("/uploads", staticFilesCorsMiddleware);
app.use("/uploads", staticFilesCheckMiddleware, staticFilesConfig);

// ✅ Rate limiting + CSRF
app.use(apiLimiter);
app.use(csrfProtection);

// =================== ROUTES ===================
registerRoutes(app);
registerDiagnosticRoutes(app);

// ✅ Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

/**
 * Start the Express server
 * Connects to MongoDB and starts listening on the configured port
 * @async
 * @function startServer
 */
const startServer = async () => {
  try {
    if (process.env.MONGO_URI) {
      await connectDB();
      logger.info("MongoDB connected successfully");
    } else {
      logger.warn("No MONGO_URI found — skipping DB connection");
    }

    // ✅ Important for Render - listen on 0.0.0.0 to accept connections from all interfaces
    app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Mode: ${process.env.NODE_ENV || "development"}`);
      logger.info(`Frontend: ${process.env.FRONTEND_URL || "Not set"}`);
    });
  } catch (err) {
    logger.error("Server startup failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

// Start the server
startServer();
