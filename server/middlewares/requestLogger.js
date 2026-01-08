import logger from '../helpers/logger.js';
import { randomUUID } from 'crypto';

/**
 * Request ID middleware - generates unique ID for each request for tracing
 */
export const requestIdMiddleware = (req, res, next) => {
    // Generate or use existing request ID
    req.id = req.headers['x-request-id'] || randomUUID();
    res.setHeader('X-Request-ID', req.id);
    next();
};

/**
 * Request logging middleware
 * Logs all incoming requests for security monitoring and debugging
 */
export const requestLogger = (req, res, next) => {
    const startTime = Date.now();
    
    // Log request details
    const logData = {
        requestId: req.id,
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
    
    // Extra logging for login endpoints to debug 401 issues
    if (req.path === '/login' || req.originalUrl?.includes('/auth/login')) {
        logger.info('Login request detected', {
            originalUrl: req.originalUrl,
            path: req.path,
            method: req.method,
            hasBody: !!req.body,
            bodyKeys: req.body ? Object.keys(req.body) : [],
            contentType: req.get('content-type')
        });
    }

    // Track response time
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        logger.info('Request completed', {
            requestId: req.id,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            duration: `${duration}ms`,
            ip: req.ip,
            role: logData.role
        });

        // Log security concerns - but only for actual security issues
        if (res.statusCode === 401 || res.statusCode === 403) {
            // Only log as security event if:
            // 1. User appeared to be authenticated (had token/cookie)
            // 2. OR it's not a common auth endpoint (login/refresh)
            const isAuthEndpoint = req.path?.includes('/auth/login') || 
                                  req.path?.includes('/auth/refresh-token') ||
                                  req.path?.includes('/auth/register');
            
            const hadAuthAttempt = logData.authenticated || 
                                  req.headers.authorization || 
                                  req.cookies?.jwt;
            
            // Log security event only if:
            // - User had auth credentials but still got 401/403 (potential security issue)
            // - OR it's not an auth endpoint (unexpected 401/403)
            if (hadAuthAttempt || !isAuthEndpoint) {
                logger.warn('Security event', {
                    requestId: req.id,
                    method: req.method,
                    path: req.path,
                    originalUrl: req.originalUrl, // Full URL path
                    statusCode: res.statusCode,
                    ip: req.ip,
                    userAgent: req.get('user-agent'),
                    hadAuthAttempt,
                    body: req.body ? (req.body.email ? { email: req.body.email, hasPassword: !!req.body.password } : '[REDACTED]') : undefined
                });
            }
            // Otherwise, it's just a normal unauthenticated request - log at debug level
            else if (process.env.NODE_ENV === 'development') {
                logger.debug('Unauthenticated request (expected)', {
                    requestId: req.id,
                    path: req.path,
                    statusCode: res.statusCode
                });
            }
        }

        // Log errors
        if (res.statusCode >= 500) {
            logger.error('Server error', {
                requestId: req.id,
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
