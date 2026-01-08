/**
 * CSRF Token Store
 * Stores CSRF tokens server-side for enhanced security validation
 * Uses Redis if available, falls back to in-memory store
 */

import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from './logger.js';

// In-memory store for CSRF tokens (fallback if Redis is not available)
const inMemoryCsrfStore = new Map();
const CSRF_TOKEN_EXPIRY_SECONDS = 60 * 60; // 1 hour, matches JWT access token expiry

/**
 * Store a CSRF token for a given user.
 * Uses Redis if connected, otherwise falls back to in-memory store.
 * @param {string} userId - The ID of the user.
 * @param {string} token - The CSRF token to store.
 * @returns {Promise<void>}
 */
export const storeCsrfToken = async (userId, token) => {
    if (!userId || !token) {
        logger.warn('Attempted to store CSRF token with missing userId or token');
        return;
    }

    try {
        if (isRedisConnected()) {
            const redisClient = getRedisClient();
            await redisClient.set(`csrf:${userId}`, token, {
                EX: CSRF_TOKEN_EXPIRY_SECONDS,
                NX: false // Overwrite if exists
            });
            logger.debug('CSRF token stored in Redis', { userId });
        } else {
            inMemoryCsrfStore.set(userId, { token, expiresAt: Date.now() + (CSRF_TOKEN_EXPIRY_SECONDS * 1000) });
            logger.debug('CSRF token stored in-memory (Redis not connected)', { userId });
        }
    } catch (error) {
        logger.error('Failed to store CSRF token', { userId, error: error.message });
    }
};

/**
 * Retrieve a CSRF token for a given user.
 * Uses Redis if connected, otherwise falls back to in-memory store.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<string|null>} The CSRF token or null if not found/expired.
 */
export const getCsrfToken = async (userId) => {
    if (!userId) {
        return null;
    }

    try {
        if (isRedisConnected()) {
            const redisClient = getRedisClient();
            const token = await redisClient.get(`csrf:${userId}`);
            logger.debug('CSRF token retrieved from Redis', { userId, found: !!token });
            return token;
        } else {
            const entry = inMemoryCsrfStore.get(userId);
            if (entry && entry.expiresAt > Date.now()) {
                logger.debug('CSRF token retrieved from in-memory', { userId });
                return entry.token;
            } else if (entry) {
                // Token expired in-memory
                inMemoryCsrfStore.delete(userId);
                logger.debug('Expired CSRF token removed from in-memory', { userId });
            }
            logger.debug('CSRF token not found in-memory', { userId });
            return null;
        }
    } catch (error) {
        logger.error('Failed to retrieve CSRF token', { userId, error: error.message });
        return null;
    }
};

/**
 * Delete a CSRF token for a given user.
 * @param {string} userId - The ID of the user.
 * @returns {Promise<void>}
 */
export const deleteCsrfToken = async (userId) => {
    if (!userId) {
        return;
    }

    try {
        if (isRedisConnected()) {
            const redisClient = getRedisClient();
            await redisClient.del(`csrf:${userId}`);
            logger.debug('CSRF token deleted from Redis', { userId });
        } else {
            inMemoryCsrfStore.delete(userId);
            logger.debug('CSRF token deleted from in-memory', { userId });
        }
    } catch (error) {
        logger.error('Failed to delete CSRF token', { userId, error: error.message });
    }
};

