/**
 * Job Queue Configuration
 * BullMQ setup for background job processing
 */

import { Queue, Worker, QueueEvents } from 'bullmq';
import { getRedisConfig } from './redis.js';
import logger from '../helpers/logger.js';

const redisConfig = getRedisConfig();
const connection = {
    host: redisConfig.socket?.host || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: redisConfig.password,
    db: redisConfig.database
};

// Queue instances
const queues = new Map();
const workers = new Map();
const queueEvents = new Map();

/**
 * Create or get a queue
 * @param {string} queueName - Queue name
 * @returns {Queue} BullMQ queue instance
 */
export const getQueue = (queueName) => {
    if (queues.has(queueName)) {
        return queues.get(queueName);
    }

    const queue = new Queue(queueName, {
        connection,
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

    // Set up queue events
    const events = new QueueEvents(queueName, { connection });
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

    return queue;
};

/**
 * Create a worker for a queue
 * @param {string} queueName - Queue name
 * @param {Function} processor - Job processor function
 * @returns {Worker} BullMQ worker instance
 */
export const createWorker = (queueName, processor) => {
    if (workers.has(queueName)) {
        logger.warn('Worker already exists', { queueName });
        return workers.get(queueName);
    }

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
            connection,
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

    workers.set(queueName, worker);
    return worker;
};

/**
 * Add job to queue
 * @param {string} queueName - Queue name
 * @param {string} jobName - Job name
 * @param {Object} data - Job data
 * @param {Object} options - Job options
 * @returns {Promise<Object>} Job instance
 */
export const addJob = async (queueName, jobName, data, options = {}) => {
    const queue = getQueue(queueName);
    const job = await queue.add(jobName, data, options);
    logger.info('Job added to queue', { queueName, jobName, jobId: job.id });
    return job;
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

export default {
    getQueue,
    createWorker,
    addJob,
    closeAll
};

