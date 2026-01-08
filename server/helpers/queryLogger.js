/**
 * Database Query Logger
 * Logs slow queries and provides query performance monitoring
 */

import logger from './logger.js';

// Configuration
const SLOW_QUERY_THRESHOLD_MS = parseInt(process.env.SLOW_QUERY_THRESHOLD_MS || '1000');
const ENABLE_QUERY_LOGGING = process.env.ENABLE_QUERY_LOGGING !== 'false'; // Default to true

/**
 * Wrap a database query to log slow queries
 * @param {string} operation - Operation name (e.g., 'find', 'findOne', 'create')
 * @param {string} model - Model name (e.g., 'Employee', 'User')
 * @param {Function} queryFn - The query function to execute
 * @returns {Promise} Query result
 */
export const logQuery = async (operation, model, queryFn) => {
    if (!ENABLE_QUERY_LOGGING) {
        return await queryFn();
    }

    const startTime = Date.now();
    let error = null;
    let result = null;

    try {
        result = await queryFn();
        return result;
    } catch (err) {
        error = err;
        throw err;
    } finally {
        const duration = Date.now() - startTime;
        
        if (duration > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn('Slow database query detected', {
                operation,
                model,
                duration: `${duration}ms`,
                threshold: `${SLOW_QUERY_THRESHOLD_MS}ms`,
                error: error ? error.message : null
            });
        } else if (process.env.NODE_ENV === 'development' && process.env.DEBUG_QUERIES === 'true') {
            logger.debug('Database query', {
                operation,
                model,
                duration: `${duration}ms`
            });
        }
    }
};

/**
 * Create a Mongoose query logger middleware
 * This can be used as a Mongoose plugin
 */
export const mongooseQueryLogger = (schema) => {
    if (!ENABLE_QUERY_LOGGING) {
        return;
    }

    // Log find operations
    schema.post(['find', 'findOne', 'findOneAndUpdate', 'findOneAndDelete'], async function() {
        const duration = this.getQuery()._duration || 0;
        if (duration > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn('Slow Mongoose query', {
                model: this.model.modelName,
                operation: this.op,
                duration: `${duration}ms`,
                query: JSON.stringify(this.getQuery())
            });
        }
    });

    // Log save operations
    schema.post('save', async function() {
        const duration = this.$__.saveStartTime 
            ? Date.now() - this.$__.saveStartTime 
            : 0;
        if (duration > SLOW_QUERY_THRESHOLD_MS) {
            logger.warn('Slow Mongoose save operation', {
                model: this.constructor.modelName,
                operation: 'save',
                duration: `${duration}ms`
            });
        }
    });

    // Track save start time
    schema.pre('save', function() {
        this.$__.saveStartTime = Date.now();
    });
};

export default {
    logQuery,
    mongooseQueryLogger
};
