/**
 * Notification Queue Helper
 * Wrapper for adding push notifications to background job queue
 */

import { addJob } from '../config/queue.js';
import logger from './logger.js';

/**
 * Queue push notification
 * @param {string|ObjectId} userId - User ID
 * @param {string} userType - User type ('User' or 'Employee')
 * @param {string} message - Notification message
 * @param {string} type - Notification type
 * @param {Object} metadata - Additional metadata
 * @returns {Promise<Object>} Job instance
 */
export const queuePushNotification = async (userId, userType, message, type = 'general', metadata = {}) => {
    try {
        const job = await addJob('notification', 'push', {
            userId,
            userType,
            message,
            type,
            metadata
        }, {
            priority: 2, // Normal priority
            removeOnComplete: true
        });
        
        logger.info('Push notification queued', { userId, type, jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to queue push notification', { userId, error: error.message });
        throw error;
    }
};

export default {
    queuePushNotification
};

