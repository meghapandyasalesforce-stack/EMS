import logger from '../helpers/logger.js';

/**
 * Request logging middleware
 * Logs all incoming requests for security monitoring and debugging
 */
export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Log request details
    const logData = {
        timestamp: new Date().toISOString(),
        method: req.method,
        path: req.path,
        ip: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent'),
        origin: req.get('origin'),
        referer: req.get('referer'),
        contentType: req.get('content-type'),
        contentLength: req.get('content-length'),
        authenticated: !!(req.cookies?.jwt) || !!req.headers.authorization,
        role: req.user?.role || req.employee?.role || 'anonymous'
    };

    // Log sensitive data only in development
    if (process.env.NODE_ENV === 'development') {
        if (req.body && Object.keys(req.body).length > 0) {
            logData.body = { ...req.body };
            // Mask sensitive fields
            if (logData.body.password) logData.body.password = '[REDACTED]';
            if (logData.body.token) logData.body.token = '[REDACTED]';
            if (logData.body.jwt) logData.body.jwt = '[REDACTED]';
        }
        if (req.params && Object.keys(req.params).length > 0) {
            logData.params = req.params;
        }
        if (req.query && Object.keys(req.query).length > 0) {
            logData.query = req.query;
        }
    }

    // Log the request
    logger.info('Incoming request', logData);

    // Track response time
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        logger.info('Request completed', {
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            role: logData.role
        });

        // Log security concerns
        if (res.statusCode === 401 || res.statusCode === 403) {
            logger.warn('Security event', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });
        }

        // Log errors
        if (res.statusCode >= 500) {
            logger.error('Server error', {
                method: req.method,
                path: req.path,
                statusCode: res.statusCode,
                duration: `${duration}ms`,
                ip: req.ip
            });
        }
    });

    next();
};

/**
 * Security event logging
 * Logs specific security-related events
 */
export const logSecurityEvent = (eventType, details, req) => {
    logger.warn('Security event detected', {
        eventType,
        timestamp: new Date().toISOString(),
        ip: req?.ip || 'unknown',
        userAgent: req?.get('user-agent') || 'unknown',
        path: req?.path || 'unknown',
        details
    });
};

export default requestLogger;
