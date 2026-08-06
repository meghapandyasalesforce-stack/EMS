/**
 * Approval SLA Escalation Job (additive)
 * After configurable hours (default 12), send push notifications only
 * (mobile + browser via existing notification service). No emails.
 * Runs once per instance (slaEscalated flag).
 */

import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { ApprovalInstance, ApprovalWorkflow } from '../models/approvalWorkflow.model.js';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import { sendNotification } from '../helpers/notificationService.js';
import { appendAuditEvent } from '../services/approvalWorkflowService.js';

const DEFAULT_ESCALATE_HOURS = 12;

const isHrLike = (employee) => {
    const roles = (employee?.functionalRoles || []).map((r) => String(r).toLowerCase());
    if (roles.includes('hr')) return true;
    const title = `${employee?.jobTitle || ''} ${employee?.position || ''}`.toLowerCase();
    return title.includes('hr manager') || title.includes('hr executive') || title.includes('human resource');
};

const uniqueIds = (ids) => [...new Set(ids.map((id) => String(id)).filter(Boolean))];

const ESCALATION_PUSH = {
    employee: {
        title: 'Approval Pending',
        message:
            'Your request has been pending for more than 12 hours. HR has been notified and may process your request.',
    },
    manager: {
        title: 'Approval Reminder',
        message:
            'This request has been pending for over 12 hours. Please take action or HR may approve/reject it.',
    },
    hr: {
        title: 'Approval Escalated',
        message:
            'This request has exceeded the 12-hour approval SLA. You may now approve or reject it.',
    },
    admin: {
        title: 'Approval SLA Exceeded',
        message:
            'A request has exceeded the approval SLA and has been escalated to HR.',
    },
};

/**
 * Process SLA escalations for pending approvals.
 */
export async function processApprovalSlaEscalations() {
    const now = new Date();
    let escalatedCount = 0;
    let errorCount = 0;

    try {
        const candidates = await ApprovalInstance.find({
            status: 'In Progress',
            slaEscalated: { $ne: true },
            'steps.status': 'Pending',
        })
            .select('_id organizationId workflowId requestedBy entityType entityId createdAt steps status auditTrail slaEscalated')
            .lean();

        if (!candidates.length) {
            return { escalatedCount: 0, errorCount: 0 };
        }

        const workflowIds = [
            ...new Set(candidates.map((c) => String(c.workflowId)).filter(Boolean)),
        ];
        const workflows = await ApprovalWorkflow.find({ _id: { $in: workflowIds } })
            .select('escalation steps.stepNumber steps.approverType')
            .lean();
        const workflowMap = new Map(workflows.map((w) => [String(w._id), w]));
        const orgIds = [...new Set(candidates.map((c) => String(c.organizationId)).filter(Boolean))];
        const orgs = await Organization.find({ _id: { $in: orgIds } })
            .select('settings.approvalSlaHours')
            .lean();
        const orgMap = new Map(orgs.map((org) => [String(org._id), org]));

        for (const lean of candidates) {
            try {
                const workflow = workflowMap.get(String(lean.workflowId));
                const escalationEnabled = workflow?.escalation?.enabled !== false;
                if (!escalationEnabled) continue;

                const org = orgMap.get(String(lean.organizationId));
                const orgHours = Number(org?.settings?.approvalSlaHours);
                const workflowHours = Number(workflow?.escalation?.escalateAfterHours);
                const hours =
                    orgHours > 0
                        ? orgHours
                        : workflowHours > 0
                        ? workflowHours
                        : DEFAULT_ESCALATE_HOURS;

                const thresholdMs = hours * 60 * 60 * 1000;
                const createdAt = lean.createdAt ? new Date(lean.createdAt).getTime() : 0;
                if (!createdAt || now.getTime() - createdAt < thresholdMs) {
                    continue;
                }

                const pendingStep = [...(lean.steps || [])]
                    .sort((a, b) => (a.stepNumber || 0) - (b.stepNumber || 0))
                    .find((s) => s.status === 'Pending');
                if (!pendingStep) continue;

                const instance = await ApprovalInstance.findOneAndUpdate(
                    {
                        _id: lean._id,
                        status: 'In Progress',
                        slaEscalated: { $ne: true },
                        steps: {
                            $elemMatch: {
                                stepNumber: pendingStep.stepNumber,
                                status: 'Pending',
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
                    note: 'SLA Escalated',
                });
                await instance.save();

                const requester = await Employee.findById(instance.requestedBy)
                    .select('name lastName managerId manager')
                    .lean();

                const orgEmployees = await Employee.find({
                    organizationId: instance.organizationId,
                    status: 'active',
                })
                    .select('name lastName functionalRoles jobTitle position managerId role')
                    .lean();

                const hrIds = orgEmployees.filter(isHrLike).map((e) => e._id);
                const managerId = pendingStep.approverId || requester?.managerId;
                const adminIds = orgEmployees
                    .filter((e) => {
                        const roles = (e.functionalRoles || []).map((r) => String(r).toLowerCase());
                        return roles.includes('admin') || String(e.position || '').toLowerCase() === 'admin';
                    })
                    .map((e) => e._id);

                const recipients = {
                    employee: requester?._id ? [requester._id] : [],
                    manager: managerId ? [managerId] : [],
                    hr: hrIds,
                    admin: adminIds,
                };

                const sendGroup = async (ids, audience) => {
                    const payload = ESCALATION_PUSH[audience];
                    if (!payload) return;
                    const notifiedIds = [];
                    for (const userId of uniqueIds(ids)) {
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
                                    slaHours: hours,
                                    audience,
                                },
                            });
                            notifiedIds.push(String(userId));
                        } catch (err) {
                            logger.warn('SLA escalation push notification failed', {
                                error: err.message,
                                userId,
                                instanceId: instance._id,
                            });
                        }
                    }
                    if (notifiedIds.length > 0) {
                        appendAuditEvent(instance, {
                            action: 'push_notifications_sent',
                            actorRole: audience,
                            note: `${audience} push notifications sent (${notifiedIds.length})`,
                        });
                    }
                };

                await sendGroup(recipients.employee, 'employee');
                await sendGroup(recipients.manager, 'manager');
                await sendGroup(recipients.hr, 'hr');
                await sendGroup(recipients.admin, 'admin');

                await instance.save();

                escalatedCount += 1;
                logger.info('Approval SLA escalation processed (push only)', {
                    instanceId: instance._id,
                    entityType: instance.entityType,
                    hours,
                });
            } catch (err) {
                errorCount += 1;
                logger.error('Error processing SLA escalation for instance', {
                    error: err.message,
                    instanceId: lean._id,
                });
            }
        }
    } catch (error) {
        logger.error('Approval SLA escalation job failed', { error: error.message, stack: error.stack });
        errorCount += 1;
    }

    return { escalatedCount, errorCount };
}

/**
 * Schedule SLA escalation cron (every 15 minutes). Works without Redis.
 */
export function scheduleApprovalSlaEscalationJobs() {
    cron.schedule('*/15 * * * *', async () => {
        try {
            const result = await processApprovalSlaEscalations();
            if (result.escalatedCount > 0) {
                logger.info('Approval SLA escalation tick', result);
            }
        } catch (error) {
            logger.error('Approval SLA escalation cron error', { error: error.message });
        }
    });
    logger.info('Approval SLA escalation job scheduled (every 15 minutes, push only, default 12h)');
}

export default {
    processApprovalSlaEscalations,
    scheduleApprovalSlaEscalationJobs,
};
