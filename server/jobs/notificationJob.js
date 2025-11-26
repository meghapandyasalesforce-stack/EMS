/**
 * Notification Job Processor
 * Handles push notifications in background queue
 */

import { sendPushNotification, createPushPayload } from '../helpers/pushNotificationService.js';
import logger from '../helpers/logger.js';

/**
 * Process notification job
 * @param {Object} job - BullMQ job instance
 * @returns {Promise<Object>} Job result
 */
export const processNotificationJob = async (job) => {
    const { userId, userType, message, type, metadata } = job.data;

    try {
        const payload = createPushPayload(message, type, metadata);
        const result = await sendPushNotification(userId, userType, payload);

        logger.info('Notification job processed successfully', { 
            jobId: job.id, 
            userId,
            sent: result.sent,
            failed: result.failed
        });

        return { 
            success: true, 
            userId, 
            sent: result.sent, 
            failed: result.failed 
        };
    } catch (error) {
        logger.error('Notification job processing failed', { 
            jobId: job.id, 
            userId,
            error: error.message,
            stack: error.stack 
        });
        throw error;
    }
};

export default processNotificationJob;

