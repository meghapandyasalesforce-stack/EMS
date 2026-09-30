/**
 * Email Job Processor
 * Handles email sending in background queue
 */

import { sendWelcomeEmail } from '../helpers/emailSender.js';
import logger from '../helpers/logger.js';

/**
 * Process email job
 * @param {Object} job - BullMQ job instance
 * @returns {Promise<Object>} Job result
 */
export const processEmailJob = async (job) => {
    const { type, data } = job.data;

    try {
        switch (type) {
            case 'welcome':
                await sendWelcomeEmail(
                    data.email,
                    data.name,
                    data.password,
                    data.resetUrl
                );
                break;

            case 'password-reset':
                // Import password reset email function when available
                const { sendPasswordResetEmail } = await import('../helpers/emailSender.js');
                await sendPasswordResetEmail(data.email, data.name, data.resetUrl);
                break;

            case 'notification':
                // Import notification email function when available
                const { sendNotificationEmail } = await import('../helpers/emailSender.js');
                await sendNotificationEmail(
                    data.email,
                    data.subject,
                    data.message,
                    data.html
                );
                break;

            default:
                throw new Error(`Unknown email type: ${type}`);
        }

        logger.info('Email job processed successfully', { 
            jobId: job.id, 
            type,
            email: data.email 
        });

        return { success: true, type, email: data.email };
    } catch (error) {
        logger.error('Email job processing failed', { 
            jobId: job.id, 
            type,
            error: error.message,
            stack: error.stack 
        });
        throw error;
    }
};

export default processEmailJob;

