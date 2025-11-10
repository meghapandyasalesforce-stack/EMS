/**
 * Standardized API Response Helper
 * Ensures consistent response format across all endpoints
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 * @returns {Object} - Express response
 */
export const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
    const response = {
        success: true,
        message
    };

    if (data !== null) {
        // If data is an object with specific keys, merge them
        if (typeof data === 'object' && !Array.isArray(data) && data.constructor === Object) {
            Object.assign(response, data);
        } else {
            // Otherwise, wrap in a generic key
            response.data = data;
        }
    }

    return res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} code - Error code for client-side handling
 * @param {*} details - Additional error details
 * @returns {Object} - Express response
 */
export const sendError = (res, message, statusCode = 400, code = null, details = null) => {
    const response = {
        success: false,
        message
    };

    if (code) {
        response.code = code;
    }

    if (details) {
        response.details = details;
    }

    // Include error details in development
    if (process.env.NODE_ENV === 'development' && details) {
        response.debug = details;
    }

    return res.status(statusCode).json(response);
};

/**
 * Send validation error response
 * @param {Object} res - Express response object
 * @param {Array|Object} errors - Validation errors
 * @param {string} message - Error message (default: 'Validation failed')
 * @returns {Object} - Express response
 */
export const sendValidationError = (res, errors, message = 'Validation failed') => {
    return res.status(400).json({
        success: false,
        message,
        code: 'VALIDATION_ERROR',
        errors: Array.isArray(errors) ? errors : [errors]
    });
};

/**
 * Send not found error response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name (e.g., 'Employee', 'User')
 * @returns {Object} - Express response
 */
export const sendNotFound = (res, resource = 'Resource') => {
    return res.status(404).json({
        success: false,
        message: `${resource} not found`,
        code: 'NOT_FOUND'
    });
};

/**
 * Send unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Unauthorized')
 * @returns {Object} - Express response
 */
export const sendUnauthorized = (res, message = 'Unauthorized') => {
    return res.status(401).json({
        success: false,
        message,
        code: 'UNAUTHORIZED'
    });
};

/**
 * Send forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Access forbidden')
 * @returns {Object} - Express response
 */
export const sendForbidden = (res, message = 'Access forbidden') => {
    return res.status(403).json({
        success: false,
        message,
        code: 'FORBIDDEN'
    });
};

/**
 * Send internal server error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'Internal server error')
 * @param {Error} error - Error object (for logging)
 * @returns {Object} - Express response
 */
export const sendInternalError = (res, message = 'Internal server error', error = null) => {
    const response = {
        success: false,
        message,
        code: 'INTERNAL_ERROR'
    };

    // Include error details in development
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error.message;
        response.stack = error.stack;
    }

    return res.status(500).json(response);
};

