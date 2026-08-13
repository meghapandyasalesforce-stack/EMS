/**
 * Approval step-timeout escalation (additive)
 * Uses each workflow step's timeoutHours / instance step dueDate.
 * When the current pending step exceeds its timer:
 *  - mark step + instance as escalated
 *  - notify the next step's approver that they may act
 *  - previous step approver keeps Approve/Reject
 * Does not auto-approve. Runs once per step (steps.escalated).
 */

import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { ApprovalInstance, ApprovalWorkflow } from '../models/approvalWorkflow.model.js';
import Employee from '../models/employee.model.js';
import { sendNotification } from '../helpers/notificationService.js';
import { appendAuditEvent } from '../services/approvalWorkflowService.js';

const DEFAULT_STEP_TIMEOUT_HOURS = 48;

const uniqueIds = (ids) => [...new Set(ids.map((id) => String(id)).filter(Boolean))];

const sortSteps = (steps = []) =>
    [...steps].sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0));

const resolveStepTimeoutHours = (workflowStep) => {
    const hours = Number(workflowStep?.timeoutHours);
    return hours > 0 ? hours : DEFAULT_STEP_TIMEOUT_HOURS;
};

const isStepDue = (step, workflowStep, now, instanceCreatedAt) => {
    if (!step || step.status !== 'Pending' || step.escalated) return false;
    if (step.dueDate) {
        return new Date(step.dueDate).getTime() <= now.getTime();
    }
    // Legacy instances without dueDate: approximate from request createdAt + step timeout
    const hours = resolveStepTimeoutHours(workflowStep);
    const start = instanceCreatedAt ? new Date(instanceCreatedAt).getTime() : 0;
    if (!start) return false;
    return now.getTime() - start >= hours * 60 * 60 * 1000;
};

/**
 * Process step-timeout escalations for pending approvals.
 */
export async function processApprovalSlaEscalations() {
    const now = new Date();
    let escalatedCount = 0;
    let errorCount = 0;

    try {
        const candidates = await ApprovalInstance.find({
            status: 'In Progress',
            'steps.status': 'Pending',
            'steps.escalated': { $ne: true },
        })
            .select(
                '_id organizationId workflowId requestedBy entityType entityId createdAt steps status auditTrail slaEscalated'
            )
            .lean();

        if (!candidates.length) {
            return { escalatedCount: 0, errorCount: 0 };
        }

        const workflowIds = [
            ...new Set(candidates.map((c) => String(c.workflowId)).filter(Boolean)),
        ];
        const workflows = await ApprovalWorkflow.find({ _id: { $in: workflowIds } })
            .select('steps.stepNumber steps.stepName steps.approverType steps.timeoutHours')
            .lean();
        const workflowMap = new Map(workflows.map((w) => [String(w._id), w]));

        for (const lean of candidates) {
            try {
                const workflow = workflowMap.get(String(lean.workflowId));
                if (!workflow) continue;

                const workflowStepByNumber = new Map(
                    (workflow.steps || []).map((s) => [s.stepNumber, s])
                );
                const sorted = sortSteps(lean.steps);
                const pendingStep = sorted.find((s) => s.status === 'Pending');
                if (!pendingStep || pendingStep.escalated) continue;

                const workflowStep = workflowStepByNumber.get(pendingStep.stepNumber);
                if (!isStepDue(pendingStep, workflowStep, now, lean.createdAt)) continue;

                const hours = resolveStepTimeoutHours(workflowStep);
                const nextStep = sorted.find(
                    (s) => (s.stepNumber || 0) > (pendingStep.stepNumber || 0)
                );
                const nextWorkflowStep = nextStep
                    ? workflowStepByNumber.get(nextStep.stepNumber)
                    : null;

                const instance = await ApprovalInstance.findOneAndUpdate(
                    {
                        _id: lean._id,
                        status: 'In Progress',
                        steps: {
                            $elemMatch: {
                                stepNumber: pendingStep.stepNumber,
                                status: 'Pending',
                                escalated: { $ne: true },
                            },
                        },
                    },
                    {
                        $set: {
                            slaEscalated: true,
                            slaEscalatedAt: now,
                            'steps.$.escalated': true,
                            'steps.$.escalatedAt': now,
                        },
                    },
                    { new: true }
                );
                if (!instance) continue;

                appendAuditEvent(instance, {
                    action: 'sla_escalated',
                    note: nextStep
                        ? `Step ${pendingStep.stepNumber} timed out after ${hours}h — next step (${nextStep.stepName || nextStep.stepNumber}) notified`
                        : `Step ${pendingStep.stepNumber} timed out after ${hours}h — no next step`,
                });
                await instance.save();

                const requester = await Employee.findById(instance.requestedBy)
                    .select('name lastName')
                    .lean();
                const requesterName =
                    [requester?.name, requester?.lastName].filter(Boolean).join(' ').trim() ||
                    'Someone';

                const currentApproverId = pendingStep.approverId;
                const nextApproverId = nextStep?.approverId;

                const notifySafe = async (userId, payload) => {
                    if (!userId) return false;
                    try {
                        await sendNotification({
                            userId,
                            title: payload.title,
                            message: payload.message,
                            type: 'approval_sla_escalation',
                            priority: 'high',
                            metadata: {
                                approvalInstanceId: instance._id,
                                entityType: instance.entityType,
                                entityId: instance.entityId,
                                stepNumber: pendingStep.stepNumber,
                                nextStepNumber: nextStep?.stepNumber || null,
                                slaHours: hours,
                                audience: payload.audience,
                            },
                        });
                        return true;
                    } catch (err) {
                        logger.warn('Step timeout escalation push failed', {
                            error: err.message,
                            userId,
                            instanceId: instance._id,
                        });
                        return false;
                    }
                };

                // Current step approver — reminder (they can still act)
                if (currentApproverId) {
                    const sent = await notifySafe(currentApproverId, {
                        audience: 'current_approver',
                        title: 'Approval Reminder',
                        message: `This ${instance.entityType} request has exceeded the ${hours}-hour step window. Please take action${
                            nextStep ? ', or the next approver may act' : ''
                        }.`,
                    });
                    if (sent) {
                        appendAuditEvent(instance, {
                            action: 'push_notifications_sent',
                            actorRole: pendingStep.approverName || 'CurrentApprover',
                            note: 'Current-step timeout reminder sent',
                        });
                    }
                }

                // Next step approver — authority granted
                if (nextApproverId) {
                    const nextLabel =
                        nextStep.stepName ||
                        nextWorkflowStep?.approverType ||
                        `Step ${nextStep.stepNumber}`;
                    const sent = await notifySafe(nextApproverId, {
                        audience: 'next_approver',
                        title: 'Approval Escalated',
                        message: `${requesterName}'s ${instance.entityType} request exceeded the previous step's ${hours}-hour window. You may now approve or reject it (${nextLabel}). The previous approver can still act.`,
                    });
                    if (sent) {
                        appendAuditEvent(instance, {
                            action: 'push_notifications_sent',
                            actorId: nextApproverId,
                            actorRole: nextWorkflowStep?.approverType || 'NextStep',
                            note: 'Next-step timeout authority notification sent',
                        });
                    }
                } else if (!nextStep) {
                    // Last step timed out — notify org HR-like employees for follow-up
                    const orgEmployees = await Employee.find({
                        organizationId: instance.organizationId,
                        status: 'active',
                    })
                        .select('functionalRoles jobTitle position')
                        .lean();
                    const hrIds = orgEmployees
                        .filter((e) => {
                            const roles = (e.functionalRoles || []).map((r) =>
                                String(r).toLowerCase()
                            );
                            if (roles.includes('hr')) return true;
                            const title = `${e.jobTitle || ''} ${e.position || ''}`.toLowerCase();
                            return (
                                title.includes('hr manager') ||
                                title.includes('hr executive') ||
                                title.includes('human resource')
                            );
                        })
                        .map((e) => e._id);

                    let notified = 0;
                    for (const userId of uniqueIds(hrIds)) {
                        const ok = await notifySafe(userId, {
                            audience: 'hr_followup',
                            title: 'Approval SLA Exceeded',
                            message: `A ${instance.entityType} request has exceeded its final step timeout (${hours}h) and still needs action.`,
                        });
                        if (ok) notified += 1;
                    }
                    if (notified > 0) {
                        appendAuditEvent(instance, {
                            action: 'push_notifications_sent',
                            actorRole: 'HR',
                            note: `Final-step timeout follow-up sent (${notified})`,
                        });
                    }
                }

                // Requester awareness
                if (instance.requestedBy) {
                    await notifySafe(instance.requestedBy, {
                        audience: 'employee',
                        title: 'Approval Pending',
                        message: nextStep
                            ? `Your ${instance.entityType} request has been pending beyond the step window. The next approver has been notified and may process it.`
                            : `Your ${instance.entityType} request has been pending beyond the step window. Follow-up has been requested.`,
                    });
                }

                await instance.save();
                escalatedCount += 1;
                logger.info('Approval step timeout escalation processed', {
                    instanceId: instance._id,
                    entityType: instance.entityType,
                    stepNumber: pendingStep.stepNumber,
                    nextStepNumber: nextStep?.stepNumber || null,
                    hours,
                });
            } catch (err) {
                errorCount += 1;
                logger.error('Error processing step timeout escalation', {
                    error: err.message,
                    instanceId: lean._id,
                });
            }
        }
    } catch (error) {
        logger.error('Approval step timeout escalation job failed', {
            error: error.message,
            stack: error.stack,
        });
        errorCount += 1;
    }

    return { escalatedCount, errorCount };
}

/**
 * Schedule step-timeout escalation cron (every 15 minutes). Works without Redis.
 */
export function scheduleApprovalSlaEscalationJobs() {
    cron.schedule('*/15 * * * *', async () => {
        try {
            const result = await processApprovalSlaEscalations();
            if (result.escalatedCount > 0) {
                logger.info('Approval step timeout escalation tick', result);
            }
        } catch (error) {
            logger.error('Approval step timeout escalation cron error', {
                error: error.message,
            });
        }
    });
    logger.info(
        'Approval step timeout escalation job scheduled (every 15 minutes, per-step timeoutHours)'
    );
}

export default {
    processApprovalSlaEscalations,
    scheduleApprovalSlaEscalationJobs,
};
