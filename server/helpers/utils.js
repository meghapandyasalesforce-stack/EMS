import jwt from "jsonwebtoken";
import crypto from "crypto";
import logger from "./logger.js";
import { DEFAULT_JWT_ACCESS_EXPIRE, DEFAULT_JWT_REFRESH_EXPIRE, CSRF_TOKEN_BYTES } from "../config/constants.js";

/**
 * Generate access token (short-lived) and refresh token (long-lived)
 * @param {string} userId - User ID
 * @param {string} role - User role (admin/employee)
 * @param {string} organizationId - Organization ID (for multi-tenancy)
 * @param {Object} res - Express response object (optional)
 * @returns {Object|string} - Token object with accessToken, refreshToken, csrfToken or just accessToken
 */
export const generateToken = (userId, role = null, organizationId = null, res = null) => {
    try {
        // Validate JWT_SECRET is set
        if (!process.env.JWT_SECRET) {
            logger.error("JWT_SECRET is not defined in environment variables");
            throw new Error("JWT_SECRET is required but not set. Please configure it in your .env file.");
        }

        const payload = { userId };
        if (role) payload.role = role;
        if (organizationId) payload.organizationId = organizationId;

        // Access token - shorter expiration (1 hour default, configurable)
        const accessTokenExpiry = process.env.JWT_ACCESS_EXPIRE || DEFAULT_JWT_ACCESS_EXPIRE;
        const accessToken = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: accessTokenExpiry }
        );

        // Refresh token - longer expiration (30 days default)
        const refreshTokenExpiry = process.env.JWT_REFRESH_EXPIRE || DEFAULT_JWT_REFRESH_EXPIRE;
        const refreshPayload = { userId, role, type: 'refresh' };
        if (organizationId) refreshPayload.organizationId = organizationId;
        const refreshToken = jwt.sign(
            refreshPayload,
            process.env.JWT_SECRET,
            { expiresIn: refreshTokenExpiry }
        );

        if (res) {
            const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
            const cookieOptions = {
                maxAge: 60 * 60 * 1000, // 1 hour for access token
                httpOnly: true,
                sameSite: crossSite ? 'none' : 'lax',
                secure: crossSite || process.env.NODE_ENV === 'production',
                path: '/',
            };

            // For production with custom domain
            if (process.env.NODE_ENV === 'production' && process.env.DOMAIN) {
                cookieOptions.domain = process.env.DOMAIN;
            }

            res.cookie('jwt', accessToken, cookieOptions);

            // Refresh token cookie - longer expiration
            const refreshCookieOptions = {
                maxAge: 30 * 24 * 60 * 60 * 1000, // 30 days
                httpOnly: true,
                sameSite: cookieOptions.sameSite,
                secure: cookieOptions.secure,
                path: '/',
            };
            if (process.env.NODE_ENV === 'production' && process.env.DOMAIN) {
                refreshCookieOptions.domain = process.env.DOMAIN;
            }
            res.cookie('refreshToken', refreshToken, refreshCookieOptions);

            // Issue CSRF token for double-submit cookie strategy
            const csrfToken = crypto.randomBytes(CSRF_TOKEN_BYTES).toString('hex');
            const csrfCookieOptions = {
                maxAge: cookieOptions.maxAge,
                httpOnly: false,
                sameSite: cookieOptions.sameSite,
                secure: cookieOptions.secure,
                path: '/',
            };
            res.cookie('csrfToken', csrfToken, csrfCookieOptions);
            
            // SECURITY: Store CSRF token server-side for enhanced validation
            // Use non-blocking approach to avoid making generateToken async
            import('./csrfTokenStore.js').then(({ storeCsrfToken }) => {
                storeCsrfToken(userId.toString(), csrfToken).catch(storeError => {
                    logger.warn('Failed to store CSRF token (async)', { error: storeError.message, userId });
                });
            }).catch(importError => {
                logger.error('Failed to import csrfTokenStore.js', { error: importError.message });
            });
            
            // Return tokens for frontend storage (cross-site scenarios)
            return { token: accessToken, refreshToken, csrfToken };
        }

        return { accessToken, refreshToken };
    } catch (error) {
        logger.error("Token generation error", { error: error.message, stack: error.stack });
        throw new Error("Failed to generate authentication token");
    }
};

/**
 * Generate a secure random password
 * @param {number} length - Password length (default: 16)
 * @returns {string} Secure random password
 */
export const generateSecurePassword = (length = 16) => {
    // Use cryptographically secure random bytes
    const randomBytes = crypto.randomBytes(length);
    // Convert to base64 and remove special characters that might cause issues
    // Then add required character types for a strong password
    const base64 = randomBytes.toString('base64').slice(0, length - 4);
    
    // Ensure password has required character types
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const symbols = '!@#$%^&*';
    
    // Get one character from each required type
    const requiredChars = [
        uppercase[Math.floor(Math.random() * uppercase.length)],
        lowercase[Math.floor(Math.random() * lowercase.length)],
        numbers[Math.floor(Math.random() * numbers.length)],
        symbols[Math.floor(Math.random() * symbols.length)]
    ];
    
    // Combine base64 string with required characters and shuffle
    const passwordArray = (base64 + requiredChars.join('')).split('');
    // Fisher-Yates shuffle
    for (let i = passwordArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [passwordArray[i], passwordArray[j]] = [passwordArray[j], passwordArray[i]];
    }
    
    return passwordArray.join('').slice(0, length);
};