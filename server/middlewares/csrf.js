// Simple double-submit CSRF protection
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
    // When Authorization header is present, we accept CSRF token from header
    // This handles cross-site deployments where cookies might not work properly
    if (hasAuthHeader) {
        // If CSRF header is present, allow the request
        // The Authorization header provides authentication, CSRF header provides CSRF protection
        if (csrfHeader) {
            return next();
        }
        // If no CSRF header but Authorization header exists, log warning but allow
        // (Authorization header itself provides some protection)
        console.warn('CSRF: Authorization header present but no CSRF token header. Allowing request (cross-site mode).');
        return next();
    }

    // Priority 2: Cookie-based authentication (same-site scenario)
    // Only validate cookie-based CSRF if no Authorization header is present
    if (hasJwtCookie) {
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
        }
    }

    return next();
}


