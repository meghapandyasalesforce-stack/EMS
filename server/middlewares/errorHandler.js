import logger from '../helpers/logger.js';

/**
 * Standardized error handler
 * Provides consistent error responses across all endpoints
 */
export const errorHandler = (err, req, res, next) => {
    // Log error details
    logger.error('Error occurred', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        ip: req.ip,
        user: req.user || req.employee || 'anonymous'
    });

    // Standard error response structure
    const errorResponse = {
        success: false,
        timestamp: new Date().toISOString(),
        path: req.path,
        message: err.message || 'An unexpected error occurred'
    };

    // Handle specific error types
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors || {}).map(e => e.message);
        return res.status(400).json({
            ...errorResponse,
            message: 'Validation Error',
            errors
        });
    }

    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            ...errorResponse,
            message: 'Invalid authentication token',
            code: 'INVALID_TOKEN'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            ...errorResponse,
            message: 'Authentication token expired',
            code: 'TOKEN_EXPIRED'
        });
    }

    // Handle mongoose duplicate key error
    if (err.code === 11000) {
        return res.status(400).json({
            ...errorResponse,
            message: 'Duplicate field value entered',
            field: Object.keys(err.keyValue)[0],
            code: 'DUPLICATE_VALUE'
        });
    }

    // Handle multer file upload errors
    if (err.name === 'MulterError') {
        if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
                ...errorResponse,
                message: 'File size exceeds the maximum allowed limit',
                code: 'FILE_TOO_LARGE'
            });
        }
        if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
                ...errorResponse,
                message: 'Unexpected file field',
                code: 'UNEXPECTED_FILE'
            });
        }
    }

    // Handle cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            ...errorResponse,
            message: 'Invalid ID format',
            code: 'INVALID_ID'
        });
    }

    // Handle custom application errors
    if (err.isCustom) {
        return res.status(err.statusCode || 400).json({
            ...errorResponse,
            message: err.message,
            code: err.code || 'CUSTOM_ERROR',
            details: err.details
        });
    }

    // Default error - hide details in production
    const statusCode = err.statusCode || 500;
    const response = {
        ...errorResponse,
        message: err.message || 'Internal server error',
        code: 'INTERNAL_ERROR'
    };

    // Include stack trace in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.details = err.details;
    }

    res.status(statusCode).json(response);
};

/**
 * Create custom application error
 */
export const createError = (message, statusCode = 400, code = null, details = null) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.isCustom = true;
    error.code = code;
    error.details = details;
    return error;
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
    const error = createError(
        `Route ${req.method} ${req.path} not found`,
        404,
        'ROUTE_NOT_FOUND'
    );
    next(error);
};
