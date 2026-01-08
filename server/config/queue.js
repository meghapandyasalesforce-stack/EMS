/**
 * Job Queue Configuration
 * BullMQ setup for background job processing
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedisConfig, isRedisConnected } from './redis.js';
import logger from '../helpers/logger.js';

// Check if Redis is available
let redisAvailable = false;
let connection = null;

// Get Redis connection config (lazy initialization)
const getConnection = () => {
    // Check if Redis is actually connected before creating connection config
    if (!isRedisConnected()) {
        return null;
    }

    if (connection) {
        return connection;
    }

    try {
        const redisConfig = getRedisConfig();
        connection = {
            host: redisConfig.socket?.host || process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: redisConfig.password,
            db: redisConfig.database,
            // Add connection retry strategy
            retryStrategy: (times) => {
                if (times > 10) {
                    logger.warn('Redis connection retry limit reached. Queues will be disabled.');
                    redisAvailable = false;
                    return null; // Stop retrying
                }
                return Math.min(times * 100, 3000);
            },
            // Don't throw errors on connection failure
            enableOfflineQueue: false,
            maxRetriesPerRequest: null, // Disable retries
        };
        redisAvailable = true;
        return connection;
    } catch (error) {
        logger.debug('Redis configuration failed. Job queues will be disabled.', { error: error.message });
        redisAvailable = false;
        return null;
    }
};

// Queue instances
const queues = new Map();
const workers = new Map();
const queueEvents = new Map();

/**
 * Create or get a queue
 * @param {string} queueName - Queue name
 * @returns {Queue|null} BullMQ queue instance or null if Redis unavailable
 */
export const getQueue = (queueName) => {
    // Check if Redis is actually connected and get connection config
    const conn = getConnection();
    if (!conn) {
        logger.debug('Redis not available. Queue operations disabled.', { queueName });
        return null;
    }

    if (queues.has(queueName)) {
        return queues.get(queueName);
    }

    try {
        const queue = new Queue(queueName, {
            connection: conn,
            defaultJobOptions: {
                attempts: parseInt(process.env.QUEUE_MAX_ATTEMPTS || '3', 10),
                backoff: {
                    type: 'exponential',
                    delay: parseInt(process.env.QUEUE_BACKOFF_DELAY || '5000', 10)
                },
                removeOnComplete: {
                    age: 24 * 3600, // Keep completed jobs for 24 hours
                    count: 1000 // Keep max 1000 completed jobs
                },
                removeOnFail: {
                    age: 7 * 24 * 3600 // Keep failed jobs for 7 days
                }
            }
        });

        queues.set(queueName, queue);

        // Set up queue events (with error handling)
        try {
            const events = new QueueEvents(queueName, { connection: conn });
            queueEvents.set(queueName, events);

            events.on('completed', ({ jobId }) => {
                logger.debug('Job completed', { queueName, jobId });
            });

            events.on('failed', ({ jobId, failedReason }) => {
                logger.error('Job failed', { queueName, jobId, failedReason });
            });

            events.on('stalled', ({ jobId }) => {
                logger.warn('Job stalled', { queueName, jobId });
            });

            events.on('error', (error) => {
                logger.error('Queue events error', { queueName, error: error.message });
            });
        } catch (eventsError) {
            logger.warn('Failed to create queue events', { queueName, error: eventsError.message });
        }

        return queue;
    } catch (error) {
        logger.error('Failed to create queue', { queueName, error: error.message });
        redisAvailable = false;
        return null;
    }
};

/**
 * Create a worker for a queue
 * @param {string} queueName - Queue name
 * @param {Function} processor - Job processor function
 * @returns {Worker|null} BullMQ worker instance or null if Redis unavailable
 */
export const createWorker = (queueName, processor) => {
    // Check if Redis is actually connected and get connection config
    const conn = getConnection();
    if (!conn) {
        logger.debug('Redis not available. Worker not created.', { queueName });
        return null;
    }

    if (workers.has(queueName)) {
        logger.warn('Worker already exists', { queueName });
        return workers.get(queueName);
    }

    try {
        const concurrency = parseInt(process.env.QUEUE_CONCURRENCY || '5', 10);

        const worker = new Worker(
            queueName,
            async (job) => {
                logger.info('Processing job', { 
                    queueName, 
                    jobId: job.id, 
                    jobName: job.name,
                    data: job.data 
                });
                
                try {
                    const result = await processor(job);
                    logger.info('Job completed successfully', { 
                        queueName, 
                        jobId: job.id 
                    });
                    return result;
                } catch (error) {
                    logger.error('Job processing error', { 
                        queueName, 
                        jobId: job.id, 
                        error: error.message,
                        stack: error.stack 
                    });
                    throw error;
                }
            },
            {
                connection: {
                    ...conn,
                    retryStrategy: (times) => {
                        if (times > 10) {
                            logger.warn('Redis connection retry limit reached for worker', { queueName });
                            return null;
                        }
                        return Math.min(times * 100, 3000);
                    }
                },
                concurrency,
                limiter: {
                    max: 10,
                    duration: 1000
                }
            }
        );

        worker.on('completed', (job) => {
            logger.info('Worker job completed', { queueName, jobId: job.id });
        });

        worker.on('failed', (job, err) => {
            logger.error('Worker job failed', { 
                queueName, 
                jobId: job?.id, 
                error: err.message 
            });
        });

        // Throttle worker error logging
        let lastWorkerErrorLogTime = 0;
        const WORKER_ERROR_LOG_THROTTLE_MS = 60000; // Only log worker errors every 60 seconds
        
        worker.on('error', (error) => {
            const now = Date.now();
            const isRedisError = !error.message || 
                                 error.message.includes('ECONNREFUSED') || 
                                 error.message.includes('Redis') ||
                                 error.message.trim() === '';
            
            // Throttle logging for Redis connection errors
            if (isRedisError) {
                if (now - lastWorkerErrorLogTime > WORKER_ERROR_LOG_THROTTLE_MS) {
                    logger.warn('Worker Redis connection error - Redis not available', { 
                        queueName,
                        note: 'Background jobs will not be processed until Redis is available. This is expected if Redis is not running.'
                    });
                    lastWorkerErrorLogTime = now;
                }
            } else {
                // Log non-Redis errors immediately (they're more serious)
                logger.error('Worker error', { queueName, error: error.message });
            }
        });

        workers.set(queueName, worker);
        return worker;
    } catch (error) {
        logger.error('Failed to create worker', { queueName, error: error.message });
        redisAvailable = false;
        return null;
    }
};

/**
 * Add job to queue
 * @param {string} queueName - Queue name
 * @param {string} jobName - Job name
 * @param {Object} data - Job data
 * @param {Object} options - Job options
 * @returns {Promise<Object|null>} Job instance or null if Redis unavailable
 */
export const addJob = async (queueName, jobName, data, options = {}) => {
    const queue = getQueue(queueName);
    if (!queue) {
        logger.warn('Cannot add job - Redis not available', { queueName, jobName });
        return null;
    }

    try {
        const job = await queue.add(jobName, data, options);
        logger.info('Job added to queue', { queueName, jobName, jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to add job to queue', { 
            queueName, 
            jobName, 
            error: error.message 
        });
        // If Redis connection fails, mark as unavailable
        if (error.message.includes('ECONNREFUSED') || error.message.includes('Redis')) {
            redisAvailable = false;
        }
        return null;
    }
};

/**
 * Close all queues and workers
 * @returns {Promise<void>}
 */
export const closeAll = async () => {
    const closePromises = [];

    // Close all workers
    for (const [queueName, worker] of workers.entries()) {
        logger.info('Closing worker', { queueName });
        closePromises.push(worker.close());
    }

    // Close all queues
    for (const [queueName, queue] of queues.entries()) {
        logger.info('Closing queue', { queueName });
        closePromises.push(queue.close());
    }

    // Close all queue events
    for (const [queueName, events] of queueEvents.entries()) {
        logger.info('Closing queue events', { queueName });
        closePromises.push(events.close());
    }

    await Promise.all(closePromises);
    queues.clear();
    workers.clear();
    queueEvents.clear();
    logger.info('All queues and workers closed');
};

/**
 * Check if Redis is available for queues
 * @returns {boolean}
 */
export const isRedisAvailable = () => {
    return redisAvailable;
};

export default {
    getQueue,
    createWorker,
    addJob,
    closeAll,
    isRedisAvailable
};

