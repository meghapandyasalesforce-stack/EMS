/**
 * Job Processors Initialization
 * Sets up all job workers
 */

import { createWorker } from '../config/queue.js';
import { isRedisConnected } from '../config/redis.js';
import processEmailJob from './emailJob.js';
import processNotificationJob from './notificationJob.js';
import { startCompOffExpiryWorker, scheduleCompOffExpiry } from './compOffExpiryJob.js';
import { startAutoCheckOutWorker, scheduleAutoCheckOut } from './autoCheckOutJob.js';
import logger from '../helpers/logger.js';

/**
 * Initialize all job workers
 */
export const initializeWorkers = async () => {
    try {
        // Check if Redis is actually connected before creating workers
        if (!isRedisConnected()) {
            logger.info('Redis not connected - background job workers will not be initialized');
            logger.info('Note: The server will continue to work, but email and notification queues require Redis');
            return;
        }

        // Email queue worker
        const emailWorker = createWorker('email', processEmailJob);
        if (emailWorker) {
            logger.info('Email worker initialized');
        } else {
            logger.warn('Email worker not initialized - Redis not available');
        }

        // Notification queue worker
        const notificationWorker = createWorker('notification', processNotificationJob);
        if (notificationWorker) {
            logger.info('Notification worker initialized');
        } else {
            logger.warn('Notification worker not initialized - Redis not available');
        }

        // Comp-Off Expiry worker
        const compOffExpiryWorker = startCompOffExpiryWorker();
        if (compOffExpiryWorker) {
            logger.info('Comp-Off expiry worker initialized');
            // Schedule daily comp-off expiry job
            await scheduleCompOffExpiry();
        } else {
            logger.warn('Comp-Off expiry worker not initialized - Redis not available');
        }

        // Auto Check-Out worker
        const autoCheckOutWorker = startAutoCheckOutWorker();
        if (autoCheckOutWorker) {
            logger.info('Auto check-out worker initialized');
            // Schedule auto check-out job (runs every minute)
            await scheduleAutoCheckOut();
        } else {
            logger.warn('Auto check-out worker not initialized - Redis not available');
        }

        if (emailWorker && notificationWorker && compOffExpiryWorker && autoCheckOutWorker) {
            logger.info('All job workers initialized successfully');
        } else {
            logger.warn('Some workers not initialized - Redis connection required for background jobs');
        }
    } catch (error) {
        logger.error('Failed to initialize workers', { error: error.message });
        // Don't throw - allow server to start without workers
        // Workers will be retried on next job
    }
};

export default {
    initializeWorkers
};

