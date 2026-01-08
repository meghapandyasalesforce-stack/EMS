/**
 * Endpoint-Specific Rate Limiters
 * Provides granular rate limiting for different API endpoints
 */

import rateLimit from 'express-rate-limit';
import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from '../helpers/logger.js';

// Redis store for rate limiting (if available)
const createRedisStore = () => {
    if (!isRedisConnected()) {
        return undefined; // Fall back to memory store
    }

    try {
        const redis = getRedisClient();
        // Note: express-rate-limit v7+ uses a different store interface
        // For now, we'll use memory store but with Redis key tracking
        return undefined; // Will implement Redis store if needed
    } catch (error) {
        logger.warn('Redis store not available for rate limiting, using memory store', { error: error.message });
        return undefined;
    }
};

/**
 * Create a rate limiter with custom configuration
 * @param {Object} options - Rate limiter options
 * @returns {Function} Rate limiter middleware
 */
const createLimiter = (options) => {
    return rateLimit({
        ...options,
        standardHeaders: true,
        legacyHeaders: false,
        store: createRedisStore(),
        // Custom key generator for authenticated users
        keyGenerator: (req) => {
            const userId = req.user?._id || req.employee?._id;
            if (userId) {
                return `${options.keyPrefix || 'rl'}:${userId}`;
            }
            return `${options.keyPrefix || 'rl'}:${req.ip}`;
        },
        // Skip rate limiting for admins (optional)
        skip: (req) => {
            if (options.skipAdmins) {
                const role = req.user?.role || req.employee?.role;
                return role === 'admin';
            }
            return false;
        }
    });
};

// Employee endpoints - moderate limits
export const employeeListLimiter = createLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 30 : 300,
    message: {
        success: false,
        message: 'Too many requests to employee endpoints. Please try again later.'
    },
    keyPrefix: 'employee',
    skipAdmins: true
});

// Project endpoints - moderate limits
export const projectLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 40 : 400,
    message: {
        success: false,
        message: 'Too many requests to project endpoints. Please try again later.'
    },
    keyPrefix: 'project',
    skipAdmins: true
});

// Payroll endpoints - strict limits (sensitive data)
export const payrollLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 20 : 200,
    message: {
        success: false,
        message: 'Too many requests to payroll endpoints. Please try again later.'
    },
    keyPrefix: 'payroll',
    skipAdmins: false // Even admins are rate limited for payroll
});

// Leave endpoints - moderate limits
export const leaveLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 30 : 300,
    message: {
        success: false,
        message: 'Too many requests to leave endpoints. Please try again later.'
    },
    keyPrefix: 'leave',
    skipAdmins: true
});

// Report endpoints - strict limits (resource intensive)
export const reportLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 10 : 100,
    message: {
        success: false,
        message: 'Too many report generation requests. Please try again later.'
    },
    keyPrefix: 'report',
    skipAdmins: false
});

// File upload endpoints - very strict limits
export const uploadLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 10 : 100,
    message: {
        success: false,
        message: 'Too many file uploads. Please try again later.'
    },
    keyPrefix: 'upload',
    skipAdmins: false
});

// Search endpoints - moderate limits
export const searchLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 50 : 500,
    message: {
        success: false,
        message: 'Too many search requests. Please try again later.'
    },
    keyPrefix: 'search',
    skipAdmins: true
});

// Dashboard endpoints - moderate limits (frequently accessed)
export const dashboardLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 60 : 600,
    message: {
        success: false,
        message: 'Too many dashboard requests. Please try again later.'
    },
    keyPrefix: 'dashboard',
    skipAdmins: true
});

// Export endpoints - strict limits (resource intensive)
export const exportLimiter = createLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: process.env.NODE_ENV === 'production' ? 5 : 50,
    message: {
        success: false,
        message: 'Too many export requests. Please try again later.'
    },
    keyPrefix: 'export',
    skipAdmins: false
});

// Notification endpoints - moderate limits
export const notificationLimiter = createLimiter({
    windowMs: 15 * 60 * 1000,
    max: process.env.NODE_ENV === 'production' ? 40 : 400,
    message: {
        success: false,
        message: 'Too many notification requests. Please try again later.'
    },
    keyPrefix: 'notification',
    skipAdmins: true
});

export default {
    employeeListLimiter,
    projectLimiter,
    payrollLimiter,
    leaveLimiter,
    reportLimiter,
    uploadLimiter,
    searchLimiter,
    dashboardLimiter,
    exportLimiter,
    notificationLimiter
};

