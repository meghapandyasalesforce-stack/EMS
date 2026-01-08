/**
 * Redis Configuration
 * Centralized Redis client setup for caching and job queues
 */

import { createClient } from 'redis';
import logger from '../helpers/logger.js';

let redisClient = null;
let isConnected = false;
let connectionAttempted = false;
let lastErrorLogTime = 0;
let reconnectAttempts = 0;
let reconnectLimitReached = false;
const ERROR_LOG_THROTTLE_MS = 30000; // Only log errors every 30 seconds
const MAX_RECONNECT_ATTEMPTS = 10;

/**
 * Get Redis configuration from environment variables
 * @returns {Object} Redis configuration
 */
export const getRedisConfig = () => {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    const password = process.env.REDIS_PASSWORD || undefined;
    const db = parseInt(process.env.REDIS_DB || '0', 10);

    return {
        url: redisUrl,
        password,
        database: db,
        socket: {
            reconnectStrategy: (retries) => {
                reconnectAttempts = retries;
                if (retries > MAX_RECONNECT_ATTEMPTS) {
                    // Only log once when limit is reached, and only if Redis was actually configured
                    if (!reconnectLimitReached) {
                        reconnectLimitReached = true;
                        // Suppress warning if Redis is not configured (using default localhost)
                        const hasExplicitConfig = process.env.REDIS_URL || (process.env.REDIS_HOST && process.env.REDIS_HOST !== 'localhost');
                        if (hasExplicitConfig) {
                            logger.warn('Redis reconnection limit reached. Stopping reconnection attempts.', {
                                note: 'Redis is optional. The system will continue without it.'
                            });
                        } else {
                            logger.debug('Redis connection failed (Redis may not be running). Continuing without Redis.', {
                                note: 'Redis is optional. To enable, install and start Redis, or configure REDIS_URL.'
                            });
                        }
                    }
                    // Return error to stop reconnection attempts
                    return new Error('Redis connection failed - max retries exceeded');
                }
                return Math.min(retries * 100, 3000);
            }
        }
    };
};

/**
 * Initialize Redis client
 * @returns {Promise<Object>} Redis client instance
 */
export const initRedis = async () => {
    if (redisClient && isConnected) {
        return redisClient;
    }

    // Check if Redis is configured - if not, skip connection attempt
    const hasRedisConfig = process.env.REDIS_URL || process.env.REDIS_HOST;
    if (!hasRedisConfig) {
        logger.debug('Redis not configured - skipping connection attempt');
        return null;
    }

    // Prevent multiple simultaneous connection attempts
    if (connectionAttempted && !isConnected) {
        logger.debug('Redis connection already attempted, skipping retry');
        return null;
    }

    connectionAttempted = true;

    try {
        const config = getRedisConfig();
        redisClient = createClient(config);

        redisClient.on('error', (err) => {
            // Throttle error logging to prevent log spam
            const now = Date.now();
            if (now - lastErrorLogTime > ERROR_LOG_THROTTLE_MS) {
                // Only log if error message is meaningful
                if (err.message && err.message.trim() !== '') {
                    logger.error('Redis Client Error', { error: err.message });
                } else {
                    logger.debug('Redis connection error (empty message - likely connection refused)');
                }
                lastErrorLogTime = now;
            }
            isConnected = false;
        });

        redisClient.on('connect', () => {
            logger.info('Redis client connecting...');
        });

        redisClient.on('ready', () => {
            logger.info('Redis client ready');
            isConnected = true;
        });

        redisClient.on('end', () => {
            logger.warn('Redis client connection ended');
            isConnected = false;
        });

        await redisClient.connect();
        logger.info('Redis client connected successfully');
        connectionAttempted = false; // Reset on success
        reconnectAttempts = 0; // Reset reconnect attempts on successful connection
        reconnectLimitReached = false; // Reset limit flag
        return redisClient;
    } catch (error) {
        connectionAttempted = false; // Reset on failure to allow retry later
        // Only log meaningful errors, and throttle repeated connection failures
        const now = Date.now();
        if (now - lastErrorLogTime > ERROR_LOG_THROTTLE_MS) {
            logger.warn('Redis not available - continuing without cache/queues', { 
                error: error.message || 'Connection refused',
                note: 'Redis is optional. The system will work without it, but background jobs will not be processed.'
            });
            lastErrorLogTime = now;
        }
        // Return null to allow graceful degradation
        return null;
    }
};

/**
 * Get Redis client instance
 * @returns {Object|null} Redis client or null if not connected
 */
export const getRedisClient = () => {
    return isConnected ? redisClient : null;
};

/**
 * Check if Redis is connected
 * @returns {boolean}
 */
export const isRedisConnected = () => {
    return isConnected && redisClient !== null;
};

/**
 * Close Redis connection
 * @returns {Promise<void>}
 */
export const closeRedis = async () => {
    if (!redisClient) {
        return; // No client to close
    }

    try {
        // Check if client is already closed or not connected
        if (redisClient.isOpen === false || !isConnected) {
            // Client is already closed, just reset state
            redisClient = null;
            isConnected = false;
            return;
        }

        // Try to close gracefully
        await redisClient.quit();
        isConnected = false;
        redisClient = null;
        logger.info('Redis connection closed');
    } catch (error) {
        // Handle "client is closed" errors gracefully
        if (error.message && (
            error.message.includes('closed') || 
            error.message.includes('The client is closed') ||
            error.message.includes('Connection is closed')
        )) {
            // Client was already closed, just reset state
            redisClient = null;
            isConnected = false;
            // Don't log this as an error - it's expected if client was already closed
            return;
        }
        
        // For other errors, log but don't throw
        logger.debug('Error closing Redis connection (non-critical)', { error: error.message });
        // Reset state anyway
        redisClient = null;
        isConnected = false;
    }
};

export default {
    initRedis,
    getRedisClient,
    isRedisConnected,
    closeRedis,
    getRedisConfig
};

