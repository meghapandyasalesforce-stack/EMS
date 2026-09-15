/**
 * EMS-Paarsiv Server
 * Main entry point for the Employee Management System backend
 *
 * @module server
 * @description Express server with security middleware, route registration, and database connection
 */

// import dotenv from "dotenv";
// dotenv.config();

// import express from "express";
import './loadEnv.js';

import path from "path";
import { fileURLToPath } from "url";
import express from "express";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import compression from "compression";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import { stashRichHtmlFields, restoreRichHtmlFields } from "./middlewares/preserveRichHtmlFields.js";
import connectDB from "./db/database.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { requestIdMiddleware, requestLogger } from "./middlewares/requestLogger.js";
import requestContextMiddleware from "./middlewares/requestContext.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import validateEnvironment from "./helpers/envValidator.js";
import { corsMiddleware } from "./middlewares/corsConfig.js";
import {
  staticFilesCorsMiddleware,
  staticFilesCheckMiddleware,
  staticFilesConfig,
  staticFiles404Handler
} from "./middlewares/staticFiles.js";
import { registerRoutes } from "./config/routes.js";
import { registerDiagnosticRoutes } from "./config/diagnosticRoutes.js";
import { metricsMiddleware, getMetrics, isMetricsEnabled } from "./monitoring/prometheus.js";
import csrfProtection from "./middlewares/csrf.js";
import { requestTimeout } from "./middlewares/requestTimeout.js";
import { staticCacheHeaders } from "./middlewares/cacheHeaders.js";
import { setOrganizationContext } from "./middlewares/organizationIsolation.js";
import {
  sanitizeClientOrganizationId,
  requireTenantContext,
  requireActiveSubscription,
} from "./middlewares/tenantMiddleware.js";
import logger from "./helpers/logger.js";

// Initialize centralized notification event registry
import './helpers/notificationEventRegistry.js';
// Isolated Birthday & Anniversary v2 event registry
import './helpers/celebrationEventRegistry.js';
import { startCelebrationNotificationScheduler } from './helpers/celebrationNotificationScheduler.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();

import pushRouter from './routes/push.js';
app.use('/api/push', pushRouter);

// ✅ Validate environment variables
const isValid = validateEnvironment();
if (!isValid && process.env.NODE_ENV === 'production') {
  logger.error("Critical environment variables missing. Exiting...");
  process.exit(1);
}

// ✅ CRITICAL SECURITY: Prevent rate limiting from being disabled in production
// This check ensures that even if DISABLE_RATE_LIMIT is accidentally set in production,
// the server will refuse to start. Rate limiting is mandatory for production security.
if (process.env.NODE_ENV === 'production') {
  if (process.env.DISABLE_RATE_LIMIT === 'true') {
    logger.error("CRITICAL SECURITY ERROR: Rate limiting cannot be disabled in production. Exiting...");
    logger.error("Please remove DISABLE_RATE_LIMIT from your production environment variables.");
    process.exit(1);
  }
  // Also check for case-insensitive variations
  if (process.env.DISABLE_RATE_LIMIT?.toLowerCase() === 'true') {
    logger.error("CRITICAL SECURITY ERROR: Rate limiting cannot be disabled in production. Exiting...");
    process.exit(1);
  }
}

const PORT = process.env.PORT || 10000;

// ✅ Request ID middleware (must be first to track all requests)
app.use(requestIdMiddleware);
app.use(requestContextMiddleware);

// ✅ Metrics middleware (HTTP request metrics) - safe no-op if prom-client is not installed
if (isMetricsEnabled()) {
  app.use(metricsMiddleware);
}

// ✅ Logger (except tests)
if (process.env.NODE_ENV !== "test") app.use(requestLogger);
app.set("trust proxy", 1);

// ✅ Compression middleware (should be early in the middleware stack)
app.use(compression({
  filter: (req, res) => {
    // Don't compress responses if client doesn't support it
    if (req.headers['x-no-compression']) {
      return false;
    }
    // Use compression for all other requests
    return compression.filter(req, res);
  },
  level: 6, // Compression level (0-9, 6 is a good balance)
  threshold: 1024, // Only compress responses larger than 1KB
}));

// ✅ Basic middleware
app.use(express.json({
  limit: "10mb",
  verify: (req, _res, buf) => {
    // Preserve raw body for HMAC webhook verification (DocuSign Connect, etc.)
    if (req.originalUrl?.includes('/webhooks/esign/') || req.url?.includes('/webhooks/esign/')) {
      req.rawBody = Buffer.from(buf);
    }
  },
}));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));
app.use(cookieParser());

// ✅ Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'"],
        fontSrc: ["'self'", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true
    },
    frameguard: { action: 'deny' },
    noSniff: true,
    xssFilter: true,
  })
);
app.use(mongoSanitize());
app.use(stashRichHtmlFields);
app.use(xss());
app.use(restoreRichHtmlFields);

// ✅ CORS configuration
app.use(corsMiddleware);

// ✅ Static files (MUST be before organization isolation and other middleware)
// This ensures static file requests are handled before they reach route handlers
// CRITICAL: Static files must be registered early to prevent route conflicts

// Serve public directory at root level for logo.png and other public assets
app.use(
  express.static(path.join(__dirname, "public"), {
    maxAge: "1d",
    fallthrough: true,
    setHeaders: (res) => {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Cache-Control", "public, max-age=86400");
    },
  })
);

// Serve uploads directory with custom middleware
app.use("/uploads", staticFilesCorsMiddleware);
app.use("/uploads", staticFilesCheckMiddleware, staticFilesConfig);
// Handle 404s for missing static files (after express.static, before route handlers)
app.use("/uploads", staticFiles404Handler);
app.use(staticCacheHeaders); // Add cache headers for static files

// ✅ Request timeout (prevent hanging requests)
// Skip timeout for static file requests to allow large file downloads
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  requestTimeout(parseInt(process.env.REQUEST_TIMEOUT_MS || '30000'))(req, res, next);
});

// ✅ Rate limiting + CSRF (skip for static files - already handled above)
app.use((req, res, next) => {
  // Skip rate limiting for static file requests
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  apiLimiter(req, res, next);
});
app.use((req, res, next) => {
  // Skip CSRF for static file requests
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  csrfProtection(req, res, next);
});

// ✅ Organization isolation (set context for all authenticated requests)
// CRITICAL: Skip for static file requests to prevent 404 errors
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  sanitizeClientOrganizationId(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  setOrganizationContext(req, res, next);
});
// SaaS tenant pipeline (subscription + features on req.tenant)
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  requireTenantContext(req, res, next);
});
app.use((req, res, next) => {
  if (req.path.startsWith('/uploads/') || req.path.startsWith('/logo') || req.path.startsWith('/favicon')) {
    return next();
  }
  requireActiveSubscription(req, res, next);
});

// =================== ROUTES ===================
registerRoutes(app);
registerDiagnosticRoutes(app);

// ✅ Root Route
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Welcome to EMS-Paarsiv API",
    status: "active",
    version: "1.0.0",
    documentation: "/api-docs",
    health: "/api/health",
    metrics: process.env.ENABLE_METRICS === 'true' ? "/metrics" : undefined
  });
});

// ✅ Prometheus Metrics Endpoint (enabled only when explicitly configured)
if (process.env.ENABLE_METRICS === 'true') {
  // Expose /metrics for Prometheus scraping
  app.get("/metrics", getMetrics);
}

// =================== API DOCUMENTATION ===================
// Swagger/OpenAPI documentation - enabled by default, can be disabled via ENABLE_SWAGGER=false
// Note: Swagger initialization moved to startServer() to avoid top-level await

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
      try {
        const Employee = (await import('./models/employee.model.js')).default;
        const { dropGlobalEmployeeIdUniqueIndex } = await import('./helpers/employeeIdHelper.js');
        await dropGlobalEmployeeIdUniqueIndex(Employee);
      } catch (indexError) {
        logger.warn('Employee ID index migration skipped', { error: indexError.message });
      }
    } else {
      logger.warn("No MONGO_URI found — skipping DB connection");
    }

    // Initialize i18n (non-blocking)
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { initI18n } = await import('./config/i18n.js');
        await initI18n();
      } catch (i18nError) {
        logger.warn('i18n initialization failed - continuing with default language', { error: i18nError.message });
      }
    }

    // Initialize Sentry error tracking (non-blocking)
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { initSentry } = await import('./config/sentry.js');
        await initSentry();
      } catch (sentryError) {
        logger.debug('Sentry initialization skipped', { error: sentryError.message });
      }
    }

    // Initialize Redis (non-blocking)
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { initRedis } = await import('./config/redis.js');
        await initRedis();
      } catch (redisError) {
        logger.warn('Redis initialization failed - continuing without cache', { error: redisError.message });
      }

      // Initialize job workers
      try {
        const { initializeWorkers } = await import('./jobs/index.js');
        initializeWorkers();
      } catch (workerError) {
        logger.warn('Job workers initialization failed - continuing without background jobs', { error: workerError.message });
      }
    }

    // Validate email configuration (non-blocking)
    if (process.env.NODE_ENV !== 'test') {
      try {
        const { validateEmailConfig } = await import('./helpers/emailValidator.js');
        const emailValidation = await validateEmailConfig();
        if (emailValidation.valid) {
          logger.info('Email configuration validated successfully', emailValidation.details);
        } else {
          logger.warn('Email configuration validation failed', {
            message: emailValidation.message,
            recommendation: emailValidation.recommendation,
            error: emailValidation.error
          });
          logger.warn('Welcome emails will not be sent until email configuration is fixed.');
          logger.warn('See EMAIL_TROUBLESHOOTING.md for help.');
        }
      } catch (emailError) {
        logger.warn('Could not validate email configuration', { error: emailError.message });
      }
    }

    // Initialize Swagger API documentation (non-blocking)
    const enableSwagger = process.env.ENABLE_SWAGGER !== 'false';
    if (enableSwagger) {
      try {
        const { swaggerUiSetup, swaggerUiServe } = await import('./config/swagger.js');
        app.use('/api-docs', swaggerUiServe, swaggerUiSetup);
        logger.info('Swagger API documentation available at /api-docs');
      } catch (swaggerError) {
        logger.warn('Swagger documentation not available', { error: swaggerError.message });
      }
    } else {
      logger.info('Swagger documentation disabled via ENABLE_SWAGGER=false');
    }

    // ✅ Important for Render - listen on 0.0.0.0 to accept connections from all interfaces
    const server = app.listen(PORT, "0.0.0.0", () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Mode: ${process.env.NODE_ENV || "development"}`);
      logger.info(`Frontend: ${process.env.FRONTEND_URL || "Not set"}`);
    });

    // Initialize WebSocket server
    try {
      const { initializeWebSocket } = await import('./config/websocket.js');
      initializeWebSocket(server);
      logger.info('WebSocket server initialized');
    } catch (wsError) {
      logger.warn('WebSocket server initialization failed - continuing without WebSocket', {
        error: wsError.message
      });
    }

    // ✅ Graceful shutdown handling
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        // Close job queues and workers
        try {
          const { closeAll } = await import('./config/queue.js');
          await closeAll();
        } catch (error) {
          logger.error('Error closing job queues', { error: error.message });
        }

        // Close WebSocket server
        try {
          const { getIO } = await import('./config/websocket.js');
          const io = getIO();
          if (io) {
            io.close();
            logger.info('WebSocket server closed');
          }
        } catch (error) {
          logger.error('Error closing WebSocket server', { error: error.message });
        }

        // Close Redis connection
        try {
          const { closeRedis } = await import('./config/redis.js');
          await closeRedis();
        } catch (error) {
          logger.error('Error closing Redis connection', { error: error.message });
        }

        // Close database connection
        try {
          const mongoose = (await import("mongoose")).default;
          if (mongoose.connection.readyState === 1) {
            await mongoose.connection.close();
            logger.info('MongoDB connection closed');
          }
        } catch (error) {
          logger.error('Error closing MongoDB connection', { error: error.message });
        }

        logger.info('Graceful shutdown completed');
        process.exit(0);
      });

      // Force shutdown after 10 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 10000);
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
      gracefulShutdown('unhandledRejection');
    });

    return server;
  } catch (err) {
    logger.error("Server startup failed", { error: err.message, stack: err.stack });
    process.exit(1);
  }
};

// Start the server
startServer();
