/**
 * HTTPS Enforcement Middleware
 * Redirects HTTP requests to HTTPS in production
 */

import logger from '../helpers/logger.js';

/**
 * Middleware to enforce HTTPS
 * Redirects HTTP to HTTPS in production environments
 */
export const enforceHTTPS = (req, res, next) => {
    // Skip HTTPS enforcement in development, test, or if explicitly disabled
    if (
        process.env.NODE_ENV === 'development' ||
        process.env.NODE_ENV === 'test' ||
        process.env.DISABLE_HTTPS_REDIRECT === 'true'
    ) {
        return next();
    }

    // Check if request is already HTTPS
    const isSecure = req.secure || 
                     req.headers['x-forwarded-proto'] === 'https' ||
                     req.headers['x-forwarded-ssl'] === 'on';

    if (isSecure) {
        return next();
    }

    // Redirect to HTTPS
    const host = req.get('host');
    const url = req.originalUrl || req.url;
    const httpsUrl = `https://${host}${url}`;

    logger.info('Redirecting HTTP to HTTPS', {
        originalUrl: req.url,
        httpsUrl,
        ip: req.ip
    });

    return res.redirect(301, httpsUrl);
};

/**
 * Middleware to set HSTS (HTTP Strict Transport Security) headers
 */
export const setHSTSHeaders = (req, res, next) => {
    // Only set HSTS in production
    if (process.env.NODE_ENV === 'production' && req.secure) {
        const maxAge = parseInt(process.env.HSTS_MAX_AGE || '31536000', 10); // 1 year default
        const includeSubDomains = process.env.HSTS_INCLUDE_SUBDOMAINS !== 'false';
        
        let hstsHeader = `max-age=${maxAge}`;
        if (includeSubDomains) {
            hstsHeader += '; includeSubDomains';
        }
        if (process.env.HSTS_PRELOAD === 'true') {
            hstsHeader += '; preload';
        }

        res.setHeader('Strict-Transport-Security', hstsHeader);
    }

    next();
};

export default {
    enforceHTTPS,
    setHSTSHeaders
};

