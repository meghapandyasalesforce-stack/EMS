/**
 * Standardized API Response Helper
 * Ensures consistent response format across all endpoints
 * Uses i18n for internationalization
 */

import { translate } from '../config/i18n.js';

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message (can be translation key)
 * @param {number} statusCode - HTTP status code (default: 200)
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendSuccess = (res, data = null, message = 'success', statusCode = 200, lng = null) => {
    // Try to translate message, fallback to original if translation fails
    const translatedMessage = translate(`messages.${message}`, {}, lng) || translate(`common.${message}`, {}, lng) || message;
    const response = {
        success: true,
        message: translatedMessage
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
 * @param {string} message - Error message (can be translation key)
 * @param {number} statusCode - HTTP status code (default: 400)
 * @param {string} code - Error code for client-side handling
 * @param {*} details - Additional error details
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendError = (res, message, statusCode = 400, code = null, details = null, lng = null) => {
    // Try to translate error message
    const translatedMessage = code 
        ? (translate(`errors.${code}`, {}, lng) || translate(`errors.${message}`, {}, lng) || message)
        : (translate(`errors.${message}`, {}, lng) || message);
    
    const response = {
        success: false,
        message: translatedMessage
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
 * @param {string} message - Error message (default: 'VALIDATION_ERROR')
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendValidationError = (res, errors, message = 'VALIDATION_ERROR', lng = null) => {
    const translatedMessage = translate(`errors.${message}`, {}, lng) || translate('errors.VALIDATION_ERROR', {}, lng) || 'Validation failed';
    return res.status(400).json({
        success: false,
        message: translatedMessage,
        code: 'VALIDATION_ERROR',
        errors: Array.isArray(errors) ? errors : [errors]
    });
};

/**
 * Send not found error response
 * @param {Object} res - Express response object
 * @param {string} resource - Resource name (e.g., 'Employee', 'User')
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendNotFound = (res, resource = 'Resource', lng = null) => {
    const translatedMessage = translate('errors.NOT_FOUND', { resource }, lng) || `${resource} not found`;
    return res.status(404).json({
        success: false,
        message: translatedMessage,
        code: 'NOT_FOUND'
    });
};

/**
 * Send unauthorized error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'UNAUTHORIZED')
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendUnauthorized = (res, message = 'UNAUTHORIZED', lng = null) => {
    const translatedMessage = translate(`errors.${message}`, {}, lng) || translate('errors.UNAUTHORIZED', {}, lng) || 'Unauthorized';
    return res.status(401).json({
        success: false,
        message: translatedMessage,
        code: 'UNAUTHORIZED'
    });
};

/**
 * Send forbidden error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'FORBIDDEN')
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendForbidden = (res, message = 'FORBIDDEN', lng = null) => {
    const translatedMessage = translate(`errors.${message}`, {}, lng) || translate('errors.FORBIDDEN', {}, lng) || 'Access forbidden';
    return res.status(403).json({
        success: false,
        message: translatedMessage,
        code: 'FORBIDDEN'
    });
};

/**
 * Send internal server error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message (default: 'INTERNAL_ERROR')
 * @param {Error} error - Error object (for logging)
 * @param {string} lng - Language code (optional)
 * @returns {Object} - Express response
 */
export const sendInternalError = (res, message = 'INTERNAL_ERROR', error = null, lng = null) => {
    const translatedMessage = translate(`errors.${message}`, {}, lng) || translate('errors.INTERNAL_ERROR', {}, lng) || 'Internal server error';
    const response = {
        success: false,
        message: translatedMessage,
        code: 'INTERNAL_ERROR'
    };

    // Include error details in development
    if (process.env.NODE_ENV === 'development' && error) {
        response.error = error.message;
        response.stack = error.stack;
    }

    return res.status(500).json(response);
};

