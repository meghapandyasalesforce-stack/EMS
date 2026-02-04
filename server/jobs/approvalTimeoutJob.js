/**
 * Approval Timeout Job
 * Background job to automatically approve expired approval steps
 * Runs every hour to check for expired approvals
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
let ApprovalInstance, ApprovalWorkflow, Employee;

/**
 * Initialize models (lazy load to avoid circular dependencies)
 */
async function initializeModels() {
    if (!ApprovalInstance || !ApprovalWorkflow) {
        const module = await import('../models/approvalWorkflow.model.js');
        ApprovalInstance = module.ApprovalInstance;
        ApprovalWorkflow = module.ApprovalWorkflow;
    }
    if (!Employee) {
        const module = await import('../models/employee.model.js');
        Employee = module.default;
    }
}

/**
 * Process expired approval steps
 */
async function processExpiredApprovals() {
    try {
        await initializeModels();

        const now = new Date();
        let processedCount = 0;
        let errorCount = 0;

        // Find all approval instances with expired pending steps
        const instances = await ApprovalInstance.find({
            status: 'In Progress',
            'steps.status': 'Pending',
            'steps.dueDate': { $lt: now }
        }).lean();

        logger.info('Processing expired approvals', {
            totalInstances: instances.length
        });

        for (const instance of instances) {
            try {
                // Get full instance with workflow
                const fullInstance = await ApprovalInstance.findById(instance._id);
                if (!fullInstance || fullInstance.status !== 'In Progress') {
                    continue;
                }

                const workflow = await ApprovalWorkflow.findById(fullInstance.workflowId);
                if (!workflow) {
                    logger.warn('Workflow not found for instance', {
                        instanceId: instance._id,
                        workflowId: fullInstance.workflowId
                    });
                    continue;
                }

                // Find expired pending steps (get step numbers)
                const expiredStepNumbers = fullInstance.steps
                    .filter(step => {
                        if (step.status !== 'Pending') return false;
                        if (!step.dueDate) return false;
                        return new Date(step.dueDate) < now;
                    })
                    .map(step => step.stepNumber);

                if (expiredStepNumbers.length === 0) {
                    continue;
                }

                // Process each expired step
                for (const stepNumber of expiredStepNumbers) {
                    const step = fullInstance.steps.find(s => s.stepNumber === stepNumber);
                    if (!step) continue;

                    const workflowStep = workflow.steps.find(s => s.stepNumber === stepNumber);
                    if (!workflowStep) continue;

                    // Auto-approve expired step
                    step.status = 'Approved'; // Auto-approved due to timeout
                    step.action = 'Approve';
                    step.comments = `Auto-approved due to timeout (expired after ${workflowStep.timeoutHours || 48} hours)`;
                    step.actionDate = now;

                    logger.info('Auto-approved expired step', {
                        instanceId: fullInstance._id,
                        stepNumber: step.stepNumber,
                        stepName: step.stepName,
                        timeoutHours: workflowStep.timeoutHours || 48
                    });
                }

                // Check if all required steps are approved
                const allApproved = fullInstance.steps
                    .filter(s => {
                        const ws = workflow.steps.find(w => w.stepNumber === s.stepNumber);
                        return ws?.isRequired !== false; // Default to required
                    })
                    .every(s => s.status === 'Approved' || s.status === 'Skipped');

                if (allApproved) {
                    fullInstance.status = 'Approved';
                    fullInstance.approvedAt = now;
                    fullInstance.currentStep = fullInstance.steps.length;

                    // Update entity status
                    try {
                        await updateEntityStatus(fullInstance);
                    } catch (entityError) {
                        logger.warn('Error updating entity status after timeout approval', {
                            error: entityError.message,
                            instanceId: fullInstance._id
                        });
                    }

                    // Notify requester
                    try {
                        const { sendNotification } = await import('../helpers/notificationService.js');
                        await sendNotification({
                            userId: fullInstance.requestedBy,
                            title: `Approval Approved: ${fullInstance.entityType}`,
                            message: `Your ${fullInstance.entityType} request has been auto-approved due to timeout.`,
                            type: 'approval_approved',
                            priority: 'medium',
                            metadata: {
                                approvalInstanceId: fullInstance._id,
                                entityType: fullInstance.entityType,
                                entityId: fullInstance.entityId,
                                autoApproved: true
                            }
                        });
                    } catch (notifError) {
                        logger.warn('Failed to send timeout approval notification', {
                            error: notifError.message,
                            instanceId: fullInstance._id
                        });
                    }

                    logger.info('Workflow auto-approved due to timeout', {
                        instanceId: fullInstance._id,
                        entityType: fullInstance.entityType
                    });
                } else {
                    // Move to next step if not all approved
                    fullInstance.currentStep = expiredStepNumbers[0];
                    
                    // Process next step
                    try {
                        const { processNextStep } = await import('../services/approvalWorkflowService.js');
                        // Note: processNextStep is not exported, so we'll handle it here
                        const nextPendingStep = fullInstance.steps.find(s => s.status === 'Pending');
                        if (nextPendingStep) {
                            // Notify next approver
                            try {
                                const { sendNotification } = await import('../helpers/notificationService.js');
                                const requester = await Employee.findById(fullInstance.requestedBy);
                                const approver = await Employee.findById(nextPendingStep.approverId);
                                
                                if (approver) {
                                    await sendNotification({
                                        userId: approver._id,
                                        title: `Approval Required: ${fullInstance.entityType}`,
                                        message: `${requester?.name || 'Someone'} has requested approval for ${fullInstance.entityType}. Step: ${nextPendingStep.stepName || `Step ${nextPendingStep.stepNumber}`}`,
                                        type: 'approval_request',
                                        priority: fullInstance.priority === 'Urgent' ? 'high' : 'medium',
                                        metadata: {
                                            approvalInstanceId: fullInstance._id,
                                            entityType: fullInstance.entityType,
                                            entityId: fullInstance.entityId,
                                            stepNumber: nextPendingStep.stepNumber
                                        }
                                    });
                                }
                            } catch (notifError) {
                                logger.warn('Failed to notify next approver', {
                                    error: notifError.message,
                                    instanceId: fullInstance._id
                                });
                            }
                        }
                    } catch (nextStepError) {
                        logger.warn('Error processing next step after timeout', {
                            error: nextStepError.message,
                            instanceId: fullInstance._id
                        });
                    }
                }

                await fullInstance.save();
                processedCount++;

            } catch (error) {
                errorCount++;
                logger.error('Error processing expired approval instance', {
                    error: error.message,
                    instanceId: instance._id,
                    stack: error.stack
                });
            }
        }

        logger.info('Expired approvals processing completed', {
            processedCount,
            errorCount,
            totalInstances: instances.length
        });

        return {
            processedCount,
            errorCount,
            totalInstances: instances.length
        };
    } catch (error) {
        logger.error('Error processing expired approvals', {
            error: error.message,
            stack: error.stack
        });
        throw error;
    }
}

/**
 * Update entity status when workflow completes
 */
async function updateEntityStatus(instance) {
    try {
        if (instance.entityType === 'Leave') {
            const Leave = (await import('../models/leave.model.js')).default;
            const leave = await Leave.findById(instance.entityId);
            if (leave) {
                if (instance.status === 'Approved') {
                    leave.status = 'approved';
                    leave.approvedBy = instance.steps[instance.steps.length - 1]?.approverId;
                    leave.approvedAt = new Date();
                    
                    // Update leave balance
                    try {
                        const leaveBalanceEngine = (await import('../services/leaveBalanceEngine.js')).default;
                        const year = new Date(leave.startDate).getFullYear();
                        await leaveBalanceEngine.calculateBalance(leave.employee, year, leave.organizationId);
                    } catch (balanceError) {
                        logger.warn('Error updating leave balance after timeout approval', {
                            error: balanceError.message,
                            leaveId: leave._id
                        });
                    }
                }
                await leave.save();
            }
        }
        // Add other entity types (Expense, Document, etc.) as needed
    } catch (error) {
        logger.error('Error updating entity status', {
            error: error.message,
            entityType: instance.entityType,
            entityId: instance.entityId,
            stack: error.stack
        });
    }
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
                attempt: job.attemptsMade + 1
            });

            const result = await processExpiredApprovals();

            logger.info('Approval timeout job completed', {
                jobId: job.id,
                result
            });

            return result;
        },
        {
            connection,
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
        logger.info('Approval timeout job completed successfully', {
            jobId: job.id
        });
    });

    worker.on('failed', (job, err) => {
        logger.error('Approval timeout job failed', {
            jobId: job?.id,
            error: err.message,
            stack: err.stack
        });
    });

    logger.info('Approval timeout worker started');

    return worker;
}

/**
 * Schedule approval timeout check (runs every hour)
 * This should be called from the main job scheduler
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

        // Schedule recurring job (every hour)
        await queue.add(
            'check-expired-approvals',
            {},
            {
                repeat: {
                    pattern: '0 * * * *', // Every hour at minute 0
                    tz: 'UTC'
                },
                jobId: 'approval-timeout-recurring'
            }
        );

        logger.info('Approval timeout job scheduled (runs every hour)');
    } catch (error) {
        logger.error('Failed to schedule approval timeout job', {
            error: error.message,
            stack: error.stack
        });
    }
}

