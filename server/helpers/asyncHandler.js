/**
 * Async Handler Wrapper
 * Wraps async route handlers to automatically catch errors
 * This ensures all errors are passed to the error handling middleware
 */

import logger from './logger.js';

/**
 * Wrap an async route handler to catch errors
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped route handler
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch((error) => {
            logger.error('Unhandled async error', {
                error: error.message,
                stack: error.stack,
                path: req.path,
                method: req.method,
                userId: req.user?._id || req.employee?._id,
                organizationId: req.user?.organizationId || req.employee?.organizationId
            });
            next(error);
        });
    };
};

export default asyncHandler;
