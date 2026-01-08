/**
 * Comp-Off Expiry Job
 * CRON job to automatically expire comp-off days based on validity period
 * Runs daily at midnight
 */

import { Worker } from 'bullmq';
import logger from '../helpers/logger.js';
import { getRedisConfig, isRedisConnected } from '../config/redis.js';

// Get Redis connection config
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
            maxRetriesPerRequest: null
        };
    } catch (error) {
        logger.debug('Redis configuration failed', { error: error.message });
        return null;
    }
};

// Import models
let CompOff, Employee;

/**
 * Initialize models (lazy load to avoid circular dependencies)
 */
async function initializeModels() {
    if (!CompOff) {
        const module = await import('../models/compOff.model.js');
        CompOff = module.default;
    }
    if (!Employee) {
        const module = await import('../models/employee.model.js');
        Employee = module.default;
    }
}

/**
 * Process comp-off expiry
 */
async function processCompOffExpiry() {
    try {
        await initializeModels();

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find all active comp-offs
        const activeCompOffs = await CompOff.find({
            status: 'approved',
            isExpired: false
        }).populate('employeeId', 'name email organizationId').lean();

        let expiredCount = 0;
        let errorCount = 0;

        for (const compOff of activeCompOffs) {
            try {
                // Get attendance rule to check validity period
                const AttendanceRule = (await import('../models/attendanceRule.model.js')).default;
                const rule = await AttendanceRule.findOne({
                    organizationId: compOff.employeeId.organizationId,
                    isActive: true
                }).lean();

                const validityDays = rule?.compOffRules?.validity || 90; // Default 90 days

                // Calculate expiry date
                const createdDate = new Date(compOff.createdAt);
                const expiryDate = new Date(createdDate);
                expiryDate.setDate(expiryDate.getDate() + validityDays);

                // Check if expired
                if (today > expiryDate) {
                    // Mark as expired
                    await CompOff.updateOne(
                        { _id: compOff._id },
                        {
                            $set: {
                                isExpired: true,
                                expiredAt: today,
                                status: 'expired'
                            }
                        }
                    );

                    expiredCount++;

                    // Notify employee
                    try {
                        const { sendNotification } = await import('../helpers/notificationService.js');
                        await sendNotification({
                            userId: compOff.employeeId._id,
                            title: 'Comp-Off Expired',
                            message: `Your comp-off for ${compOff.date} has expired after ${validityDays} days.`,
                            type: 'comp_off_expiry',
                            priority: 'medium',
                            metadata: {
                                compOffId: compOff._id,
                                date: compOff.date,
                                validityDays
                            }
                        });
                    } catch (notifError) {
                        logger.warn('Failed to send comp-off expiry notification', {
                            error: notifError.message,
                            compOffId: compOff._id
                        });
                    }

                    logger.info('Comp-off expired', {
                        compOffId: compOff._id,
                        employeeId: compOff.employeeId._id,
                        date: compOff.date,
                        expiryDate
                    });
                }
            } catch (error) {
                errorCount++;
                logger.error('Error processing comp-off expiry', {
                    error: error.message,
                    compOffId: compOff._id,
                    stack: error.stack
                });
            }
        }

        logger.info('Comp-off expiry job completed', {
            totalProcessed: activeCompOffs.length,
            expiredCount,
            errorCount
        });

        return {
            success: true,
            totalProcessed: activeCompOffs.length,
            expiredCount,
            errorCount
        };

    } catch (error) {
        logger.error('Comp-off expiry job error', {
            error: error.message,
            stack: error.stack
        });

        throw error;
    }
}

/**
 * Create and start the worker
 */
export function startCompOffExpiryWorker() {
    const worker = new Worker(
        'comp-off-expiry',
        async (job) => {
            logger.info('Comp-off expiry job started', {
                jobId: job.id,
                attempt: job.attemptsMade + 1
            });

            const result = await processCompOffExpiry();

            logger.info('Comp-off expiry job completed', {
                jobId: job.id,
                result
            });

            return result;
        },
        {
            connection: getConnection(),
            concurrency: 1, // Process one job at a time
            removeOnComplete: {
                count: 100, // Keep last 100 completed jobs
                age: 7 * 24 * 3600 // 7 days
            },
            removeOnFail: {
                count: 1000 // Keep last 1000 failed jobs
            }
        }
    );

    worker.on('completed', (job) => {
        logger.info('Comp-off expiry job completed successfully', {
            jobId: job.id
        });
    });

    worker.on('failed', (job, err) => {
        logger.error('Comp-off expiry job failed', {
            jobId: job?.id,
            error: err.message,
            stack: err.stack
        });
    });

    logger.info('Comp-off expiry worker started');

    return worker;
}

/**
 * Schedule daily comp-off expiry check
 * This should be called from the main job scheduler
 */
export async function scheduleCompOffExpiry() {
    try {
        const { Queue } = await import('bullmq');
        const connection = getConnection();
        if (!connection) {
            logger.warn('Cannot schedule comp-off expiry job - Redis not available');
            return;
        }
        const queue = new Queue('comp-off-expiry', {
            connection: connection
        });

        // Schedule daily at midnight (00:00)
        await queue.add(
            'expire-comp-offs',
            {},
            {
                repeat: {
                    pattern: '0 0 * * *', // Cron: Every day at midnight
                    tz: 'UTC'
                },
                jobId: 'comp-off-expiry-daily',
                removeOnComplete: true
            }
        );

        logger.info('Comp-off expiry job scheduled (daily at midnight)');
    } catch (error) {
        logger.error('Failed to schedule comp-off expiry job', {
            error: error.message,
            stack: error.stack
        });
    }
}

export default {
    startCompOffExpiryWorker,
    scheduleCompOffExpiry,
    processCompOffExpiry
};

