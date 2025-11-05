import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import connectDB from "./db/database.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import requestLogger from "./middlewares/requestLogger.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import adminRouter from "./routes/Auth/AdminRoutes.js";
import employeeRouter from "./routes/Auth/EmployeeRoutes.js";
import leaveEmployeeRouter from "./routes/Employee/LeaveEmployeeRoutes.js";
import leaveAdminRouter from "./routes/Admin/LeaveAdminRoutes.js";
import projectRouter from "./routes/Admin/ProjectsRoutes.js";
import attendanceRouter from "./routes/Both/AttendanceRoutes.js";
import payrollRouter from "./routes/Admin/PayrollRoutes.js";
import profileDetailsRouter from "./routes/Employee/ProfileDetailsRoutes.js";
import employeeCalendarRouter from "./routes/Employee/EmployeeCalendarRoutes.js";
import employeePayrollRouter from "./routes/Employee/EmployeePayrollRoutes.js";
import notificationRouter from "./routes/Admin/NotificationRoutes.js";
import uploadRouter from "./routes/Both/UploadRoutes.js";
import forgotPasswordRouter from "./routes/Both/ForgotPasswordRoutes.js";
import taskRouter from "./routes/Both/TaskRoutes.js";
import profilePhotoRouter from "./routes/Both/ProfilePhotoRoutes.js";
import roleRouter from "./routes/Admin/RoleRoutes.js";
import calendarRouter from "./routes/Admin/CalendarRoutes.js";
import idCardRouter from "./routes/Admin/IdCardRoutes.js";
import salaryStructureRouter from "./routes/Admin/SalaryStructureRoutes.js";
import employeeAdminRouter from "./routes/Admin/EmployeeRoutes.js";
import attendanceRuleRouter from "./routes/Admin/AttendanceRuleRoutes.js";
import notificationSettingsRouter from "./routes/Admin/NotificationSettingsRoutes.js";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import csrfProtection from "./middlewares/csrf.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();

dotenv.config();

// ✅ Don't crash if missing env vars (Render-safe)
const requiredEnvVars = ["MONGO_URI", "JWT_SECRET"];
const missingVars = requiredEnvVars.filter((v) => !process.env[v]);
if (missingVars.length > 0) {
  console.warn("⚠️ Missing env variables:", missingVars.join(", "));
  console.warn("Continuing startup (Render-safe mode)...");
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

// ✅ CORS configuration - production ready (supports multiple origins)
const getAllowedOrigins = () => {
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

app.use(
  cors({
    origin: (origin, callback) => {
      const allowedOrigins = getAllowedOrigins();
      
      // Allow requests with no origin (like mobile apps, Postman, or same-origin requests)
      if (!origin) {
        return callback(null, true);
      }
      
      // Check if origin is in allowed list
      if (allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      
      // In development, allow any origin
      if (process.env.NODE_ENV === 'development') {
        return callback(null, true);
      }
      
      // Reject origin
      callback(new Error('Not allowed by CORS'));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200
  })
);

// ✅ Static files (before rate limiting/CSRF to avoid unnecessary checks)
// Add CORS headers for static file serving - images need CORS to be loaded cross-origin
app.use("/uploads", (req, res, next) => {
  const origin = req.headers.origin;
  const allowedOrigins = getAllowedOrigins();
  
  // Set CORS headers for static files BEFORE serving
  // CRITICAL: Always set CORS headers for images to work with html2canvas and other CORS contexts
  if (origin) {
    // Check if origin is allowed (including Vercel in production)
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
    } else {
      // In production, if origin is not explicitly allowed but is Vercel, allow it
      if (process.env.NODE_ENV === "production" && origin === "https://paarsiv.vercel.app") {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        // Use wildcard for other cases (but never with credentials)
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    }
  } else {
    // No origin header - but in production, allow Vercel explicitly for CORS requests
    // This handles cases where img tag loads without origin, but later CORS request needs it
    if (process.env.NODE_ENV === "production") {
      // Don't set credentials with wildcard - they're incompatible
      res.setHeader("Access-Control-Allow-Origin", "*");
    } else {
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
});

// Serve static files with CORS headers applied
app.use("/uploads", express.static(path.join(__dirname, "uploads"), {
  setHeaders: (res, filePath, stat) => {
    // CRITICAL: Get origin from request - this is essential for CORS
    const req = res.req || res.locals?.req;
    const origin = req?.headers?.origin || req?.get?.('origin');
    const allowedOrigins = getAllowedOrigins();
    
    // Set CORS headers for the file response - MUST match what middleware set
    if (origin) {
      // Check if origin is allowed
      if (allowedOrigins.includes(origin) || process.env.NODE_ENV === "development") {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else if (process.env.NODE_ENV === "production" && origin === "https://paarsiv.vercel.app") {
        // Explicitly allow Vercel origin in production
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Access-Control-Allow-Credentials", "true");
      } else {
        // Use wildcard for other cases (no credentials)
        res.setHeader("Access-Control-Allow-Origin", "*");
      }
    } else {
      // No origin header - use wildcard (no credentials)
      res.setHeader("Access-Control-Allow-Origin", "*");
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
  }
}));

// ✅ Rate limiting + CSRF
app.use(apiLimiter);
app.use(csrfProtection);

// =================== ROUTES ===================
app.use("/api/v1/admin/auth", adminRouter);
app.use("/api/v1/admin/leave", leaveAdminRouter);
app.use("/api/v1/admin/project", projectRouter);
app.use("/api/v1/admin/payroll", payrollRouter);
app.use("/api/v1/admin/employee", employeeAdminRouter);

app.use("/api/v1/employee/auth", employeeRouter);
app.use("/api/v1/employee/leave", leaveEmployeeRouter);
app.use("/api/v1/employee/calendar", employeeCalendarRouter);
app.use("/api/v1/employee/payroll", employeePayrollRouter);

app.use("/api/v1/both/attendance", attendanceRouter);
app.use("/api/v1/both/notification", notificationRouter);
app.use("/api/v1/both/profile-details", profileDetailsRouter);
app.use("/api/v1/both/document", uploadRouter);
app.use("/api/v1/both/password", forgotPasswordRouter);
app.use("/api/v1/both/project-task", taskRouter);
app.use("/api/v1/both/profile-photo", profilePhotoRouter);

app.use("/api/v1/admin/roles", roleRouter);
app.use("/api/v1/admin/calendar", calendarRouter);
app.use("/api/v1/admin/id-cards", idCardRouter);
app.use("/api/v1/admin/salary-structure", salaryStructureRouter);
app.use("/api/v1/admin/attendance-rules", attendanceRuleRouter);
app.use("/api/v1/admin/notification-settings", notificationSettingsRouter);

// ✅ API health check
app.get("/api", (req, res) => {
  res.json({
    success: true,
    message: "API is running...",
    version: "1.0.0",
  });
});

// ✅ Error handlers
app.use(notFoundHandler);
app.use(errorHandler);

// ✅ Start server safely
const startServer = async () => {
  try {
    if (process.env.MONGO_URI) {
      await connectDB();
      console.log("✅ MongoDB connected successfully");
    } else {
      console.warn("⚠️ No MONGO_URI found — skipping DB connection");
    }

    // ✅ Important for Render
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`✅ Server running on port ${PORT}`);
      console.log(`🌍 Mode: ${process.env.NODE_ENV || "development"}`);
      console.log(`🔗 Frontend: ${process.env.FRONTEND_URL || "Not set"}`);
    });
  } catch (err) {
    console.error("❌ Server startup failed:", err.message);
  }
};

startServer();
