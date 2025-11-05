import crypto from 'crypto';

// Enhanced double-submit CSRF protection with timing-safe comparison
export default function csrfProtection(req, res, next) {
    const method = req.method.toUpperCase();
    if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
        return next();
    }

    // Allowlist unauthenticated/auth endpoints (e.g., login, register, password flows)
    const url = req.originalUrl || req.url;
    const allowlisted = [
        '/api/v1/employee/auth/login',
        '/api/v1/admin/auth/login',
        '/api/v1/employee/auth/register',
        '/api/v1/admin/auth/register',
        '/api/v1/both/password', // forgot/reset password endpoints under this prefix
    ].some((path) => url.startsWith(path));
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
            return res.status(403).json({ 
                success: false, 
                message: 'CSRF token required for authenticated requests',
                code: 'CSRF_TOKEN_REQUIRED'
            });
        }
        // Validate token format (should be 64 hex characters for 32-byte token)
        if (!/^[a-f0-9]{64}$/i.test(csrfHeader)) {
            return res.status(403).json({ 
                success: false, 
                message: 'Invalid CSRF token format',
                code: 'INVALID_CSRF_FORMAT'
            });
        }
        // CSRF token present and valid format, allow the request
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


