/**
 * Request Timeout Middleware
 * Prevents hanging requests by setting a maximum request duration
 */

import logger from '../helpers/logger.js';

/**
 * Request timeout middleware
 * @param {number} timeoutMs - Timeout in milliseconds (default: 30 seconds)
 * @returns {Function} Express middleware
 */
export const requestTimeout = (timeoutMs = 30000) => {
    return (req, res, next) => {
        // Set timeout
        const timeout = setTimeout(() => {
            if (!res.headersSent) {
                logger.warn('Request timeout', {
                    path: req.path,
                    method: req.method,
                    timeout: timeoutMs,
                    ip: req.ip,
                    userId: req.user?._id || req.employee?._id
                });
                
                res.status(408).json({
                    success: false,
                    message: 'Request timeout. Please try again.',
                    code: 'REQUEST_TIMEOUT'
                });
                
                // Destroy the request to free up resources
                req.destroy();
            }
        }, timeoutMs);

        // Clear timeout when response is sent
        res.on('finish', () => {
            clearTimeout(timeout);
        });

        // Clear timeout on error
        res.on('close', () => {
            clearTimeout(timeout);
        });

        next();
    };
};

export default requestTimeout;
