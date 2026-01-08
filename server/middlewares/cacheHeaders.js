/**
 * Response Caching Headers Middleware
 * Sets appropriate cache-control headers for different resource types
 */

/**
 * Set cache headers for API responses
 * @param {number} maxAge - Max age in seconds (default: 0 = no cache)
 * @param {boolean} mustRevalidate - Whether to require revalidation
 * @returns {Function} Express middleware
 */
export const setCacheHeaders = (maxAge = 0, mustRevalidate = true) => {
    return (req, res, next) => {
        if (req.method !== 'GET') {
            // Don't cache non-GET requests
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
            return next();
        }

        if (maxAge > 0) {
            let cacheControl = `public, max-age=${maxAge}`;
            if (mustRevalidate) {
                cacheControl += ', must-revalidate';
            }
            res.setHeader('Cache-Control', cacheControl);
            res.setHeader('Vary', 'Accept-Encoding');
        } else {
            // No cache for dynamic content
            res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
            res.setHeader('Pragma', 'no-cache');
            res.setHeader('Expires', '0');
        }

        next();
    };
};

/**
 * Set cache headers for static files
 */
export const staticCacheHeaders = (req, res, next) => {
    if (req.path.startsWith('/uploads/') || req.path.startsWith('/static/')) {
        // Cache static files for 1 year
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
    next();
};

/**
 * Set ETag header for response
 * @param {Object} res - Express response
 * @param {*} data - Response data
 */
export const setETag = (res, data) => {
    const crypto = require('crypto');
    const dataString = JSON.stringify(data);
    const etag = crypto.createHash('md5').update(dataString).digest('hex');
    res.setHeader('ETag', `"${etag}"`);
};

export default {
    setCacheHeaders,
    staticCacheHeaders,
    setETag
};

