/**
 * Auto Check-Out Job
 * CRON job to automatically check out employees at configured time
 * Runs every minute to check for auto check-out time
 */

import { Worker } from 'bullmq';
import logger from '../helpers/logger.js';
import { getRedisConfig, isRedisConnected } from '../config/redis.js';
import Attendance from '../models/attendance.model.js';
import AttendanceRule from '../models/attendanceRule.model.js';
import { sendNotification } from '../helpers/notificationService.js';
import {
    getAttendanceDayContext,
    buildOrgTodayAttendanceFilter,
} from '../helpers/attendanceDayHelper.js';
import {
    getExpectedWorkingHoursFromRule,
    getEffectiveOfficeEndForEarlyDeparture,
} from '../helpers/attendanceSecurityHelper.js';
import { getCachedEffectiveTimezone } from '../helpers/orgContextCache.js';
import { DateTime } from 'luxon';

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

/**
 * Process auto check-out for all active attendance records
 */
async function processAutoCheckOut() {
    try {
        const now = new Date();

        // Get all active attendance rules with auto check-out enabled
        const rules = await AttendanceRule.find({
            isActive: true,
            'autoCheckOut.enabled': true
        }).lean();

        let processedCount = 0;
        let errorCount = 0;

        for (const rule of rules) {
            try {
                const autoCheckOutTime = rule.autoCheckOut.time; // e.g. "18:00"

                // Compare current time in the ORG's timezone, not server local time
                const orgTimezone = await getCachedEffectiveTimezone(rule.organizationId);
                const currentTimeInOrg = DateTime.now().setZone(orgTimezone).toFormat('HH:mm');

                if (currentTimeInOrg === autoCheckOutTime) {
                    const dayContext = await getAttendanceDayContext(rule.organizationId, now);
                    // Find all employees checked in but not checked out for this organization
                    const activeAttendances = await Attendance.find({
                        ...buildOrgTodayAttendanceFilter(rule.organizationId, dayContext),
                        clockIn: { $exists: true },
                        clockOut: { $exists: false },
                    }).populate('userId', 'name email').lean();

                    for (const attendance of activeAttendances) {
                        try {
                            // Use findById + save so the pre-save hook runs and
                            // calculates effectiveHours, grossHours, overtimeHours,
                            // isEarlyDeparture correctly.
                            const doc = await Attendance.findById(attendance._id);
                            if (!doc || doc.clockOut) continue;

                            const clockOutTime = new Date();
                            doc.clockOut = clockOutTime;
                            doc.autoCheckedOut = true;

                            // Close any open breaks before saving
                            for (const b of doc.breaks || []) {
                                if (b.breakIn && !b.breakOut) {
                                    b.breakOut = clockOutTime;
                                    const ms = clockOutTime - new Date(b.breakIn);
                                    doc.totalBreakDuration = (doc.totalBreakDuration || 0) + ms;
                                }
                            }

                            // Determine status: half-day if effective hours < half expected
                            const grossMs = clockOutTime - new Date(doc.clockIn);
                            const breakMs = doc.totalBreakDuration || 0;
                            const effectiveHours = (grossMs - breakMs) / (1000 * 60 * 60);
                            const expectedHours = getExpectedWorkingHoursFromRule(rule, doc.date || doc.clockIn);
                            doc.status = effectiveHours < expectedHours / 2 ? 'half-day' : 'present';

                            await doc.save(); // triggers pre-save hook for hour calculations

                            // Send notification
                            if (attendance.userId) {
                                await sendNotification({
                                    userId: attendance.userId._id,
                                    title: 'Auto Check-Out',
                                    message: `You have been automatically checked out at ${autoCheckOutTime}`,
                                    type: 'auto_checkout',
                                    priority: 'medium',
                                    metadata: {
                                        checkOutTime: autoCheckOutTime,
                                        attendanceId: attendance._id
                                    }
                                });
                            }

                            processedCount++;

                            logger.info('Auto check-out processed', {
                                attendanceId: attendance._id,
                                userId: attendance.userId?._id,
                                time: autoCheckOutTime,
                                status: doc.status,
                                effectiveHours: doc.effectiveHours
                            });
                        } catch (error) {
                            errorCount++;
                            logger.error('Error processing auto check-out for attendance', {
                                error: error.message,
                                attendanceId: attendance._id,
                                stack: error.stack
                            });
                        }
                    }
                }
            } catch (error) {
                errorCount++;
                logger.error('Error processing auto check-out for rule', {
                    error: error.message,
                    ruleId: rule._id,
                    stack: error.stack
                });
            }
        }

        if (processedCount > 0) {
            logger.info('Auto check-out job completed', {
                processedCount,
                errorCount
            });
        }

        return {
            success: true,
            processedCount,
            errorCount
        };
    } catch (error) {
        logger.error('Auto check-out job error', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Send pre-checkout notifications (X minutes before auto check-out)
 */
async function sendPreCheckOutNotifications() {
    try {
        const now = new Date();

        const rules = await AttendanceRule.find({
            isActive: true,
            'autoCheckOut.enabled': true
        }).lean();

        let notifiedCount = 0;

        for (const rule of rules) {
            try {
                const autoCheckOutTime = rule.autoCheckOut.time;
                const notifyBeforeMinutes = rule.autoCheckOut.notifyBeforeMinutes || 15;

                // Calculate notification time in org timezone
                const orgTimezone = await getCachedEffectiveTimezone(rule.organizationId);
                const currentTimeInOrg = DateTime.now().setZone(orgTimezone).toFormat('HH:mm');
                const notificationTimeStr = DateTime.now()
                    .setZone(orgTimezone)
                    .set({
                        hour: parseInt(autoCheckOutTime.split(':')[0], 10),
                        minute: parseInt(autoCheckOutTime.split(':')[1], 10),
                        second: 0
                    })
                    .minus({ minutes: notifyBeforeMinutes })
                    .toFormat('HH:mm');

                if (currentTimeInOrg === notificationTimeStr) {
                    const dayContext = await getAttendanceDayContext(rule.organizationId, now);

                    // Find all employees checked in but not checked out
                    const activeAttendances = await Attendance.find({
                        ...buildOrgTodayAttendanceFilter(rule.organizationId, dayContext),
                        clockIn: { $exists: true },
                        clockOut: { $exists: false },
                    }).populate('userId', 'name email').lean();

                    for (const attendance of activeAttendances) {
                        try {
                            if (attendance.userId) {
                                await sendNotification({
                                    userId: attendance.userId._id,
                                    title: 'Auto Check-Out Reminder',
                                    message: `You will be automatically checked out in ${notifyBeforeMinutes} minutes at ${autoCheckOutTime}`,
                                    type: 'auto_checkout_reminder',
                                    priority: 'medium',
                                    metadata: {
                                        checkOutTime: autoCheckOutTime,
                                        minutesRemaining: notifyBeforeMinutes
                                    }
                                });

                                notifiedCount++;
                            }
                        } catch (error) {
                            logger.error('Error sending pre-checkout notification', {
                                error: error.message,
                                attendanceId: attendance._id
                            });
                        }
                    }
                }
            } catch (error) {
                logger.error('Error processing pre-checkout notifications for rule', {
                    error: error.message,
                    ruleId: rule._id
                });
            }
        }

        if (notifiedCount > 0) {
            logger.info('Pre-checkout notifications sent', {
                notifiedCount,
                currentTime
            });
        }

        return {
            success: true,
            notifiedCount
        };
    } catch (error) {
        logger.error('Pre-checkout notification job error', {
            error: error.message,
            stack: error.stack
        });
        return {
            success: false,
            error: error.message
        };
    }
}

/**
 * Create and start the worker
 */
export function startAutoCheckOutWorker() {
    const worker = new Worker(
        'auto-checkout',
        async (job) => {
            logger.debug('Auto check-out job started', {
                jobId: job.id,
                attempt: job.attemptsMade + 1
            });

            // Process auto check-out
            const result = await processAutoCheckOut();
            
            // Send pre-checkout notifications
            const notificationResult = await sendPreCheckOutNotifications();

            return {
                ...result,
                notifications: notificationResult
            };
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
        logger.debug('Auto check-out job completed successfully', {
            jobId: job.id
        });
    });

    worker.on('failed', (job, err) => {
        logger.error('Auto check-out job failed', {
            jobId: job?.id,
            error: err.message,
            stack: err.stack
        });
    });

    logger.info('Auto check-out worker started');

    return worker;
}

/**
 * Schedule auto check-out job (runs every minute to check for auto check-out time)
 */
export async function scheduleAutoCheckOut() {
    try {
        const { Queue } = await import('bullmq');
        const connection = getConnection();
        if (!connection) {
            logger.warn('Cannot schedule auto check-out job - Redis not available');
            return;
        }
        const queue = new Queue('auto-checkout', {
            connection: connection
        });

        // Schedule every minute
        await queue.add(
            'auto-checkout-check',
            {},
            {
                repeat: {
                    pattern: '* * * * *', // Every minute
                    tz: 'UTC'
                },
                jobId: 'auto-checkout-minute',
                removeOnComplete: true
            }
        );

        logger.info('Auto check-out job scheduled (every minute)');
    } catch (error) {
        logger.error('Failed to schedule auto check-out job', {
            error: error.message,
            stack: error.stack
        });
    }
}

export default {
    startAutoCheckOutWorker,
    scheduleAutoCheckOut,
    processAutoCheckOut,
    sendPreCheckOutNotifications
};

