/**
 * Password Utilities
 * Shared password hashing and comparison functions to reduce code duplication
 */

import bcrypt from 'bcryptjs';
import logger from './logger.js';
import { BCRYPT_SALT_ROUNDS } from '../config/constants.js';

/**
 * Hash a password using bcrypt
 * @param {string} password - Plain text password to hash
 * @returns {Promise<string>} - Hashed password
 * @throws {Error} - If hashing fails
 */
export const hashPassword = async (password) => {
    if (!password) {
        throw new Error('Password is required');
    }
    
    try {
        const salt = await bcrypt.genSalt(BCRYPT_SALT_ROUNDS);
        return await bcrypt.hash(password, salt);
    } catch (error) {
        logger.error('Password hashing error', {
            error: error.message,
            stack: error.stack
        });
        throw new Error('Error hashing password');
    }
};

/**
 * Compare a candidate password with a hashed password
 * @param {string} candidatePassword - Plain text password to compare
 * @param {string} hashedPassword - Hashed password to compare against
 * @param {string} userId - Optional user/employee ID for logging
 * @returns {Promise<boolean>} - True if passwords match, false otherwise
 */
export const comparePassword = async (candidatePassword, hashedPassword, userId = null) => {
    try {
        if (!candidatePassword) {
            return false; // Return false instead of throwing for invalid input
        }
        if (!hashedPassword) {
            if (userId) {
                logger.warn('Password comparison attempted but user has no password', { userId });
            }
            return false;
        }
        return await bcrypt.compare(candidatePassword, hashedPassword);
    } catch (error) {
        if (userId) {
            logger.error('Password comparison error', {
                error: error.message,
                stack: error.stack,
                userId
            });
        }
        // Return false instead of throwing to allow login controller to handle 401 properly
        return false;
    }
};

