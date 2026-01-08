/**
 * Enhanced Error Handler
 * Provides comprehensive error handling with proper logging and user-friendly messages
 */

import logger from './logger.js';

/**
 * Create a standardized error object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 * @param {string} code - Error code
 * @param {Object} details - Additional error details
 * @returns {Object} - Error object
 */
export const createError = (message, statusCode = 500, code = 'INTERNAL_ERROR', details = {}) => {
    const error = new Error(message);
    error.statusCode = statusCode;
    error.code = code;
    error.isCustom = true;
    error.details = details;
    return error;
};

/**
 * Handle manager access errors
 * @param {Object} req - Express request object
 * @param {string} resource - Resource name
 * @param {string} employeeId - Employee ID
 * @returns {Object} - Error object
 */
export const createManagerAccessError = (req, resource, employeeId) => {
    const managerName = req.employee ? `${req.employee.name} ${req.employee.lastName || ''}`.trim() : 'Unknown';
    
    logger.warn('Manager access denied', {
        managerId: req.employee?._id,
        managerName: managerName,
        resource: resource,
        employeeId: employeeId,
        path: req.path,
        method: req.method
    });
    
    return createError(
        `You can only access ${resource} for employees linked to you.`,
        403,
        'MANAGER_ACCESS_DENIED',
        { resource, employeeId }
    );
};

/**
 * Handle organization validation errors
 * @param {Object} req - Express request object
 * @returns {Object} - Error object
 */
export const createOrganizationError = (req) => {
    logger.warn('Organization ID missing', {
        path: req.path,
        method: req.method,
        userId: req.user?._id || req.employee?._id
    });
    
    return createError(
        'Organization ID is required',
        400,
        'MISSING_ORGANIZATION_ID'
    );
};

/**
 * Handle validation errors
 * @param {Array|Object} errors - Validation errors
 * @param {string} message - Error message
 * @returns {Object} - Error object
 */
export const createValidationError = (errors, message = 'Validation failed') => {
    return createError(
        message,
        400,
        'VALIDATION_ERROR',
        { errors: Array.isArray(errors) ? errors : [errors] }
    );
};

/**
 * Handle not found errors
 * @param {string} resource - Resource name
 * @param {string} id - Resource ID
 * @returns {Object} - Error object
 */
export const createNotFoundError = (resource, id = null) => {
    return createError(
        `${resource} not found${id ? ` with ID: ${id}` : ''}`,
        404,
        'NOT_FOUND',
        { resource, id }
    );
};

/**
 * Handle unauthorized errors
 * @param {string} message - Error message
 * @returns {Object} - Error object
 */
export const createUnauthorizedError = (message = 'Unauthorized access') => {
    return createError(
        message,
        401,
        'UNAUTHORIZED'
    );
};

/**
 * Handle forbidden errors
 * @param {string} message - Error message
 * @returns {Object} - Error object
 */
export const createForbiddenError = (message = 'Access forbidden') => {
    return createError(
        message,
        403,
        'FORBIDDEN'
    );
};

/**
 * Enhanced error handler middleware
 * @param {Error} err - Error object
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
export const enhancedErrorHandler = (err, req, res, next) => {
    // Log error with context
    logger.error('Error occurred', {
        message: err.message,
        stack: err.stack,
        code: err.code,
        statusCode: err.statusCode,
        path: req.path,
        method: req.method,
        ip: req.ip,
        user: req.user?._id || req.employee?._id || 'anonymous',
        organizationId: req.organizationId || req.user?.organizationId || req.employee?.organizationId
    });

    // Handle custom errors
    if (err.isCustom) {
        return res.status(err.statusCode || 500).json({
            success: false,
            message: err.message,
            code: err.code,
            details: err.details,
            timestamp: new Date().toISOString()
        });
    }

    // Handle mongoose validation errors
    if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors || {}).map(e => ({
            field: e.path,
            message: e.message
        }));
        return res.status(400).json({
            success: false,
            message: 'Validation Error',
            code: 'VALIDATION_ERROR',
            errors,
            timestamp: new Date().toISOString()
        });
    }

    // Handle mongoose duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0];
        return res.status(400).json({
            success: false,
            message: `Duplicate ${field} value`,
            code: 'DUPLICATE_VALUE',
            field,
            timestamp: new Date().toISOString()
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid authentication token',
            code: 'INVALID_TOKEN',
            timestamp: new Date().toISOString()
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Authentication token expired',
            code: 'TOKEN_EXPIRED',
            timestamp: new Date().toISOString()
        });
    }

    // Handle cast errors (invalid ObjectId)
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            message: 'Invalid ID format',
            code: 'INVALID_ID',
            timestamp: new Date().toISOString()
        });
    }

    // Default error response
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'development' 
        ? err.message 
        : 'An unexpected error occurred';

    return res.status(statusCode).json({
        success: false,
        message,
        code: err.code || 'INTERNAL_ERROR',
        timestamp: new Date().toISOString(),
        ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
};

