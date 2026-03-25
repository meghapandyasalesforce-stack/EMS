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
import { scheduleLeaveBalanceJobs } from './leaveBalanceJob.js';
import { startApprovalTimeoutWorker, scheduleApprovalTimeout } from './approvalTimeoutJob.js';
import logger from '../helpers/logger.js';
import { schedulePayrollRunJobs } from './payrollRunJob.js';

/**
 * Initialize all job workers
 */
export const initializeWorkers = async () => {
    try {
        // Check if Redis is actually connected before creating workers
        if (!isRedisConnected()) {
            logger.info('Redis not connected - skipping queue workers');
            logger.info('Note: The server will continue to work, but email/notification queues require Redis.');

            // Still schedule cron jobs that do not depend on Redis.
            try {
                scheduleLeaveBalanceJobs();
                logger.info('Leave balance jobs scheduled (no-redis mode)');
            } catch (error) {
                logger.error('Failed to schedule leave balance jobs', { error: error.message });
            }

            try {
                schedulePayrollRunJobs();
                logger.info('Payroll run jobs scheduled (no-redis mode)');
            } catch (error) {
                logger.error('Failed to schedule payroll run jobs', { error: error.message });
            }

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

        // Approval Timeout worker
        const approvalTimeoutWorker = startApprovalTimeoutWorker();
        if (approvalTimeoutWorker) {
            logger.info('Approval timeout worker initialized');
            // Schedule hourly approval timeout check
            await scheduleApprovalTimeout();
        } else {
            logger.warn('Approval timeout worker not initialized - Redis not available');
        }

        // Leave Balance Jobs (cron-based, no Redis required)
        try {
            scheduleLeaveBalanceJobs();
            logger.info('Leave balance jobs scheduled');
        } catch (error) {
            logger.error('Failed to schedule leave balance jobs', { error: error.message });
        }

        // Payroll run jobs (cron-based, no Redis required)
        try {
            schedulePayrollRunJobs();
            logger.info('Payroll run jobs scheduled');
        } catch (error) {
            logger.error('Failed to schedule payroll run jobs', { error: error.message });
        }

        if (emailWorker && notificationWorker && compOffExpiryWorker && autoCheckOutWorker && approvalTimeoutWorker) {
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

