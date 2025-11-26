/**
 * Job Processors Initialization
 * Sets up all job workers
 */

import { createWorker } from '../config/queue.js';
import processEmailJob from './emailJob.js';
import processNotificationJob from './notificationJob.js';
import logger from '../helpers/logger.js';

/**
 * Initialize all job workers
 */
export const initializeWorkers = () => {
    try {
        // Email queue worker
        createWorker('email', processEmailJob);
        logger.info('Email worker initialized');

        // Notification queue worker
        createWorker('notification', processNotificationJob);
        logger.info('Notification worker initialized');

        logger.info('All job workers initialized successfully');
    } catch (error) {
        logger.error('Failed to initialize workers', { error: error.message });
        // Don't throw - allow server to start without workers
        // Workers will be retried on next job
    }
};

export default {
    initializeWorkers
};

