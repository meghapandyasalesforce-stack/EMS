/**
 * Cache Helper for Specific Entities
 * Provides caching functions for employees, users, and other frequently accessed data
 */

import { getCache, setCache, deleteCache, generateCacheKey } from './cache.js';
import logger from './logger.js';

// Cache TTL constants (in seconds)
const CACHE_TTL = {
    EMPLOYEES: 300,      // 5 minutes
    USERS: 600,          // 10 minutes
    ROLES: 1800,         // 30 minutes
    ORGANIZATION: 3600   // 1 hour
};

/**
 * Get cached employees list
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query object for cache key generation
 * @returns {Promise<Object|null>} Cached employees data or null
 */
export const getCachedEmployees = async (organizationId, query = {}) => {
    try {
        const cacheKey = generateCacheKey('employees', { organizationId, ...query });
        return await getCache(cacheKey);
    } catch (error) {
        logger.error('Error getting cached employees', { error: error.message });
        return null;
    }
};

/**
 * Set cached employees list
 * @param {string} organizationId - Organization ID
 * @param {Object} query - Query object for cache key generation
 * @param {Array} employees - Employees data
 * @param {number} total - Total count
 * @returns {Promise<boolean>} Success status
 */
export const setCachedEmployees = async (organizationId, query, employees, total) => {
    try {
        const cacheKey = generateCacheKey('employees', { organizationId, ...query });
        const data = { data: employees, total, cachedAt: Date.now() };
        return await setCache(cacheKey, data, CACHE_TTL.EMPLOYEES);
    } catch (error) {
        logger.error('Error setting cached employees', { error: error.message });
        return false;
    }
};

/**
 * Invalidate employees cache for an organization
 * @param {string} organizationId - Organization ID
 * @returns {Promise<boolean>} Success status
 */
export const invalidateEmployeesCache = async (organizationId) => {
    try {
        const { deleteCacheByPattern } = await import('./cache.js');
        const cacheKey = generateCacheKey('employees', { organizationId });
        await deleteCache(cacheKey);
        // Controller cache key format: "employees:organizationId:xxx|query:..."
        await deleteCacheByPattern(`employees:organizationId:${String(organizationId)}*`);
        // Route-level cache (GET /v1/admin/employee) uses prefix "employees:all"
        await deleteCacheByPattern('employees:all*');
        // Invalidate managers list so new managers (e.g. first CEO/Manager) appear in dropdown
        await deleteCacheByPattern('employees:managers*');
        return true;
    } catch (error) {
        logger.error('Error invalidating employees cache', { error: error.message });
        return false;
    }
};

/**
 * Get cached user
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} Cached user data or null
 */
export const getCachedUser = async (userId) => {
    try {
        const cacheKey = generateCacheKey('user', userId);
        return await getCache(cacheKey);
    } catch (error) {
        logger.error('Error getting cached user', { error: error.message });
        return null;
    }
};

/**
 * Set cached user
 * @param {string} userId - User ID
 * @param {Object} user - User data
 * @returns {Promise<boolean>} Success status
 */
export const setCachedUser = async (userId, user) => {
    try {
        const cacheKey = generateCacheKey('user', userId);
        return await setCache(cacheKey, user, CACHE_TTL.USERS);
    } catch (error) {
        logger.error('Error setting cached user', { error: error.message });
        return false;
    }
};

/**
 * Invalidate user cache
 * @param {string} userId - User ID
 * @returns {Promise<boolean>} Success status
 */
export const invalidateUserCache = async (userId) => {
    try {
        const cacheKey = generateCacheKey('user', userId);
        return await deleteCache(cacheKey);
    } catch (error) {
        logger.error('Error invalidating user cache', { error: error.message });
        return false;
    }
};

/**
 * Invalidate payroll list caches so new/updated payrolls show in admin list
 * Call after create, update, or toggle visibility.
 * @returns {Promise<boolean>} Success status
 */
export const invalidatePayrollCache = async () => {
    try {
        const { deleteCacheByPattern } = await import('./cache.js');
        await deleteCacheByPattern('payroll:all-employees*');
        await deleteCacheByPattern('payroll:all*');
        await deleteCacheByPattern('payroll:employee*');
        await deleteCacheByPattern('payroll:current*');
        await deleteCacheByPattern('payroll:monthyear*');
        await deleteCacheByPattern('payroll:my*');
        return true;
    } catch (error) {
        logger.error('Error invalidating payroll cache', { error: error.message });
        return false;
    }
};

export default {
    getCachedEmployees,
    setCachedEmployees,
    invalidateEmployeesCache,
    getCachedUser,
    setCachedUser,
    invalidateUserCache,
    invalidatePayrollCache,
    CACHE_TTL
};

