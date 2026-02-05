import rateLimit from 'express-rate-limit';
import { 
    DEFAULT_RATE_LIMIT_WINDOW_MS, 
    LOGIN_RATE_LIMIT_MAX,
    PASSWORD_RESET_RATE_LIMIT_MAX,
    PASSWORD_RESET_RATE_LIMIT_WINDOW_MS,
    DEFAULT_RATE_LIMIT_MAX_REQUESTS
} from '../config/constants.js';

export const loginLimiter = rateLimit({
    windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? LOGIN_RATE_LIMIT_MAX : 50, // Higher limit for development (50 vs 5)
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // WARNING: Rate limiting disabled - login endpoint is now unprotected against brute force attacks
    // Always skip rate limiting (no protection)
    skip: () => true
});

export const apiLimiter = rateLimit({
    windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? DEFAULT_RATE_LIMIT_MAX_REQUESTS : 10000, // Much higher limit for development (10k vs 100)
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Skip successful requests from rate limiting (only count errors)
    skipSuccessfulRequests: false,
    // Skip failed requests from rate limiting (count all requests)
    skipFailedRequests: false,
    // SECURITY: Never skip rate limiting in production
    // Only allow skipping in development with explicit flag
    skip: (req) => {
        // Never skip in production - rate limiting is mandatory
        if (process.env.NODE_ENV === 'production') {
            return false;
        }
        // Only allow disabling in development
        return process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

// Rate limiter specifically for password reset endpoints
export const passwordResetLimiter = rateLimit({
    windowMs: PASSWORD_RESET_RATE_LIMIT_WINDOW_MS, // 1 hour
    max: PASSWORD_RESET_RATE_LIMIT_MAX, // Limit to 3 password reset requests per hour per IP
    message: {
        success: false,
        message: 'Too many password reset attempts. Please try again after 1 hour.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
});

// Rate limiter for general API endpoints (more lenient)
export const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 200 : 10000, // Much higher for development
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // SECURITY: Never skip rate limiting in production
    // Only allow skipping in development with explicit flag
    skip: (req) => {
        // Never skip in production - rate limiting is mandatory
        if (process.env.NODE_ENV === 'production') {
            return false;
        }
        // Only allow disabling in development
        return process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

// User-based rate limiter (per authenticated user instead of IP)
export const userLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 10000, // Much higher for development
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use user ID if authenticated, otherwise fall back to IP
    keyGenerator: (req) => {
        const userId = req.user?._id || req.employee?._id || req.organization?._id;
        return userId ? `user:${userId}` : req.ip;
    },
    // Skip rate limiting for certain user roles (e.g., admins) or if disabled in dev
    // SECURITY: Never skip rate limiting in production, even for admins
    skip: (req) => {
        // Never skip in production - rate limiting is mandatory for all users
        if (process.env.NODE_ENV === 'production') {
            return false;
        }
        // In development, allow disabling with explicit flag
        if (process.env.DISABLE_RATE_LIMIT === 'true') {
            return true;
        }
        // Allow admins to skip in development only
        const role = req.user?.role || req.employee?.role;
        return role === 'admin' || role === 'superadmin';
    }
});

// Rate limiter for read operations (GET requests - more lenient)
export const readLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 200 : 10000, // Much higher for development
    message: {
        success: false,
        message: 'Too many read requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?._id || req.employee?._id;
        return userId ? `user:${userId}` : req.ip;
    },
    // SECURITY: Never skip rate limiting in production
    // Only allow skipping in development with explicit flag
    skip: (req) => {
        // Never skip in production - rate limiting is mandatory
        if (process.env.NODE_ENV === 'production') {
            return false;
        }
        // Only allow disabling in development
        return process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

// Strict rate limiter for write operations (create, update, delete)
export const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 50 : 5000, // Much higher for development
    message: {
        success: false,
        message: 'Too many write operations, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?._id || req.employee?._id;
        return userId ? `user:${userId}` : req.ip;
    },
    // SECURITY: Never skip rate limiting in production
    // Only allow skipping in development with explicit flag
    skip: (req) => {
        // Never skip in production - rate limiting is mandatory
        if (process.env.NODE_ENV === 'production') {
            return false;
        }
        // Only allow disabling in development
        return process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

// Attendance check-in rate limiter (5 per hour per user to prevent abuse)
export const attendanceCheckInLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 5 : 50, // 5 check-ins per hour in production
    message: {
        success: false,
        message: 'Too many check-in attempts. Maximum 5 check-ins per hour allowed.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.employee?._id || req.user?._id;
        return userId ? `attendance:checkin:${userId}` : `attendance:checkin:${req.ip}`;
    },
    skip: (req) => {
        return process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

// Attendance check-out rate limiter (5 per hour per user)
export const attendanceCheckOutLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 5 : 50,
    message: {
        success: false,
        message: 'Too many check-out attempts. Maximum 5 check-outs per hour allowed.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.employee?._id || req.user?._id;
        return userId ? `attendance:checkout:${userId}` : `attendance:checkout:${req.ip}`;
    },
    skip: (req) => {
        return process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

// Attendance radius check rate limiter (20 per minute to prevent location spam)
export const attendanceRadiusCheckLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: process.env.NODE_ENV === 'production' ? 20 : 100,
    message: {
        success: false,
        message: 'Too many location checks. Please wait a moment before trying again.'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.employee?._id || req.user?._id;
        return userId ? `attendance:radius:${userId}` : `attendance:radius:${req.ip}`;
    },
    skip: (req) => {
        return process.env.NODE_ENV === 'development' && process.env.DISABLE_RATE_LIMIT === 'true';
    }
});

