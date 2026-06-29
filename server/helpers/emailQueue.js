/**
 * Email Queue Helper
 * Wrapper for adding emails to background job queue
 */

import { addJob } from '../config/queue.js';
import logger from './logger.js';

/**
 * Queue welcome email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string|null} password - Plain text password (dev only)
 * @param {string|null} resetUrl - Password reset URL
 * @returns {Promise<Object>} Job instance
 */
export const queueWelcomeEmail = async (email, name, password = null, resetUrl = null) => {
    try {
        const job = await addJob('email', 'welcome', {
            type: 'welcome',
            data: { email, name, password, resetUrl }
        }, {
            priority: 1, // High priority for welcome emails
            removeOnComplete: true
        });

        if (!job) {
            logger.warn('Welcome email not queued — job queue unavailable', { email });
            return null;
        }

        logger.info('Welcome email queued', { email, jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to queue welcome email', { email, error: error.message });
        throw error;
    }
};

/**
 * Queue password reset email
 * @param {string} email - Recipient email
 * @param {string} name - Recipient name
 * @param {string} resetUrl - Password reset URL
 * @returns {Promise<Object>} Job instance
 */
export const queuePasswordResetEmail = async (email, name, resetUrl) => {
    try {
        const job = await addJob('email', 'password-reset', {
            type: 'password-reset',
            data: { email, name, resetUrl }
        }, {
            priority: 1, // High priority
            removeOnComplete: true
        });
        
        logger.info('Password reset email queued', { email, jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to queue password reset email', { email, error: error.message });
        throw error;
    }
};

/**
 * Queue notification email
 * @param {string} email - Recipient email
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @param {string} html - HTML content
 * @returns {Promise<Object>} Job instance
 */
export const queueNotificationEmail = async (email, subject, message, html) => {
    try {
        const job = await addJob('email', 'notification', {
            type: 'notification',
            data: { email, subject, message, html }
        }, {
            priority: 2, // Normal priority
            removeOnComplete: true
        });
        
        logger.info('Notification email queued', { email, jobId: job.id });
        return job;
    } catch (error) {
        logger.error('Failed to queue notification email', { email, error: error.message });
        throw error;
    }
};

export default {
    queueWelcomeEmail,
    queuePasswordResetEmail,
    queueNotificationEmail
};

