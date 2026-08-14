/**
 * Approval Timeout Job
 * Delegates to step-timeout escalation (notify next step; no auto-approve).
 * Kept for Redis/BullMQ scheduling compatibility; cron SLA job is the primary path.
 */

import { Worker } from 'bullmq';
import logger from '../helpers/logger.js';
import { getRedisConfig, isRedisConnected } from '../config/redis.js';
import { processApprovalSlaEscalations } from './approvalSlaEscalationJob.js';

const getConnection = () => {
    if (!isRedisConnected()) {
        return null;
    }
    try {
        const redisConfig = getRedisConfig();
        return {
            host: redisConfig.socket?.host || process.env.REDIS_HOST || 'localhost',
            port: parseInt(process.env.REDIS_PORT || '6379', 10),
            password: redisConfig.password,
            db: redisConfig.database,
            retryStrategy: (times) => {
                if (times > 10) return null;
                return Math.min(times * 100, 3000);
            },
            enableOfflineQueue: false,
            maxRetriesPerRequest: null,
        };
    } catch (error) {
        logger.debug('Redis configuration failed', { error: error.message });
        return null;
    }
};

/**
 * Process expired approval steps via step-timeout escalation (no auto-approve).
 */
async function processExpiredApprovals() {
    return processApprovalSlaEscalations();
}

/**
 * Create and start the worker
 */
export function startApprovalTimeoutWorker() {
    const connection = getConnection();
    if (!connection) {
        logger.warn('Approval timeout worker not started - Redis not available');
        return null;
    }

    const worker = new Worker(
        'approval-timeout',
        async (job) => {
            logger.info('Approval timeout job started', {
                jobId: job.id,
                attempt: job.attemptsMade + 1,
            });

            const result = await processExpiredApprovals();

            logger.info('Approval timeout job completed', {
                jobId: job.id,
                result,
            });

            return result;
        },
        {
            connection,
            concurrency: 1,
            removeOnComplete: {
                count: 100,
                age: 7 * 24 * 3600,
            },
            removeOnFail: {
                count: 1000,
            },
        }
    );

    worker.on('completed', (job) => {
        logger.info('Approval timeout job completed successfully', {
            jobId: job.id,
        });
    });

    worker.on('failed', (job, err) => {
        logger.error('Approval timeout job failed', {
            jobId: job?.id,
            error: err.message,
            stack: err.stack,
        });
    });

    logger.info('Approval timeout worker started (delegates to step-timeout escalation)');

    return worker;
}

/**
 * Schedule approval timeout check (runs every hour)
 */
export async function scheduleApprovalTimeout() {
    const connection = getConnection();
    if (!connection) {
        logger.warn('Cannot schedule approval timeout - Redis not available');
        return;
    }

    try {
        const { Queue } = await import('bullmq');
        const queue = new Queue('approval-timeout', { connection });

        await queue.add(
            'check-expired-approvals',
            {},
            {
                repeat: {
                    pattern: '0 * * * *',
                    tz: 'UTC',
                },
                jobId: 'approval-timeout-recurring',
            }
        );

        logger.info(
            'Approval timeout job scheduled (hourly; step-timeout escalation, no auto-approve)'
        );
    } catch (error) {
        logger.error('Failed to schedule approval timeout job', {
            error: error.message,
            stack: error.stack,
        });
    }
}
