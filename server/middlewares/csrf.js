import crypto from 'crypto';
import { verifyToken } from './authHelpers.js';
import { getCsrfToken } from '../helpers/csrfTokenStore.js';
import logger from '../helpers/logger.js';

// Enhanced double-submit CSRF protection with timing-safe comparison
export default async function csrfProtection(req, res, next) {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
    }

    // Allowlist unauthenticated/auth endpoints (e.g., login, register, password flows)
    const url = req.originalUrl || req.url || '';
    // Normalize URL - remove query strings and ensure consistent format
    const normalizedUrl = url.split('?')[0];
    
    const allowlisted = [
        '/api/v1/employee/auth/login',
        '/api/v1/admin/auth/login',
        '/api/v1/both/auth/login', // Unified login (must work even when stale session cookies exist)
        '/api/v1/employee/auth/register',
        '/api/v1/admin/auth/register',
        '/api/v1/organization/auth/register',
        '/api/v1/organization/auth/login',
        '/api/v1/employee/auth/refresh-token', // Refresh token endpoint (no CSRF needed)
        '/api/v1/admin/auth/refresh-token', // Refresh token endpoint (no CSRF needed)
        '/api/v1/both/password', // forgot/reset password endpoints under this prefix
    ].some((path) => normalizedUrl.startsWith(path));
    
    if (allowlisted) {
        return next();
    }

    // If not authenticated (no JWT cookie or Authorization header), skip CSRF (nothing to protect yet)
    const hasJwtCookie = !!req.cookies?.jwt;
    const hasAuthHeader = req.headers.authorization && req.headers.authorization.startsWith('Bearer ');
    
    if (!hasJwtCookie && !hasAuthHeader) {
        return next();
    }

    const csrfCookie = req.cookies?.csrfToken;
    const csrfHeader = req.headers['x-csrf-token'];

    // Priority 1: If using Authorization header (cross-site scenario)
    // When Authorization header is present, we still require CSRF token from header
    // This handles cross-site deployments where cookies might not work properly
    // Security: CSRF protection is mandatory for all authenticated state-changing requests
    if (hasAuthHeader) {
        // CSRF header is required - Authorization header alone is not sufficient
        if (!csrfHeader) {
            logger.warn('CSRF token missing in header for authenticated request', { requestId: req.id, path: req.path });
            return res.status(403).json({ 
                success: false, 
                message: 'CSRF token required for authenticated requests',
                code: 'CSRF_TOKEN_REQUIRED'
            });
        }
        // Validate token format (should be 64 hex characters for 32-byte token)
        if (!/^[a-f0-9]{64}$/i.test(csrfHeader)) {
            logger.warn('Invalid CSRF token format in header', { requestId: req.id, path: req.path });
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid CSRF token format',
                code: 'INVALID_CSRF_FORMAT'
            });
        }
        
        // SECURITY ENHANCEMENT: Validate token was issued by our server
        try {
            const token = req.headers.authorization.replace('Bearer ', '');
            const decoded = verifyToken(token); // This will throw if token is invalid/expired
            const userId = decoded.userId;
            
            const storedCsrfToken = await getCsrfToken(userId.toString());
            
            if (!storedCsrfToken || csrfHeader.length !== storedCsrfToken.length || !crypto.timingSafeEqual(Buffer.from(csrfHeader), Buffer.from(storedCsrfToken))) {
                logger.warn('Invalid or mismatched CSRF token (Authorization header scenario)', { 
                    requestId: req.id, 
                    path: req.path, 
                    userId,
                    hasStoredToken: !!storedCsrfToken
                });
                return res.status(403).json({ 
                    success: false, 
                    message: 'Invalid or mismatched CSRF token',
                    code: 'CSRF_TOKEN_MISMATCH'
                });
            }
        } catch (error) {
            // If JWT is invalid, reject the request - don't bypass CSRF protection
            // CSRF protection must be enforced for all authenticated requests
            logger.warn('CSRF validation failed during token decoding', { 
                requestId: req.id, 
                path: req.path, 
                error: error.message,
                errorName: error.name
            });
            return res.status(403).json({ 
                success: false, 
                message: 'CSRF validation failed. Invalid or expired authentication token.',
                code: 'CSRF_VALIDATION_ERROR'
            });
        }
        return next();
    }

    // Priority 2: Cookie-based authentication (same-site scenario)
    // Only validate cookie-based CSRF if no Authorization header is present
    if (hasJwtCookie) {
        if (!csrfCookie || !csrfHeader) {
            return res.status(403).json({ 
                success: false, 
                message: 'CSRF token required for authenticated requests',
                code: 'CSRF_TOKEN_MISSING'
            });
        }
        // Validate token format
        if (!/^[a-f0-9]{64}$/i.test(csrfHeader) || !/^[a-f0-9]{64}$/i.test(csrfCookie)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid CSRF token format',
                code: 'INVALID_CSRF_FORMAT'
            });
        }
        // Use constant-time comparison to prevent timing attacks
        if (csrfCookie.length !== csrfHeader.length || !crypto.timingSafeEqual(Buffer.from(csrfCookie), Buffer.from(csrfHeader))) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid or mismatched CSRF token',
                code: 'CSRF_TOKEN_MISMATCH'
            });
        }
    }

    return next();
}


