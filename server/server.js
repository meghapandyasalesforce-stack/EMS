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

// ✅ CORS configuration - production ready
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "x-csrf-token", "X-Requested-With", "Accept", "Origin"],
    exposedHeaders: ["Set-Cookie"],
    optionsSuccessStatus: 200
  })
);

// ✅ Rate limiting + CSRF
app.use(apiLimiter);
app.use(csrfProtection);

// ✅ Static files
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

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
