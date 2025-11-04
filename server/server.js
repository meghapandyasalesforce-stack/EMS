
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import mongoSanitize from "express-mongo-sanitize";
import xss from "xss-clean";
import connectDB from "./db/database.js";
import {errorHandler, notFoundHandler} from "./middlewares/errorHandler.js";
import requestLogger from "./middlewares/requestLogger.js";
import { apiLimiter } from "./middlewares/rateLimiter.js";
import adminRouter from "./routes/Auth/AdminRoutes.js";
import employeeRouter from "./routes/Auth/EmployeeRoutes.js";
import leaveEmployeeRouter from "./routes/Employee/LeaveEmployeeRoutes.js"
import leaveAdminRouter from "./routes/Admin/LeaveAdminRoutes.js"
import projectRouter from "./routes/Admin/ProjectsRoutes.js"
import attendanceRouter from "./routes/Both/AttendanceRoutes.js"
import payrollRouter from "./routes/Admin/PayrollRoutes.js"
import profileDetailsRouter from "./routes/Employee/ProfileDetailsRoutes.js"
import employeeCalendarRouter from "./routes/Employee/EmployeeCalendarRoutes.js"
import employeePayrollRouter from "./routes/Employee/EmployeePayrollRoutes.js"
import notificationRouter from "./routes/Admin/NotificationRoutes.js"
import uploadRouter from "./routes/Both/UploadRoutes.js"
import forgotPasswordRouter from "./routes/Both/ForgotPasswordRoutes.js"
import taskRouter from "./routes/Both/TaskRoutes.js"
import profilePhotoRouter from "./routes/Both/ProfilePhotoRoutes.js"
import roleRouter from "./routes/Admin/RoleRoutes.js"
import calendarRouter from "./routes/Admin/CalendarRoutes.js"
import idCardRouter from "./routes/Admin/IdCardRoutes.js"
import salaryStructureRouter from "./routes/Admin/SalaryStructureRoutes.js"
import employeeAdminRouter from "./routes/Admin/EmployeeRoutes.js";
import attendanceRuleRouter from "./routes/Admin/AttendanceRuleRoutes.js";
import notificationSettingsRouter from "./routes/Admin/NotificationSettingsRoutes.js";
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import csrfProtection from './middlewares/csrf.js';



const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app  = express();

dotenv.config();

// Validate required environment variables
const requiredEnvVars = ['MONGO_URI', 'JWT_SECRET'];
const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);

if (missingVars.length > 0) {
    console.error('❌ Missing required environment variables:', missingVars.join(', '));
    console.error('Please create a .env file based on env.example');
    process.exit(1);
}

// Additional production environment variable validation
if (process.env.NODE_ENV === 'production') {
  const prodRequired = ['FRONTEND_URL', 'MONGO_URI', 'JWT_SECRET'];
  const missingProd = prodRequired.filter(varName => !process.env[varName]);
  if (missingProd.length > 0) {
    console.error('❌ Missing required production environment variables:', missingProd.join(', '));
    process.exit(1);
  }
}

const PORT = process.env.PORT || 5000

// Request logging middleware (before other middleware)
if (process.env.NODE_ENV !== 'test') {
    app.use(requestLogger);
}

// Trust proxy for correct protocol/secure cookies behind proxies
app.set('trust proxy', 1);

// Basic middleware first
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Security middleware - configure for React app
app.use(helmet({
  // Allow inline scripts/styles for React (can be tightened later)
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));
app.use(mongoSanitize()); // Prevent NoSQL injection attacks
app.use(xss()); // Prevent XSS attacks

// CORS configuration - environment-aware
const allowedOrigins = process.env.NODE_ENV === 'production'
    ? [process.env.FRONTEND_URL].filter(Boolean) // Filter out undefined values
    : ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174'];

// Ensure FRONTEND_URL is set in production
if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL) {
    console.warn('⚠️  Warning: FRONTEND_URL not set in production environment');
}

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps or Postman)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-csrf-token', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Set-Cookie'],
  optionsSuccessStatus: 200
}));

// ========== STATIC FILES FIRST - BEFORE RATE LIMITING AND CSRF ==========
// This MUST be before rate limiting and CSRF to avoid interference
const publicPath = path.join(__dirname, 'public');

// Verify public directory exists
if (!fs.existsSync(publicPath)) {
  console.error(`❌ Public directory not found at: ${publicPath}`);
}

const staticOptions = {
  index: false,
  setHeaders: (res, filePath) => {
    // Set proper MIME types based on file extension
    if (filePath.endsWith('.css')) {
      res.setHeader('Content-Type', 'text/css; charset=utf-8');
    } else if (filePath.endsWith('.js')) {
      res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    } else if (filePath.endsWith('.json')) {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
    } else if (filePath.endsWith('.png')) {
      res.setHeader('Content-Type', 'image/png');
    } else if (filePath.endsWith('.jpg') || filePath.endsWith('.jpeg')) {
      res.setHeader('Content-Type', 'image/jpeg');
    } else if (filePath.endsWith('.svg')) {
      res.setHeader('Content-Type', 'image/svg+xml');
    }
    // Cache static assets
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  }
};

// Explicitly handle /assets/* routes FIRST - before any other middleware that might interfere
app.use('/assets', (req, res, next) => {
  // Skip if not GET request
  if (req.method !== 'GET') {
    return next();
  }
  
  const assetsPath = path.join(publicPath, 'assets');
  // Remove /assets prefix and get the actual file path
  let filePath = req.path.replace(/^\/assets/, '');
  // Ensure path starts with /
  if (!filePath.startsWith('/')) {
    filePath = '/' + filePath;
  }
  // Remove leading slash for path.join
  const actualFilePath = path.join(assetsPath, filePath.replace(/^\//, ''));
  
  // Normalize path to prevent directory traversal
  const normalizedPath = path.normalize(actualFilePath);
  if (!normalizedPath.startsWith(path.resolve(assetsPath))) {
    return res.status(403).type('text/plain').send('Forbidden');
  }
  
  // Check if file exists
  if (!fs.existsSync(normalizedPath) || fs.statSync(normalizedPath).isDirectory()) {
    return res.status(404).type('text/plain').send('File not found');
  }
  
  // Set proper MIME type based on extension
  const ext = path.extname(normalizedPath).toLowerCase();
  let contentType = 'application/octet-stream';
  if (ext === '.css') {
    contentType = 'text/css; charset=utf-8';
  } else if (ext === '.js') {
    contentType = 'application/javascript; charset=utf-8';
  } else if (ext === '.json') {
    contentType = 'application/json; charset=utf-8';
  }
  
  // Set headers BEFORE sending file
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  
  // Send file directly - this prevents error handler from catching it
  res.sendFile(normalizedPath, (err) => {
    if (err && !res.headersSent) {
      // If error sending file, send 404 as plain text
      res.status(404).type('text/plain').send('File not found');
    }
  });
});

// Serve all other static files from the public directory
app.use(express.static(publicPath, staticOptions));

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Rate limiting (AFTER static files to avoid interfering with asset serving)
app.use(apiLimiter);

// CSRF protection (double-submit) for state-changing methods (AFTER static files)
app.use(csrfProtection);

// HTTPS enforcement in production
if (process.env.NODE_ENV === 'production') {
    app.use((req, res, next) => {
        if (req.header('x-forwarded-proto') !== 'https') {
            return res.redirect(`https://${req.header('host')}${req.url}`);
        }
        next();
    });
}

// Additional CORS headers - removed duplicate configuration









// -------- ADMIN ROUTES-------------
app.use("/api/v1/admin/auth",adminRouter);
app.use("/api/v1/admin/leave",leaveAdminRouter);
app.use("/api/v1/admin/project",projectRouter);
app.use("/api/v1/admin/payroll",payrollRouter);
app.use("/api/v1/admin/employee",employeeAdminRouter);
 
// app.use("/api/v1/admin/profile-details",profileDetailsRouter);

// -------- EMPLOYEE ROUTES-------------
app.use("/api/v1/employee/auth",employeeRouter);
app.use("/api/v1/employee/leave",leaveEmployeeRouter);
app.use("/api/v1/employee/calendar",employeeCalendarRouter);
app.use("/api/v1/employee/payroll",employeePayrollRouter);



// ----------------BOTH ROUTES ---------------
app.use("/api/v1/both/attendance",attendanceRouter);
app.use("/api/v1/both/notification",notificationRouter);
app.use("/api/v1/both/profile-details",profileDetailsRouter);
app.use("/api/v1/both/document",uploadRouter);
app.use("/api/v1/both/password",forgotPasswordRouter)
app.use("/api/v1/both/project-task",taskRouter)
app.use("/api/v1/both/profile-photo",profilePhotoRouter)

// ----------------ADMIN ADDITIONAL ROUTES ---------------
app.use("/api/v1/admin/roles",roleRouter);
app.use("/api/v1/admin/calendar",calendarRouter);
app.use("/api/v1/admin/id-cards",idCardRouter);
app.use("/api/v1/admin/salary-structure",salaryStructureRouter);
app.use("/api/v1/admin/attendance-rules",attendanceRuleRouter);
app.use("/api/v1/admin/notification-settings",notificationSettingsRouter);

// Root route - serve frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), (err) => {
    if (err) {
      console.error('Failed to serve index.html:', err);
      res.status(500).json({ error: 'Frontend not available' });
    }
  });
});

// API info route
app.get('/api', (req, res) => {
    res.json({
        success: true,
        message: 'API is running...',
        version: '1.0.0'
    });
});

// Catch-all handler: send back React's index.html file for any non-API routes
// MUST be last, after all other routes and static file serving
app.get('*', (req, res, next) => {
  // Skip if not GET request
  if (req.method !== 'GET') {
    return next();
  }
  
  // Extract path without query parameters
  const requestPath = req.path.split('?')[0];
  
  // IMPORTANT: Skip ALL static asset paths - let express.static handle them or return 404
  // This includes: /assets/*, /uploads/*, files with extensions, etc.
  if (requestPath.startsWith('/api') || 
      requestPath.startsWith('/assets') ||
      requestPath.startsWith('/uploads') ||
      requestPath.match(/\.\w+$/)) { // Any file with extension (css, js, png, etc.)
    // If static middleware didn't serve it, it doesn't exist - return 404
    return next(); // This will go to notFoundHandler
  }
  
  // For all other routes (SPA routes), serve index.html
  const indexPath = path.join(__dirname, 'public', 'index.html');
  
  // Check if index.html exists before sending
  if (!fs.existsSync(indexPath)) {
    console.error('index.html not found at:', indexPath);
    return res.status(500).json({ 
      error: 'Frontend not available',
      path: indexPath 
    });
  }
  
  res.sendFile(indexPath, (err) => {
    if (err) {
      console.error('Failed to send index.html:', err);
      return next();
    }
  });
});

// Handle 404 routes (must be after catch-all)
app.use(notFoundHandler);

//error handler
app.use(errorHandler);

// Connect to database and start server
const startServer = async () => {
  try {
    // Connect to database first
    await connectDB();
    
    // Start server after database connection
    app.listen(PORT, () => {
      console.log(`✅ Server is running on port ${PORT}`);
      console.log(`✅ MongoDB connected successfully`);
      if (process.env.NODE_ENV === 'production') {
        console.log(`✅ Production mode - Frontend: ${process.env.FRONTEND_URL || 'Not set!'}`);
      }
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

