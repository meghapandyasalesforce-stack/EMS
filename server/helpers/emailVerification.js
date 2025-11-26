import crypto from 'crypto';
import logger from './logger.js';

/**
 * Generate email verification token
 * @returns {string} Verification token
 */
export const generateVerificationToken = () => {
    return crypto.randomBytes(32).toString('hex');
};

/**
 * Generate email verification token with expiration
 * @param {number} hours - Hours until expiration (default: 24)
 * @returns {Object} Token and expiration date
 */
export const generateVerificationTokenWithExpiry = (hours = 24) => {
    const token = generateVerificationToken();
    const expires = new Date();
    expires.setHours(expires.getHours() + hours);
    
    return {
        token,
        expires
    };
};

/**
 * Verify token expiration
 * @param {Date} expires - Expiration date
 * @returns {boolean} True if token is still valid
 */
export const isTokenValid = (expires) => {
    if (!expires) return false;
    return new Date() < new Date(expires);
};

