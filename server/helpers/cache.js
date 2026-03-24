/**
 * Cache Helper
 * Provides caching functionality using Redis with fallback to in-memory cache
 */

import { getRedisClient, isRedisConnected } from '../config/redis.js';
import logger from './logger.js';

// In-memory fallback cache
const memoryCache = new Map();
const memoryCacheTTL = new Map();

/**
 * Generate cache key
 * @param {string} prefix - Cache key prefix
 * @param {string|Object} identifier - Cache identifier
 * @returns {string} Cache key
 */
export const generateCacheKey = (prefix, identifier) => {
    const stableSerialize = (value) => {
        if (value === null || value === undefined) return String(value);
        if (typeof value !== 'object') return String(value);
        if (Array.isArray(value)) {
            return `[${value.map(stableSerialize).join(',')}]`;
        }
        const keys = Object.keys(value).sort();
        return `{${keys.map((k) => `${k}:${stableSerialize(value[k])}`).join(',')}}`;
    };

    if (typeof identifier === 'object') {
        const sortedKeys = Object.keys(identifier).sort();
        const keyString = sortedKeys.map(key => `${key}:${stableSerialize(identifier[key])}`).join('|');
        return `${prefix}:${keyString}`;
    }
    return `${prefix}:${identifier}`;
};

/**
 * Get value from cache
 * @param {string} key - Cache key
 * @returns {Promise<*>} Cached value or null
 */
export const getCache = async (key) => {
    try {
        const redis = getRedisClient();
        
        if (redis && isRedisConnected()) {
            const value = await redis.get(key);
            if (value) {
                return JSON.parse(value);
            }
            return null;
        } else {
            // Fallback to memory cache
            const cached = memoryCache.get(key);
            if (cached) {
                const ttl = memoryCacheTTL.get(key);
                if (ttl && Date.now() > ttl) {
                    memoryCache.delete(key);
                    memoryCacheTTL.delete(key);
                    return null;
                }
                return cached;
            }
            return null;
        }
    } catch (error) {
        logger.error('Cache get error', { key, error: error.message });
        return null;
    }
};

/**
 * Set value in cache
 * @param {string} key - Cache key
 * @param {*} value - Value to cache
 * @param {number} ttlSeconds - Time to live in seconds (default: 3600)
 * @returns {Promise<boolean>} Success status
 */
export const setCache = async (key, value, ttlSeconds = 3600) => {
    try {
        const redis = getRedisClient();
        
        if (redis && isRedisConnected()) {
            await redis.setEx(key, ttlSeconds, JSON.stringify(value));
            return true;
        } else {
            // Fallback to memory cache
            memoryCache.set(key, value);
            if (ttlSeconds > 0) {
                memoryCacheTTL.set(key, Date.now() + (ttlSeconds * 1000));
            }
            return true;
        }
    } catch (error) {
        logger.error('Cache set error', { key, error: error.message });
        return false;
    }
};

/**
 * Delete value from cache
 * @param {string} key - Cache key
 * @returns {Promise<boolean>} Success status
 */
export const deleteCache = async (key) => {
    try {
        const redis = getRedisClient();
        
        if (redis && isRedisConnected()) {
            await redis.del(key);
            return true;
        } else {
            // Fallback to memory cache
            memoryCache.delete(key);
            memoryCacheTTL.delete(key);
            return true;
        }
    } catch (error) {
        logger.error('Cache delete error', { key, error: error.message });
        return false;
    }
};

/**
 * Delete multiple cache keys by pattern
 * @param {string} pattern - Cache key pattern
 * @returns {Promise<number>} Number of keys deleted
 */
export const deleteCacheByPattern = async (pattern) => {
    try {
        const redis = getRedisClient();
        
        if (redis && isRedisConnected()) {
            const keys = await redis.keys(pattern);
            if (keys.length > 0) {
                await redis.del(keys);
            }
            return keys.length;
        } else {
            // Fallback to memory cache
            let deleted = 0;
            for (const key of memoryCache.keys()) {
                if (key.match(new RegExp(pattern.replace('*', '.*')))) {
                    memoryCache.delete(key);
                    memoryCacheTTL.delete(key);
                    deleted++;
                }
            }
            return deleted;
        }
    } catch (error) {
        logger.error('Cache delete pattern error', { pattern, error: error.message });
        return 0;
    }
};

/**
 * Cache middleware for Express routes
 * @param {string} prefix - Cache key prefix
 * @param {number} ttlSeconds - Cache TTL in seconds
 * @returns {Function} Express middleware
 */
export const cacheMiddleware = (prefix, ttlSeconds = 3600) => {
    return async (req, res, next) => {
        // Only cache GET requests
        if (req.method !== 'GET') {
            return next();
        }

        const cacheKey = generateCacheKey(prefix, {
            path: req.path,
            query: req.query,
            user: req.user?._id || req.employee?._id
        });

        try {
            const cached = await getCache(cacheKey);
            if (cached) {
                logger.debug('Cache hit', { key: cacheKey });
                return res.json(cached);
            }

            // Store original json method
            const originalJson = res.json.bind(res);
            
            // Override json method to cache response
            res.json = function(data) {
                setCache(cacheKey, data, ttlSeconds).catch(err => {
                    logger.error('Failed to cache response', { error: err.message });
                });
                return originalJson(data);
            };

            next();
        } catch (error) {
            logger.error('Cache middleware error', { error: error.message });
            next();
        }
    };
};

/**
 * Invalidate cache by pattern
 * @param {string} pattern - Cache key pattern
 * @returns {Promise<void>}
 */
export const invalidateCache = async (pattern) => {
    await deleteCacheByPattern(pattern);
};

export default {
    getCache,
    setCache,
    deleteCache,
    deleteCacheByPattern,
    generateCacheKey,
    cacheMiddleware,
    invalidateCache
};

