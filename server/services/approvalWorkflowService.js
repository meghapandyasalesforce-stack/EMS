/**
 * Approval Workflow Service
 * Handles workflow execution, step progression, and notifications
 */

import logger from '../helpers/logger.js';
import { ApprovalWorkflow, ApprovalInstance } from '../models/approvalWorkflow.model.js';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';
import { sendNotification } from '../helpers/notificationService.js';
import { calculateFunctionalRoles } from '../helpers/roleHelper.js';
import {
    applyRegularizationApproval,
    applyRegularizationRejection
} from './attendanceRegularizationWorkflowService.js';
import {
    applyTaxRegimeChangeApproval,
    applyTaxRegimeChangeRejection
} from './taxRegimeChangeWorkflowService.js';

const normalizeText = (value = '') => String(value).trim().toLowerCase();

const formatEmployeeName = (employee) =>
    [employee?.name, employee?.lastName].filter(Boolean).join(' ').trim() || employee?.name || 'Employee';

const buildAlreadyProcessedError = (message = 'Request has already been processed') => {
    const err = new Error(message);
    err.statusCode = 409;
    err.code = 'APPROVAL_ALREADY_PROCESSED';
    return err;
};

const DEFAULT_APPROVAL_SLA_HOURS = 12;

const resolveApprovalSlaHours = async (organizationId, workflow = null) => {
    const org = organizationId
        ? await Organization.findById(organizationId).select('settings.approvalSlaHours').lean()
        : null;
    const orgHours = Number(org?.settings?.approvalSlaHours);
    if (orgHours > 0) return orgHours;
    const workflowHours = Number(workflow?.escalation?.escalateAfterHours);
    if (workflowHours > 0) return workflowHours;
    return DEFAULT_APPROVAL_SLA_HOURS;
};

const uniqueEmployeeIds = (ids) => [...new Set(ids.map((id) => String(id)).filter(Boolean))];

const findOrgAdminEmployeeIds = async (organizationId) => {
    const orgEmployees = await Employee.find({
        organizationId,
        status: 'active',
    })
        .select('functionalRoles position')
        .lean();
    return orgEmployees
        .filter((e) => {
            const roles = (e.functionalRoles || []).map((r) => String(r).toLowerCase());
            return roles.includes('admin') || String(e.position || '').toLowerCase() === 'admin';
        })
        .map((e) => e._id);
};

/**
 * Push-only notifications after HR override (no email).
 */
const notifyHrOverrideStakeholders = async ({
    instance,
    action,
    actorName,
    managerApproverId = null,
}) => {
    const bodyMessage =
        action === 'Approve'
            ? `This request has been approved by ${actorName || 'HR Manager'}.`
            : `This request has been rejected by ${actorName || 'HR Executive'}.`;
    const title = action === 'Approve' ? 'Approved by HR' : 'Rejected by HR';

    const adminIds = await findOrgAdminEmployeeIds(instance.organizationId);
    const recipientIds = uniqueEmployeeIds([
        instance.requestedBy,
        managerApproverId,
        ...adminIds,
    ]);

    const metadata = {
        approvalInstanceId: instance._id,
        entityType: instance.entityType,
        entityId: instance.entityId,
        hrOverride: true,
    };

    let sent = 0;
    for (const userId of recipientIds) {
        try {
            await sendNotification({
                userId,
                title,
                message: bodyMessage,
                type: 'approval_hr_override',
                priority: 'high',
                metadata,
            });
            sent += 1;
        } catch (err) {
            logger.warn('HR override push notification failed', {
                error: err.message,
                userId,
                approvalInstanceId: instance._id,
            });
        }
    }

    if (sent > 0) {
        await pushAuditEvent(instance._id, {
            action: 'push_notifications_sent',
            note: `HR override push notifications sent (${sent})`,
        });
    }
};

const pushAuditEvent = async (
    approvalInstanceId,
    { action, actorId = null, actorName = '', actorRole = '', note = '' }
) => {
    if (!approvalInstanceId || !action) return;
    await ApprovalInstance.updateOne(
        { _id: approvalInstanceId },
        {
            $push: {
                auditTrail: {
                    at: new Date(),
                    action,
                    actorId: actorId || undefined,
                    actorName: actorName || undefined,
                    actorRole: actorRole || undefined,
                    note: note || undefined,
                },
            },
        }
    );
};

const getEffectiveFunctionalRoles = (employee) => {
    const explicitRoles = Array.isArray(employee?.functionalRoles)
        ? employee.functionalRoles.map(normalizeText).filter(Boolean)
        : [];

    if (explicitRoles.length > 0) {
        return [...new Set(explicitRoles)];
    }

    return [...new Set(calculateFunctionalRoles(employee).map(normalizeText).filter(Boolean))];
};

const findActiveEmployeesByRole = async (organizationId, roleMatcher) => {
    const activeEmployees = await Employee.find({
        organizationId,
        status: 'active'
    })
        .select('name lastName functionalRoles department position jobTitle')
        .lean();

    return activeEmployees.filter((employee) => roleMatcher(getEffectiveFunctionalRoles(employee), employee));
};

const findFirstActiveEmployeeByRole = async (organizationId, roleMatcher) => {
    const matches = await findActiveEmployeesByRole(organizationId, roleMatcher);
    const match = matches[0];
    return match ? { id: match._id, name: formatEmployeeName(match) } : null;
};

const resolveManagerApprover = async (requester, organizationId) => {
    const requesterManagerId = requester?.managerId || null;
    if (requesterManagerId) {
        const managerById = await Employee.findOne({
            _id: requesterManagerId,
            organizationId,
            status: 'active'
        })
            .select('name lastName')
            .lean();

        if (managerById) {
            return { id: managerById._id, name: formatEmployeeName(managerById) };
        }
    }

    const managerReference = normalizeText(requester?.manager);
    if (!managerReference) {
        return null;
    }

    const activeEmployees = await Employee.find({
        organizationId,
        status: 'active'
    })
        .select('name lastName')
        .lean();

    const managerByName = activeEmployees.find((employee) => {
        const fullName = normalizeText(`${employee?.name || ''} ${employee?.lastName || ''}`);
        const firstName = normalizeText(employee?.name);
        return (
            managerReference === fullName ||
            managerReference === firstName ||
            fullName.startsWith(`${managerReference} `)
        );
    });

    return managerByName ? { id: managerByName._id, name: formatEmployeeName(managerByName) } : null;
};

/**
 * Create approval instance and start workflow
 */
export const initiateApproval = async ({
    organizationId,
    entityType,
    entityId,
    requestedBy,
    workflowId = null,
    metadata = {},
    priority = 'Medium'
}) => {
    try {
        // Find active workflow for entity type
        let workflow;
        if (workflowId) {
            workflow = await ApprovalWorkflow.findOne({
                _id: workflowId,
                organizationId,
                isActive: true
            });
        } else {
            workflow = await ApprovalWorkflow.findOne({
                organizationId,
                entityType,
                isActive: true
            });
        }

        if (!workflow) {
            // No workflow configured - auto approve
            logger.info('No workflow found, auto-approving', { entityType, entityId });
            return {
                status: 'Approved',
                autoApproved: true,
                workflowId: null
            };
        }

        // Check auto-approve conditions
        if (workflow.autoApprove?.enabled) {
            const shouldAutoApprove = checkAutoApproveConditions(workflow.autoApprove.conditions, metadata);
            if (shouldAutoApprove) {
                logger.info('Auto-approving based on conditions', { entityType, entityId });
                return {
                    status: 'Approved',
                    autoApproved: true,
                    workflowId: workflow._id
                };
            }
        }

        // Build steps array (await approver determination)
        const sortedWorkflowSteps = [...workflow.steps].sort(
            (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
        );
        const steps = [];
        for (const step of sortedWorkflowSteps) {
            const approver = await determineApprover(step, requestedBy, organizationId);
            steps.push({
                stepNumber: step.stepNumber,
                stepName: step.stepName,
                approverId: approver?.id,
                approverName: approver?.name,
                status: 'Pending',
                dueDate: new Date(Date.now() + (step.timeoutHours || 48) * 60 * 60 * 1000)
            });
        }

        // Create approval instance
        const approvalInstance = await ApprovalInstance.create({
            organizationId,
            workflowId: workflow._id,
            entityType,
            entityId,
            requestedBy,
            status: 'In Progress',
            currentStep: 0,
            steps,
            metadata,
            priority,
            auditTrail: [
                {
                    at: new Date(),
                    action: 'request_submitted',
                    actorId: requestedBy,
                    note: 'Request Submitted',
                },
            ],
        });

        const slaHours = await resolveApprovalSlaHours(organizationId, workflow);
        await pushAuditEvent(approvalInstance._id, {
            action: 'sla_timer_started',
            note: `SLA timer started (${slaHours} hours)`,
        });

        // Start first step
        await processNextStep(approvalInstance._id);

        return {
            status: 'In Progress',
            approvalInstanceId: approvalInstance._id,
            workflowId: workflow._id
        };
    } catch (error) {
        logger.error('Error initiating approval', {
            error: error.message,
            entityType,
            entityId,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Process approval action (approve/reject)
 */
export const processApprovalAction = async ({
    approvalInstanceId,
    stepNumber,
    approverId,
    action,
    comments = '',
    metadata = {},
    skipApproverValidation = false,
    performedByEmployeeId = null
}) => {
    try {
        const stepFilter = {
            stepNumber,
            status: 'Pending',
        };
        if (!skipApproverValidation) {
            stepFilter.approverId = approverId;
        }

        const now = new Date();
        let instance = await ApprovalInstance.findOneAndUpdate(
            {
                _id: approvalInstanceId,
                status: 'In Progress',
                steps: { $elemMatch: stepFilter },
            },
            {
                $set: {
                    'steps.$.status': action === 'Approve' ? 'Approved' : 'Rejected',
                    'steps.$.action': action,
                    'steps.$.comments': comments,
                    'steps.$.actionDate': now,
                },
            },
            { new: true }
        );
        if (!instance) {
            const latest = await ApprovalInstance.findById(approvalInstanceId).select('status steps');
            if (!latest) {
                throw new Error('Approval instance not found');
            }
            if (latest.status !== 'In Progress') {
                throw buildAlreadyProcessedError();
            }
            const latestStep = latest.steps.find((s) => s.stepNumber === stepNumber);
            if (!latestStep) {
                throw new Error('Step not found');
            }
            if (
                !skipApproverValidation &&
                latestStep.approverId?.toString() !== approverId?.toString()
            ) {
                const err = new Error(
                    'Unauthorized: You are not the assigned approver for this step'
                );
                err.statusCode = 403;
                throw err;
            }
            throw buildAlreadyProcessedError();
        }

        const step = instance.steps.find((s) => s.stepNumber === stepNumber);
        await pushAuditEvent(approvalInstanceId, {
            action: action === 'Approve' ? 'step_approved' : 'step_rejected',
            actorId: performedByEmployeeId || approverId || step?.approverId,
            actorName: step?.approverName || '',
            note: comments || `${action === 'Approve' ? 'Approved' : 'Rejected'} at step ${stepNumber}`,
        });

        // If rejected, reject entire workflow
        if (action === 'Reject') {
            instance.status = 'Rejected';
            instance.rejectedAt = now;
            instance.rejectedBy = performedByEmployeeId || approverId || step.approverId;
            instance.rejectionReason = comments;
            await instance.save();

            await updateEntityStatus(instance);

            if (instance.entityType !== 'Leave') {
                await notifyRequester(instance, 'rejected', comments);
            }

            return {
                status: 'Rejected',
                message: 'Request rejected'
            };
        }

        // Check if all required steps are approved
        const allApproved = checkAllStepsApproved(instance);
        if (allApproved) {
            instance.status = 'Approved';
            instance.approvedAt = now;
            instance.currentStep = instance.steps.length;
            await instance.save();

            // ✅ UPDATE ENTITY STATUS (Leave, Expense, etc.)
            await updateEntityStatus(instance);

            if (instance.entityType !== 'Leave') {
                await notifyRequester(instance, 'approved');
            }

            return {
                status: 'Approved',
                message: 'Request approved'
            };
        }

        // Move to next step
        instance.currentStep = stepNumber;
        await instance.save();

        // Send intermediate approval notification for leave (e.g., manager approved, pending HR)
        if (instance.entityType === 'Leave') {
            try {
                const Leave = (await import('../models/leave.model.js')).default;
                const leave = await Leave.findById(instance.entityId);
                if (leave) {
                    const requesterEmployee = await Employee.findById(leave.employee)
                        .select('_id name lastName managerId manager functionalRoles department position jobTitle')
                        .lean();

                    await notify({
                        type: 'leave_manager_approved',
                        organizationId: leave.organizationId,
                        data: { leave, employee: requesterEmployee }
                    });
                }
            } catch (notifError) {
                logger.warn('Failed to send intermediate leave approval notification', {
                    error: notifError.message,
                    approvalInstanceId,
                    stepNumber
                });
            }
        }

        await processNextStep(approvalInstanceId);

        return {
            status: 'In Progress',
            message: 'Approval processed, moving to next step'
        };
    } catch (error) {
        logger.error('Error processing approval action', {
            error: error.message,
            approvalInstanceId,
            stepNumber,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Append an audit trail event (mutates instance; caller must save).
 */
export const appendAuditEvent = (instance, { action, actorId = null, actorName = '', actorRole = '', note = '' }) => {
    if (!instance) return;
    if (!Array.isArray(instance.auditTrail)) {
        instance.auditTrail = [];
    }
    instance.auditTrail.push({
        at: new Date(),
        action,
        actorId: actorId || undefined,
        actorName: actorName || undefined,
        actorRole: actorRole || undefined,
        note: note || undefined,
    });
};

/**
 * Admin bypass: mark all pending steps approved and finalize the entity.
 */
export const adminBypassApprovalInstance = async ({
    approvalInstanceId,
    comments = 'Approved by admin (all steps)',
    metadata = {},
}) => {
    const instance = await ApprovalInstance.findById(approvalInstanceId);
    if (!instance) {
        throw new Error('Approval instance not found');
    }

    if (instance.status !== 'In Progress') {
        throw new Error(`Cannot bypass workflow. Current status: ${instance.status}`);
    }

    const now = new Date();
    const bypassComment = String(comments || '').trim() || 'Approved by admin (all steps)';

    for (const step of instance.steps) {
        if (step.status === 'Pending') {
            step.status = 'Approved';
            step.action = 'Approve';
            step.comments = bypassComment;
            step.actionDate = now;
        }
    }

    instance.status = 'Approved';
    instance.approvedAt = now;
    instance.currentStep = instance.steps.length;
    if (metadata && Object.keys(metadata).length) {
        instance.metadata = { ...(instance.metadata || {}), ...metadata };
    }
    appendAuditEvent(instance, {
        action: 'admin_bypass_approved',
        note: bypassComment,
    });
    await instance.save();

    await updateEntityStatus(instance);
    if (instance.entityType !== 'Leave') {
        await notifyRequester(instance, 'approved');
    }

    return {
        status: 'Approved',
        message: 'Request approved by admin (all workflow steps completed)',
    };
};

/**
 * HR Manager / HR Executive override: finalize the request immediately
 * without waiting for the Reporting Manager (or any remaining pending steps).
 * Existing manager-step behaviour is unchanged when HR does not override.
 */
export const hrOverrideFinalizeApproval = async ({
    approvalInstanceId,
    action,
    performedByEmployeeId,
    performedByName = '',
    comments = '',
    metadata = {},
}) => {
    if (!['Approve', 'Reject'].includes(action)) {
        throw new Error('Invalid HR override action');
    }

    const instance = await ApprovalInstance.findById(approvalInstanceId);
    if (!instance) {
        throw new Error('Approval instance not found');
    }

    if (instance.status !== 'In Progress') {
        throw buildAlreadyProcessedError();
    }

    const now = new Date();
    const pendingSteps = instance.steps.filter((s) => s.status === 'Pending');
    if (pendingSteps.length === 0) {
        throw buildAlreadyProcessedError();
    }

    const workflow = await ApprovalWorkflow.findById(instance.workflowId)
        .select('steps.stepNumber steps.approverType')
        .lean();
    const typeByNumber = new Map(
        (workflow?.steps || []).map((s) => [s.stepNumber, s.approverType])
    );
    const skippedManager = pendingSteps.some(
        (s) => typeByNumber.get(s.stepNumber) === 'Manager'
    );

    const actorName =
        performedByName ||
        (await Employee.findById(performedByEmployeeId).select('name lastName').lean().then((e) =>
            e ? formatEmployeeName(e) : 'HR'
        ));

    const overrideComment =
        String(comments || '').trim() ||
        (action === 'Approve'
            ? 'Approved by HR (manager step skipped via HR override)'
            : 'Rejected by HR (manager step skipped via HR override)');

    const primary = pendingSteps[0];
    const primaryIndex = instance.steps.findIndex(
        (step) => step.stepNumber === primary.stepNumber && step.status === 'Pending'
    );
    if (primaryIndex === -1) {
        throw buildAlreadyProcessedError();
    }

    const updateSet = {
        [`steps.${primaryIndex}.status`]: action === 'Approve' ? 'Approved' : 'Rejected',
        [`steps.${primaryIndex}.action`]: action,
        [`steps.${primaryIndex}.comments`]: `[HR override] ${overrideComment}`,
        [`steps.${primaryIndex}.actionDate`]: now,
        hrOverride: {
            used: true,
            action,
            by: performedByEmployeeId || undefined,
            byName: actorName,
            at: now,
            skippedManager: Boolean(skippedManager),
            comments: overrideComment,
        },
        status: action === 'Approve' ? 'Approved' : 'Rejected',
        currentStep: instance.steps.length,
        metadata: {
            ...(instance.metadata || {}),
            ...(metadata && Object.keys(metadata).length ? metadata : {}),
            hrOverride: true,
        },
    };
    if (performedByEmployeeId) {
        updateSet[`steps.${primaryIndex}.approverId`] = performedByEmployeeId;
        updateSet[`steps.${primaryIndex}.approverName`] = actorName;
    }
    if (action === 'Approve') {
        updateSet.approvedAt = now;
    } else {
        updateSet.rejectedAt = now;
        updateSet.rejectedBy = performedByEmployeeId || primary.approverId;
        updateSet.rejectionReason = overrideComment;
    }

    pendingSteps.slice(1).forEach((step) => {
        const idx = instance.steps.findIndex(
            (candidate) => candidate.stepNumber === step.stepNumber && candidate.status === 'Pending'
        );
        if (idx >= 0) {
            updateSet[`steps.${idx}.status`] = 'Skipped';
            updateSet[`steps.${idx}.comments`] = 'Skipped - HR override finalized the request';
            updateSet[`steps.${idx}.actionDate`] = now;
        }
    });

    const updated = await ApprovalInstance.findOneAndUpdate(
        {
            _id: approvalInstanceId,
            status: 'In Progress',
            [`steps.${primaryIndex}.status`]: 'Pending',
        },
        { $set: updateSet },
        { new: true }
    );

    if (!updated) {
        throw buildAlreadyProcessedError();
    }

    await pushAuditEvent(approvalInstanceId, {
        action: action === 'Approve' ? 'hr_override_approved' : 'hr_override_rejected',
        actorId: performedByEmployeeId,
        actorName,
        actorRole: 'HR',
        note: overrideComment,
    });

    if (skippedManager) {
        await pushAuditEvent(approvalInstanceId, {
            action: 'manager_step_skipped',
            note: 'Manager step automatically skipped',
        });
    }

    await updateEntityStatus(updated);

    const managerStep = pendingSteps.find(
        (step) => typeByNumber.get(step.stepNumber) === 'Manager' && step.approverId
    );

    await notifyHrOverrideStakeholders({
        instance: updated,
        action,
        actorName,
        managerApproverId: managerStep?.approverId || null,
    });

    // Leave module keeps existing notification pipeline via updateEntityStatus above.

    return {
        status: updated.status,
        hrOverride: true,
        skippedManager: Boolean(skippedManager),
        message:
            action === 'Approve'
                ? 'Request approved by HR (override)'
                : 'Request rejected by HR (override)',
    };
};

/**
 * Process next step in workflow
 */
const processNextStep = async (approvalInstanceId) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance) return;

        const workflow = await ApprovalWorkflow.findById(instance.workflowId);
        if (!workflow) return;

        // Find next pending step
        const nextStep = instance.steps.find(s => s.status === 'Pending');
        if (!nextStep) return;

        const workflowStep = workflow.steps.find(s => s.stepNumber === nextStep.stepNumber);
        if (!workflowStep) return;

        // Notify approver
        await notifyApprover(instance, nextStep, workflowStep);

        try {
            const fresh = await ApprovalInstance.findById(approvalInstanceId);
            if (fresh) {
                appendAuditEvent(fresh, {
                    action: 'manager_notified',
                    actorId: nextStep.approverId || undefined,
                    actorName: nextStep.approverName || undefined,
                    actorRole: workflowStep?.approverType || undefined,
                    note:
                        workflowStep?.approverType === 'Manager'
                            ? 'Manager Notified'
                            : `${nextStep.stepName || 'Approver'} notified`,
                });
                await fresh.save();
            }
        } catch (_) {
            /* audit is best-effort; do not block workflow */
        }

    } catch (error) {
        logger.error('Error processing next step', {
            error: error.message,
            approvalInstanceId,
            stack: error.stack
        });
    }
};

/**
 * Determine approver for a step
 */
const determineApprover = async (step, requestedBy, organizationId) => {
    try {
        const requester = await Employee.findById(requestedBy);
        if (!requester) return null;

        switch (step.approverType) {
            case 'Manager':
                return await resolveManagerApprover(requester, organizationId);

            case 'Role':
                if (step.approverRole) {
                    const employee = await Employee.findOne({
                        organizationId,
                        role: step.approverRole,
                        status: 'active'
                    });
                    return { id: employee?._id, name: employee?.name };
                }
                break;

            case 'Department':
                if (step.approverDepartment) {
                    const employee = await Employee.findOne({
                        organizationId,
                        department: step.approverDepartment,
                        position: { $in: ['Manager', 'Head', 'Director'] },
                        status: 'active'
                    });
                    return { id: employee?._id, name: employee?.name };
                }
                break;

            case 'Employee':
                if (step.approverEmployee) {
                    const employee = await Employee.findById(step.approverEmployee);
                    return { id: employee?._id, name: employee?.name };
                }
                break;

            case 'HR':
                return await findFirstActiveEmployeeByRole(
                    organizationId,
                    (roles) => roles.includes('hr')
                );

            case 'Finance':
                return await findFirstActiveEmployeeByRole(
                    organizationId,
                    (roles) => roles.includes('finance')
                );

            case 'Executive':
                return await findFirstActiveEmployeeByRole(
                    organizationId,
                    (roles) => ['executive', 'ceo', 'cto', 'cfo', 'vp'].some((role) => roles.includes(role))
                );
        }

        logger.warn('No approver resolved for workflow step', {
            approverType: step?.approverType,
            stepNumber: step?.stepNumber,
            requestedBy,
            organizationId
        });
        return null;
    } catch (error) {
        logger.error('Error determining approver', { error: error.message });
        return null;
    }
};

/**
 * Check if all required steps are approved
 */
const checkAllStepsApproved = (instance) => {
    const workflow = instance.workflowId; // Would need to fetch workflow
    // For now, check if all non-skipped steps are approved
    const requiredSteps = instance.steps.filter(s => s.status !== 'Skipped');
    return requiredSteps.every(s => s.status === 'Approved');
};

/**
 * Check auto-approve conditions
 */
const checkAutoApproveConditions = (conditions, metadata) => {
    if (!conditions) return false;

    if (conditions.maxAmount && metadata.amount) {
        return metadata.amount <= conditions.maxAmount;
    }

    if (conditions.leaveDays && metadata.duration) {
        return metadata.duration <= conditions.leaveDays;
    }

    return false;
};

/**
 * Notify approver
 */
const notifyApprover = async (instance, step, workflowStep) => {
    try {
        if (!step.approverId) return;

        const requester = await Employee.findById(instance.requestedBy);
        const approver = await Employee.findById(step.approverId);

        if (!approver) return;

        const title = `Approval Required: ${instance.entityType}`;
        const message = `${requester?.name || 'Someone'} has requested approval for ${instance.entityType}. Step: ${step.stepName}`;
        const metadata = {
            approvalInstanceId: instance._id,
            entityType: instance.entityType,
            entityId: instance.entityId,
            stepNumber: step.stepNumber
        };
        const priority = instance.priority === 'Urgent' ? 'high' : 'medium';

        if (workflowStep?.approverType === 'HR') {
            const hrEmployees = await findActiveEmployeesByRole(
                instance.organizationId,
                (roles) => roles.includes('hr')
            );
            const recipientIds = [
                ...new Set(
                    (hrEmployees.length > 0 ? hrEmployees : [approver])
                        .map((employee) => employee?._id?.toString())
                        .filter(Boolean)
                )
            ];

            const results = await Promise.allSettled(
                recipientIds.map((recipientId) =>
                    sendNotification({
                        userId: recipientId,
                        title,
                        message,
                        type: 'approval_request',
                        priority,
                        metadata
                    })
                )
            );

            const failedCount = results.filter((result) => result.status === 'rejected').length;
            if (failedCount > 0) {
                logger.warn('Some HR approver notifications failed', {
                    approvalInstanceId: instance._id,
                    stepNumber: step.stepNumber,
                    failedCount,
                    totalCount: results.length
                });
            }
            return;
        }

        await sendNotification({
            userId: approver._id,
            title,
            message,
            type: 'approval_request',
            priority,
            metadata
        });
    } catch (error) {
        logger.error('Error notifying approver', { error: error.message });
    }
};

/**
 * Update entity status when workflow completes
 */
const updateEntityStatus = async (instance) => {
    try {
        if (instance.entityType === 'Leave') {
            const Leave = (await import('../models/leave.model.js')).default;
            const leave = await Leave.findById(instance.entityId);
            if (leave) {
                const requesterEmployee = await Employee.findById(leave.employee)
                    .select('_id name lastName managerId manager functionalRoles department position jobTitle')
                    .lean();
                if (instance.status === 'Approved') {
                    leave.status = 'approved';
                    leave.approvedBy =
                        instance.hrOverride?.by ||
                        instance.steps.find((s) => s.status === 'Approved')?.approverId ||
                        instance.steps[instance.steps.length - 1]?.approverId;
                    leave.approvedAt = new Date();
                } else if (instance.status === 'Rejected') {
                    leave.status = 'rejected';
                    leave.rejectedBy = instance.rejectedBy;
                    leave.rejectedAt = new Date();
                    leave.rejectionReason = instance.rejectionReason;
                }
                await leave.save();

                if (instance.status === 'Approved') {
                    try {
                        const leaveBalanceEngine = (await import('./leaveBalanceEngine.js')).default;
                        const year = new Date(leave.startDate).getFullYear();
                        await leaveBalanceEngine.calculateBalance(
                            leave.employee,
                            year,
                            leave.organizationId
                        );
                    } catch (balanceError) {
                        logger.warn('Error updating leave balance after workflow approval', {
                            error: balanceError.message,
                            leaveId: leave._id,
                        });
                    }
                }

                if (instance.status === 'Rejected') {
                    await notify({
                        type: 'leave_rejected',
                        organizationId: leave.organizationId,
                        data: { leave, employee: requesterEmployee }
                    });
                } else if (instance.status === 'Approved') {
                    await notify({
                        type: 'leave_approved',
                        organizationId: leave.organizationId,
                        data: { leave, employee: requesterEmployee }
                    });
                }
            }
        } else if (instance.entityType === 'Expense') {
            const Expense = (await import('../models/expense.model.js')).default;
            const expense = await Expense.findById(instance.entityId);
            if (expense) {
                if (instance.status === 'Approved') {
                    expense.status = 'Approved';
                    expense.approvedBy = instance.steps[instance.steps.length - 1]?.approverId;
                    expense.approvedAt = new Date();
                } else if (instance.status === 'Rejected') {
                    expense.status = 'Rejected';
                    expense.approvedBy = instance.rejectedBy;
                    expense.approvedAt = instance.rejectedAt;
                    expense.rejectionReason = instance.rejectionReason || 'Rejected through approval workflow';
                }
                await expense.save();
            }
        } else if (instance.entityType === 'AttendanceRegularization') {
            const AttendanceRegularization = (await import('../models/attendanceRegularization.model.js')).default;
            const regularizationRequest = await AttendanceRegularization.findById(instance.entityId);

            if (regularizationRequest) {
                if (instance.status === 'Approved') {
                    await applyRegularizationApproval({
                        regularizationRequest,
                        organizationId: regularizationRequest.organizationId,
                        reviewerId: instance.steps[instance.steps.length - 1]?.approverId || instance.rejectedBy || null,
                        managerResponse: 'Approved through workflow'
                    });
                } else if (instance.status === 'Rejected') {
                    await applyRegularizationRejection({
                        regularizationRequest,
                        reviewerId: instance.rejectedBy || null,
                        rejectionReason: instance.rejectionReason || 'Rejected through approval workflow'
                    });
                }
            }
        } else if (instance.entityType === 'TaxRegimeChange') {
            const TaxRegimeChange = (await import('../models/taxRegimeChange.model.js')).default;
            const taxRegimeRequest = await TaxRegimeChange.findById(instance.entityId);

            if (taxRegimeRequest) {
                if (instance.status === 'Approved') {
                    await applyTaxRegimeChangeApproval({
                        taxRegimeRequest,
                        reviewerId: instance.steps[instance.steps.length - 1]?.approverId || instance.rejectedBy || null,
                        comments: 'Approved through workflow'
                    });
                } else if (instance.status === 'Rejected') {
                    await applyTaxRegimeChangeRejection({
                        taxRegimeRequest,
                        reviewerId: instance.rejectedBy || null,
                        rejectionReason: instance.rejectionReason || 'Rejected through approval workflow'
                    });
                }
            }
        } else if (['Offer', 'Onboarding', 'Offboarding', 'Clearance', 'ExitInterview', 'FnF', 'AssetReturn', 'LifecycleForm', 'LifecycleLetter'].includes(instance.entityType)) {
            const { handleLifecycleApprovalOutcome } = await import('./lifecycleApprovalService.js');
            await handleLifecycleApprovalOutcome(instance);
        }
        // Add other entity types (Document, etc.) as needed
    } catch (error) {
        logger.error('Error updating entity status', {
            error: error.message,
            entityType: instance.entityType,
            entityId: instance.entityId,
            stack: error.stack
        });
    }
};

/**
 * Notify requester
 */
const notifyRequester = async (instance, status, reason = '') => {
    try {
        await sendNotification({
            userId: instance.requestedBy,
            title: `Approval ${status === 'approved' ? 'Approved' : 'Rejected'}: ${instance.entityType}`,
            message: status === 'approved'
                ? `Your ${instance.entityType} request has been approved.`
                : `Your ${instance.entityType} request has been rejected. ${reason}`,
            type: `approval_${status}`,
            priority: 'medium',
            metadata: {
                approvalInstanceId: instance._id,
                entityType: instance.entityType,
                entityId: instance.entityId
            }
        });
        await pushAuditEvent(instance._id, {
            action: status === 'approved' ? 'requester_notified_approved' : 'requester_notified_rejected',
            actorId: instance.requestedBy,
            actorRole: 'Employee',
            note:
                status === 'approved'
                    ? 'Employee notified'
                    : `Employee notified${reason ? `: ${reason}` : ''}`,
        });
    } catch (error) {
        logger.error('Error notifying requester', { error: error.message });
    }
};

/**
 * Check and escalate if needed
 */
const checkAndEscalate = async (approvalInstanceId, stepNumber) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance || instance.status !== 'In Progress') return;

        const step = instance.steps.find(s => s.stepNumber === stepNumber);
        if (!step || step.status !== 'Pending') return;

        const workflow = await ApprovalWorkflow.findById(instance.workflowId);
        if (!workflow?.escalation?.enabled) return;

        // Legacy step flag only — full SLA (slaEscalated + multi-recipient notify/email)
        // is owned by approvalSlaEscalationJob so it runs once with complete fan-out.
        // Do not reassign the Reporting Manager; they keep Approve/Reject until HR override.
        step.escalated = true;
        step.escalatedAt = new Date();
        await instance.save();

        const escalationApprover = await determineEscalationApprover(workflow, instance);
        if (escalationApprover?.id) {
            await sendNotification({
                userId: escalationApprover.id,
                title: `Approval Escalated: ${instance.entityType}`,
                message: `A ${instance.entityType} request has exceeded the approval window. HR may approve or reject directly.`,
                type: 'approval_escalation',
                priority: 'high',
                metadata: {
                    approvalInstanceId: instance._id,
                    entityType: instance.entityType,
                    entityId: instance.entityId,
                    stepNumber,
                },
            });
        }
    } catch (error) {
        logger.error('Error escalating approval', { error: error.message });
    }
};

/**
 * Determine escalation approver
 */
const determineEscalationApprover = async (workflow, instance) => {
    const escalation = workflow.escalation;
    if (!escalation) return null;

    switch (escalation.escalateTo) {
        case 'NextLevel':
            // Find next step approver
            const nextStep = instance.steps.find(s => s.status === 'Pending' && s.stepNumber > instance.currentStep);
            if (nextStep) {
                return { id: nextStep.approverId, name: nextStep.approverName };
            }
            break;

        case 'Role':
            if (escalation.escalateToRole) {
                const employee = await Employee.findOne({
                    organizationId: instance.organizationId,
                    role: escalation.escalateToRole,
                    status: 'active'
                });
                return { id: employee?._id, name: employee?.name };
            }
            break;

        case 'Employee':
            if (escalation.escalateToEmployee) {
                const employee = await Employee.findById(escalation.escalateToEmployee);
                return { id: employee?._id, name: employee?.name };
            }
            break;
    }

    return null;
};

/**
 * Delegate approval to another employee
 */
export const delegateApproval = async ({
    approvalInstanceId,
    stepNumber,
    approverId,
    delegateToId,
    comments = ''
}) => {
    try {
        const instance = await ApprovalInstance.findById(approvalInstanceId);
        if (!instance) {
            throw new Error('Approval instance not found');
        }

        if (instance.status !== 'In Progress') {
            throw new Error(`Cannot delegate. Current status: ${instance.status}`);
        }

        const step = instance.steps.find(s => s.stepNumber === stepNumber);
        if (!step) {
            throw new Error('Step not found');
        }

        if (step.approverId?.toString() !== approverId?.toString()) {
            throw new Error('Unauthorized: You are not the assigned approver for this step');
        }

        if (step.status !== 'Pending') {
            throw new Error(`Cannot delegate step with status: ${step.status}`);
        }

        // Get workflow to check if delegation is allowed
        const workflow = await ApprovalWorkflow.findById(instance.workflowId);
        if (!workflow) {
            throw new Error('Workflow not found');
        }

        const workflowStep = workflow.steps.find(s => s.stepNumber === stepNumber);
        if (!workflowStep) {
            throw new Error('Workflow step not found');
        }

        if (!workflowStep.canDelegate) {
            throw new Error('Delegation is not allowed for this step');
        }

        // Verify delegate exists and is active
        const delegate = await Employee.findById(delegateToId);
        if (!delegate) {
            throw new Error('Delegate employee not found');
        }

        if (delegate.organizationId?.toString() !== instance.organizationId?.toString()) {
            throw new Error('Delegate must be from the same organization');
        }

        // Update step with delegation
        step.status = 'Delegated';
        step.action = 'Delegate';
        step.comments = comments || `Delegated to ${delegate.name}`;
        step.actionDate = new Date();
        step.delegatedTo = delegateToId;

        // Update approver to delegate
        step.approverId = delegateToId;
        step.approverName = delegate.name;
        step.status = 'Pending'; // Reset to pending for delegate

        await instance.save();

        // Notify delegate
        const requester = await Employee.findById(instance.requestedBy);
        await sendNotification({
            userId: delegateToId,
            title: `Delegated Approval: ${instance.entityType}`,
            message: `${requester?.name || 'Someone'} has requested approval for ${instance.entityType}. This was delegated to you by ${step.approverName || 'the original approver'}.`,
            type: 'approval_delegated',
            priority: instance.priority === 'Urgent' ? 'high' : 'medium',
            metadata: {
                approvalInstanceId: instance._id,
                entityType: instance.entityType,
                entityId: instance.entityId,
                stepNumber: step.stepNumber,
                originalApproverId: approverId
            }
        });

        logger.info('Approval delegated', {
            approvalInstanceId,
            stepNumber,
            originalApproverId: approverId,
            delegateToId,
            entityType: instance.entityType
        });

        return {
            status: 'Delegated',
            message: 'Approval delegated successfully',
            step: step
        };
    } catch (error) {
        logger.error('Error delegating approval', {
            error: error.message,
            approvalInstanceId,
            stepNumber,
            approverId,
            stack: error.stack
        });
        throw error;
    }
};

/**
 * Get pending approvals for an employee.
 * Additive: when includeHrOverrides is true, also return In-Progress instances
 * still waiting on a Manager step so HR can override without being the assigned approver.
 */
export const getPendingApprovals = async (employeeId, organizationId, options = {}) => {
    try {
        const { includeHrOverrides = false } = options;

        const approvals = await ApprovalInstance.find({
            organizationId,
            'steps.approverId': employeeId,
            'steps.status': 'Pending',
            status: 'In Progress'
        })
            .populate('requestedBy', 'name email')
            .populate('workflowId', 'name steps.stepNumber steps.stepName steps.approverType escalation')
            .sort({ createdAt: -1 })
            .lean();

        const mapped = approvals.map(approval => {
            const pendingStep = approval.steps.find(s => 
                s.approverId?.toString() === employeeId?.toString() && s.status === 'Pending'
            );
            return {
                ...approval,
                currentPendingStep: pendingStep,
                hrOverrideAvailable: false,
                slaEscalated: Boolean(approval.slaEscalated),
            };
        });

        if (!includeHrOverrides) {
            return mapped;
        }

        const overrideCandidates = await ApprovalInstance.find({
            organizationId,
            status: 'In Progress',
            'steps.status': 'Pending',
        })
            .populate('requestedBy', 'name email')
            .populate('workflowId', 'name steps.stepNumber steps.stepName steps.approverType escalation')
            .sort({ createdAt: -1 })
            .lean();

        const seen = new Set(mapped.map((a) => String(a._id)));
        for (const approval of overrideCandidates) {
            if (seen.has(String(approval._id))) continue;

            const workflowSteps = approval.workflowId?.steps || [];
            const typeByNumber = new Map(
                workflowSteps.map((s) => [s.stepNumber, s.approverType])
            );
            const sorted = [...(approval.steps || [])].sort(
                (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
            );
            const pendingStep = sorted.find((s) => s.status === 'Pending') || null;
            if (!pendingStep) continue;

            const pendingType = typeByNumber.get(pendingStep.stepNumber);
            // HR override is for steps that are not naturally HR's own turn
            if (pendingType === 'HR') continue;

            mapped.push({
                ...approval,
                currentPendingStep: pendingStep,
                hrOverrideAvailable: true,
                pendingManager: pendingType === 'Manager',
                slaEscalated: Boolean(approval.slaEscalated),
            });
            seen.add(String(approval._id));
        }

        return mapped;
    } catch (error) {
        logger.error('Error getting pending approvals', { error: error.message });
        return [];
    }
};

/**
 * Count In-Progress approvals that have been SLA-escalated (pending > escalate window).
 */
export const getEscalatedApprovalsCount = async (organizationId) => {
    if (!organizationId) return 0;
    return ApprovalInstance.countDocuments({
        organizationId,
        status: 'In Progress',
        slaEscalated: true,
    });
};

/**
 * Cancel an in-progress approval instance (e.g. when requester withdraws leave).
 */
export const cancelApprovalInstance = async ({
    approvalInstanceId,
    cancelledBy = null,
    reason = 'Cancelled by requester'
}) => {
    const instance = await ApprovalInstance.findById(approvalInstanceId);
    if (!instance) {
        return { cancelled: false, reason: 'not_found' };
    }

    if (['Approved', 'Rejected', 'Cancelled', 'Expired'].includes(instance.status)) {
        return { cancelled: false, reason: 'already_terminal', status: instance.status };
    }

    instance.status = 'Cancelled';
    instance.rejectionReason = reason;
    instance.rejectedAt = new Date();
    instance.slaEscalated = false;
    instance.slaEscalatedAt = undefined;
    if (cancelledBy) {
        instance.rejectedBy = cancelledBy;
    }

    for (const step of instance.steps) {
        if (step.status === 'Pending') {
            step.status = 'Skipped';
        }
    }

    appendAuditEvent(instance, {
        action: 'request_cancelled',
        actorId: cancelledBy,
        note: reason,
    });

    await instance.save();

    logger.info('Approval instance cancelled', {
        approvalInstanceId: instance._id,
        entityType: instance.entityType,
        entityId: instance.entityId,
        cancelledBy
    });

    return { cancelled: true, instance };
};

