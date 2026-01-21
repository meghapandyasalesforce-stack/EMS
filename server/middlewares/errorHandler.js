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
    
    // Sanitize error message in production to prevent information leakage
    let sanitizedMessage = 'An unexpected error occurred';
    if (process.env.NODE_ENV === 'development') {
        sanitizedMessage = err.message || 'Internal server error';
    } else {
        // In production, use generic message for 500 errors
        if (statusCode >= 500) {
            sanitizedMessage = 'Internal server error';
        } else {
            // For client errors (4xx), we can be more specific but still sanitize
            sanitizedMessage = err.message || 'An error occurred';
            
            // SECURITY: Comprehensive sanitization to remove all potential information leakage
            // Remove stack trace snippets (e.g., "at functionName (file.js:123:45)")
            sanitizedMessage = sanitizedMessage.replace(/at\s+[\w\s\.]+\([^)]+\)/g, '');
            sanitizedMessage = sanitizedMessage.replace(/at\s+.*/g, '');
            
            // Remove file paths (absolute and relative)
            sanitizedMessage = sanitizedMessage.replace(/file:\/\/[^\s]+/g, '');
            sanitizedMessage = sanitizedMessage.replace(/\/[^\s]+\.(js|ts|jsx|tsx|mjs|cjs)/g, '');
            sanitizedMessage = sanitizedMessage.replace(/[A-Z]:\\[^\s]+/g, ''); // Windows paths
            
            // Remove line numbers and column numbers
            sanitizedMessage = sanitizedMessage.replace(/:\d+:\d+/g, '');
            sanitizedMessage = sanitizedMessage.replace(/line\s+\d+/gi, '');
            
            // Remove module paths
            sanitizedMessage = sanitizedMessage.replace(/node_modules[^\s]*/g, '');
            sanitizedMessage = sanitizedMessage.replace(/\.\.\/[^\s]*/g, '');
            
            // Remove IP addresses and ports
            sanitizedMessage = sanitizedMessage.replace(/\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?/g, '');
            
            // Remove MongoDB connection strings and database names
            sanitizedMessage = sanitizedMessage.replace(/mongodb:\/\/[^\s]+/gi, '');
            sanitizedMessage = sanitizedMessage.replace(/database:\s*[\w-]+/gi, '');
            
            // Remove environment variable names that might leak config
            sanitizedMessage = sanitizedMessage.replace(/process\.env\.\w+/g, '');
            
            // Clean up multiple spaces and trim
            sanitizedMessage = sanitizedMessage.replace(/\s+/g, ' ').trim();
            
            // If message is empty or too short after sanitization, use generic message
            if (!sanitizedMessage || sanitizedMessage.length < 3) {
                sanitizedMessage = 'An error occurred';
            }
        }
    }
    
    const response = {
        ...errorResponse,
        message: sanitizedMessage,
        code: 'INTERNAL_ERROR'
    };

    // Include stack trace and details only in development
    if (process.env.NODE_ENV === 'development') {
        response.stack = err.stack;
        response.details = err.details;
    }

    // Error Tracking Integration (Sentry)
    // Only track errors in production and for server errors (5xx)
    // Use non-blocking approach - don't wait for Sentry (fire and forget)
    if (process.env.NODE_ENV === 'production' && statusCode >= 500) {
        // Fire and forget - don't block error response
        import('@sentry/node').then(Sentry => {
            if (Sentry && Sentry.default) {
                Sentry.default.captureException(err, {
                    tags: {
                        path: req.path,
                        method: req.method,
                        statusCode: statusCode
                    },
                    user: {
                        id: req.user?._id?.toString() || req.employee?._id?.toString(),
                        organizationId: req.user?.organizationId?.toString() || req.employee?.organizationId?.toString()
                    },
                    extra: {
                        requestId: req.id,
                        ip: req.ip,
                        headers: {
                            'user-agent': req.headers['user-agent'],
                            'content-type': req.headers['content-type']
                        }
                    },
                    level: 'error'
                });
            }
        }).catch(sentryError => {
            // Sentry not configured or import failed - log and continue
            logger.debug('Sentry error tracking not available', {
                error: sentryError.message
            });
        });
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
