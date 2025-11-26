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
    max: LOGIN_RATE_LIMIT_MAX, // Limit each IP to 5 login requests per windowMs
    message: {
        success: false,
        message: 'Too many login attempts, please try again after 15 minutes'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

export const apiLimiter = rateLimit({
    windowMs: DEFAULT_RATE_LIMIT_WINDOW_MS, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? DEFAULT_RATE_LIMIT_MAX_REQUESTS : 1000, // Higher limit for development
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
    max: process.env.NODE_ENV === 'production' ? 200 : 2000,
    message: {
        success: false,
        message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// User-based rate limiter (per authenticated user instead of IP)
export const userLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000,
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
    // Skip rate limiting for certain user roles (e.g., admins)
    skip: (req) => {
        const role = req.user?.role || req.employee?.role;
        return role === 'admin' || role === 'superadmin';
    }
});

// Strict rate limiter for write operations (create, update, delete)
export const writeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 50 : 500,
    message: {
        success: false,
        message: 'Too many write operations, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
        const userId = req.user?._id || req.employee?._id;
        return userId ? `user:${userId}` : req.ip;
    }
});

