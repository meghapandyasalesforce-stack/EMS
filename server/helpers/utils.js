import jwt from "jsonwebtoken";
import crypto from "crypto";
import logger from "./logger.js";

export const generateToken = (userId, role = null, res = null) => {
    try {
        const payload = { userId };
        if (role) payload.role = role;

        const token = jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRE || "7d" }
        );

        if (res) {
            const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
            const cookieOptions = {
                maxAge: 7 * 24 * 60 * 60 * 1000,
                httpOnly: true,
                sameSite: crossSite ? 'none' : 'lax',
                secure: crossSite || process.env.NODE_ENV === 'production',
                path: '/',
            };

            // For production with custom domain
            if (process.env.NODE_ENV === 'production' && process.env.DOMAIN) {
                cookieOptions.domain = process.env.DOMAIN;
            }

            res.cookie('jwt', token, cookieOptions);

            // Issue CSRF token for double-submit cookie strategy
            // Use cryptographically secure random bytes instead of Math.random()
            const csrfToken = crypto.randomBytes(32).toString('hex');
            const csrfCookieOptions = {
                maxAge: cookieOptions.maxAge,
                httpOnly: false,
                sameSite: cookieOptions.sameSite,
                secure: cookieOptions.secure,
                path: '/',
            };
            res.cookie('csrfToken', csrfToken, csrfCookieOptions);
            // Return both token and CSRF token for frontend storage (cross-site scenarios)
            return { token, csrfToken };
        }

        return token;
    } catch (error) {
        logger.error("Token generation error", { error: error.message, stack: error.stack });
        throw new Error("Failed to generate authentication token");
    }
};

// Standardized API Response Helpers
export const sendSuccess = (res, statusCode, message, data = null) => {
    const response = {
        success: true,
        message
    };
    
    if (data !== null) {
        response.data = data;
    }
    
    return res.status(statusCode).json(response);
};

export const sendError = (res, statusCode, message, error = null) => {
    const response = {
        success: false,
        message
    };
    
    if (error && process.env.NODE_ENV === 'development') {
        response.error = error;
    }
    
    return res.status(statusCode).json(response);
};

export const sendValidationError = (res, message, errors) => {
    return res.status(400).json({
        success: false,
        message,
        errors
    });
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