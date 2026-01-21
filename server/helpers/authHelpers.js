/**
 * Authentication Helper Functions
 * Shared utilities for login, logout, and account security
 */

import logger from './logger.js';

/**
 * Normalize email address (lowercase and trim)
 * @param {string} email - Email address to normalize
 * @returns {string} Normalized email address
 */
export const normalizeEmail = (email) => {
    if (!email || typeof email !== 'string') {
        return null;
    }
    return email.toLowerCase().trim();
};

/**
 * Get cookie options for authentication cookies
 * @param {Object} req - Express request object (optional, for request ID)
 * @returns {Object} Cookie options
 */
export const getCookieOptions = (req = null) => {
    const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
    const options = {
        httpOnly: true,
        sameSite: crossSite ? 'none' : 'lax',
        secure: crossSite || process.env.NODE_ENV === 'production',
        path: '/',
    };

    // For production with custom domain
    if (process.env.NODE_ENV === 'production' && process.env.DOMAIN) {
        options.domain = process.env.DOMAIN;
    }

    return options;
};

/**
 * Get CSRF cookie options (not httpOnly)
 * @returns {Object} CSRF cookie options
 */
export const getCsrfCookieOptions = () => {
    const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
    const options = {
        httpOnly: false, // CSRF token must be accessible to JavaScript
        sameSite: crossSite ? 'none' : 'lax',
        secure: crossSite || process.env.NODE_ENV === 'production',
        path: '/',
    };

    if (process.env.NODE_ENV === 'production' && process.env.DOMAIN) {
        options.domain = process.env.DOMAIN;
    }

    return options;
};

/**
 * Clear all authentication cookies and CSRF tokens
 * @param {Object} res - Express response object
 * @param {Object} req - Express request object (optional, for logging and user ID)
 */
export const clearAuthCookies = async (res, req = null) => {
    const cookieOptions = getCookieOptions();
    const csrfCookieOptions = getCsrfCookieOptions();

    res.clearCookie('jwt', cookieOptions);
    res.clearCookie('refreshToken', cookieOptions);
    res.clearCookie('csrfToken', csrfCookieOptions);
    res.clearCookie('role', csrfCookieOptions);
    res.clearCookie('refreshTokenPresent', csrfCookieOptions);

    // SECURITY: Delete CSRF token from server-side store
    if (req && (req.user?._id || req.employee?._id)) {
        try {
            const { deleteCsrfToken } = await import('../helpers/csrfTokenStore.js');
            const userId = req.user?._id || req.employee?._id;
            await deleteCsrfToken(userId.toString());
            logger.debug('CSRF token deleted from store', { requestId: req.id, userId });
        } catch (error) {
            logger.error('Failed to delete CSRF token from store', { requestId: req.id, error: error.message });
        }
    }

    if (req) {
        logger.debug('Auth cookies cleared', { requestId: req.id });
    }
};

/**
 * Check if account is locked
 * @param {Object} user - User or Employee model instance
 * @returns {boolean} True if account is locked
 */
export const isAccountLocked = (user) => {
    if (!user.lockUntil || !user.loginAttempts) {
        return false;
    }
    
    // Check if lock has expired
    if (user.lockUntil < Date.now()) {
        return false; // Lock expired
    }
    
    return user.loginAttempts >= 5; // Account is locked
};

/**
 * Handle failed login attempt
 * @param {Object} user - User or Employee model instance
 * @returns {Promise<Object>} Updated user with lock information
 */
export const handleFailedLogin = async (user) => {
    const maxAttempts = 5;
    const lockTime = 15 * 60 * 1000; // 15 minutes

    // If account is already locked and lock hasn't expired, don't update
    if (user.lockUntil && user.lockUntil > Date.now()) {
        return user;
    }

    // Reset attempts if lock expired
    if (user.lockUntil && user.lockUntil < Date.now()) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
    }

    // Increment login attempts
    user.loginAttempts = (user.loginAttempts || 0) + 1;

    // Lock account if max attempts reached
    if (user.loginAttempts >= maxAttempts) {
        user.lockUntil = Date.now() + lockTime;
        logger.warn('Account locked due to failed login attempts', {
            userId: user._id,
            email: user.email,
            attempts: user.loginAttempts,
            lockUntil: new Date(user.lockUntil).toISOString()
        });
    }

    await user.save();
    return user;
};

/**
 * Reset login attempts on successful login
 * @param {Object} user - User or Employee model instance
 * @returns {Promise<Object>} Updated user
 */
export const resetLoginAttempts = async (user) => {
    if (user.loginAttempts > 0 || user.lockUntil) {
        user.loginAttempts = 0;
        user.lockUntil = undefined;
        await user.save();
    }
    return user;
};

/**
 * Get lockout message with remaining time
 * @param {Object} user - User or Employee model instance
 * @returns {string} Lockout message
 */
export const getLockoutMessage = (user) => {
    if (!user.lockUntil) {
        return 'Account is locked. Please contact administrator.';
    }

    const remainingMinutes = Math.ceil((user.lockUntil - Date.now()) / (60 * 1000));
    if (remainingMinutes > 0) {
        return `Account is locked due to multiple failed login attempts. Please try again in ${remainingMinutes} minute(s).`;
    }

    return 'Account is locked. Please contact administrator.';
};

