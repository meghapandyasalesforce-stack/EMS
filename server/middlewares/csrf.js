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

    // If not authenticated (no JWT cookie), skip CSRF (nothing to protect yet)
    if (!req.cookies?.jwt) {
        return next();
    }

    const csrfCookie = req.cookies?.csrfToken;
    const csrfHeader = req.headers['x-csrf-token'];

    if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return res.status(403).json({ success: false, message: 'Invalid or missing CSRF token' });
    }
    return next();
}


