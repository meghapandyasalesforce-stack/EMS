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

    // If using Authorization header but no cookie (cross-site scenario)
    // For production cross-site deployments, we'll be more lenient with CSRF
    // The Authorization header itself provides some protection
    if (hasAuthHeader && !hasJwtCookie) {
        // In cross-site scenarios, if CSRF header is present, allow it
        // This is a compromise for cross-site cookie issues
        if (csrfHeader) {
            return next();
        }
        // If no CSRF header, still allow but log warning (for now)
        // In strict production, you might want to require CSRF token endpoint
        console.warn('CSRF: Authorization header present but no CSRF token or cookie. Allowing request (cross-site mode).');
        return next();
    }

    // Standard cookie-based CSRF validation (when cookies are available)
    if (hasJwtCookie) {
        if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
            return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
        }
    }

    return next();
}


