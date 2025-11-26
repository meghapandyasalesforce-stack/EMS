/**
 * Redis Configuration
 * Centralized Redis client setup for caching and job queues
 */

import { createClient } from 'redis';
import logger from '../helpers/logger.js';

let redisClient = null;
let isConnected = false;

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
                if (retries > 10) {
                    logger.error('Redis reconnection failed after 10 attempts');
                    return new Error('Redis connection failed');
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

    try {
        const config = getRedisConfig();
        redisClient = createClient(config);

        redisClient.on('error', (err) => {
            logger.error('Redis Client Error', { error: err.message });
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
        
        return redisClient;
    } catch (error) {
        logger.error('Failed to initialize Redis', { error: error.message });
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
    if (redisClient) {
        try {
            await redisClient.quit();
            isConnected = false;
            logger.info('Redis connection closed');
        } catch (error) {
            logger.error('Error closing Redis connection', { error: error.message });
        }
    }
};

export default {
    initRedis,
    getRedisClient,
    isRedisConnected,
    closeRedis,
    getRedisConfig
};

