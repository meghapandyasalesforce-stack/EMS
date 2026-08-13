import { ApprovalWorkflow } from '../models/approvalWorkflow.model.js';
import { shouldScopeDataToManagedTeam } from './permissionService.js';
import {
    processApprovalAction,
    hrOverrideFinalizeApproval,
    getNextWorkflowInstanceStep,
    isTimeoutNextStepAssignee,
} from '../services/approvalWorkflowService.js';
import {
    attachWorkflowSummariesToRequests,
    getCurrentPendingStep,
    getReviewerEmployeeId,
    isAdminUser,
    isHrEmployee,
    isNaturalActorForStep,
    loadWorkflowStepDefinition,
    prefixWorkflowComment,
} from './regularizationWorkflowActionHelper.js';

const DEFAULT_LEAVE_WORKFLOW = {
    name: 'Leave Approval — Manager then HR',
    description:
        'Leave requests are sent to the employee manager first, then to HR for final verification.',
    entityType: 'Leave',
    isActive: true,
    steps: [
        {
            stepNumber: 1,
            stepName: 'Manager Approval',
            approverType: 'Manager',
            isRequired: true,
            timeoutHours: 72,
        },
        {
            stepNumber: 2,
            stepName: 'HR Verification',
            approverType: 'HR',
            isRequired: true,
            timeoutHours: 72,
        },
    ],
    autoApprove: { enabled: false },
    escalation: { enabled: true, escalateAfterHours: 72, escalateTo: 'NextLevel' },
};

/** Ensure every org has an active Leave workflow: Manager → HR. */
export const ensureDefaultLeaveWorkflow = async (organizationId) => {
    if (!organizationId) return null;

    let workflow = await ApprovalWorkflow.findOne({
        organizationId,
        entityType: 'Leave',
        isActive: true,
    });

    if (workflow) return workflow;

    workflow = await ApprovalWorkflow.create({
        organizationId,
        ...DEFAULT_LEAVE_WORKFLOW,
    });

    return workflow;
};

export const attachWorkflowSummariesToLeaves = attachWorkflowSummariesToRequests;

export { getCurrentPendingStep };

/**
 * @param {object} leave
 * @param {{ includeHrOverrideHint?: boolean }} [options]
 *   includeHrOverrideHint — HR/Admin UIs show override availability; employees see plain pending.
 */
export const getLeaveApprovalStageLabel = (leave = {}, options = {}) => {
    const { includeHrOverrideHint = true } = options;
    const status = (leave.status || '').toLowerCase();
    if (status === 'approved') {
        if (leave.workflowSummary?.hrOverrideUsed) {
            return leave.workflowSummary.hrOverrideByName
                ? `Approved by ${leave.workflowSummary.hrOverrideByName}`
                : 'Approved by HR Manager';
        }
        return 'Approved';
    }
    if (status === 'rejected') {
        if (leave.workflowSummary?.hrOverrideUsed) {
            return leave.workflowSummary.hrOverrideByName
                ? `Rejected by ${leave.workflowSummary.hrOverrideByName}`
                : 'Rejected by HR Executive';
        }
        return 'Rejected';
    }
    if (status === 'cancelled') return 'Cancelled';

    const summary = leave.workflowSummary;
    if (!summary?.hasWorkflow) return 'Pending';

    const pending = summary.pendingStep;
    if (!pending) {
        return summary.instanceStatus === 'In Progress' ? 'In review' : 'Pending';
    }

    const timedOut = Boolean(summary.slaEscalated || pending.escalated);
    const baseName = pending.stepName || pending.approverType || 'approver';

    if (pending.approverType === 'Manager') {
        const base = pending.approverName
            ? `Pending Manager (${pending.approverName})`
            : 'Pending Manager';
        if (timedOut) {
            return includeHrOverrideHint
                ? `${base} · Timed out (next step can act)`
                : `${base} · Timed out`;
        }
        return includeHrOverrideHint ? `${base} (HR Override Available)` : base;
    }
    if (pending.approverType === 'HR') {
        return timedOut ? 'Awaiting HR approval · Timed out' : 'Awaiting HR approval';
    }

    if (timedOut) {
        return includeHrOverrideHint
            ? `Pending ${baseName} · Timed out (next step can act)`
            : `Pending ${baseName} · Timed out`;
    }
    return pending.stepName || 'Pending';
};

/**
 * Leave workflow action resolver.
 * - Assigned / natural actors act on their step.
 * - HR may finalize early on any non-HR pending step.
 * - After step timeout, the next step's assignee may finalize (previous can still act).
 */
export const resolveLeaveWorkflowAction = async ({
    req,
    approvalInstance,
    currentStep,
    employeeLinked = true,
}) => {
    const reviewerEmployeeId = getReviewerEmployeeId(req);
    const workflowStep = await loadWorkflowStepDefinition(approvalInstance, currentStep);
    const approverType = workflowStep?.approverType || null;
    const assignedApproverId = currentStep?.approverId;

    if (isAdminUser(req)) {
        return {
            approverIdForAction: assignedApproverId || reviewerEmployeeId,
            performedByEmployeeId: reviewerEmployeeId || assignedApproverId,
            reviewerEmployeeId,
            overrideLabel: 'Admin',
            approverType,
            useHrOverrideFinalize: false,
        };
    }

    const naturalActor = isNaturalActorForStep(
        req,
        approverType,
        currentStep,
        employeeLinked
    );

    const isManager = shouldScopeDataToManagedTeam(req);
    const isManagerStep = approverType === 'Manager';
    const managerTeamOverride =
        isManager && employeeLinked && isManagerStep && Boolean(reviewerEmployeeId);

    const isAssignedApprover =
        reviewerEmployeeId &&
        assignedApproverId &&
        String(assignedApproverId) === String(reviewerEmployeeId);

    if (approverType === 'HR' && isManager && !isHrEmployee(req)) {
        const err = new Error(
            'Manager approval is complete for your part. This leave is now awaiting HR verification.'
        );
        err.statusCode = 403;
        throw err;
    }

    /** HR may jump early on any non-HR pending step */
    const hrEarlyOverride =
        Boolean(approverType) &&
        approverType !== 'HR' &&
        isHrEmployee(req) &&
        !naturalActor &&
        !isAssignedApprover;

    if (hrEarlyOverride) {
        return {
            approverIdForAction: reviewerEmployeeId || assignedApproverId,
            performedByEmployeeId: reviewerEmployeeId || assignedApproverId,
            reviewerEmployeeId,
            overrideLabel: 'HR',
            approverType,
            useHrOverrideFinalize: true,
        };
    }

    /** After timeout: next step assignee may finalize */
    const timeoutNextStep =
        Boolean(currentStep?.escalated) &&
        isTimeoutNextStepAssignee(approvalInstance, reviewerEmployeeId);

    if (timeoutNextStep) {
        const nextStep = getNextWorkflowInstanceStep(
            approvalInstance,
            currentStep.stepNumber
        );
        const nextDef = nextStep
            ? await loadWorkflowStepDefinition(approvalInstance, nextStep)
            : null;
        return {
            approverIdForAction: reviewerEmployeeId || assignedApproverId,
            performedByEmployeeId: reviewerEmployeeId || assignedApproverId,
            reviewerEmployeeId,
            overrideLabel: nextDef?.approverType || nextStep?.stepName || 'Next step',
            approverType,
            useHrOverrideFinalize: true,
        };
    }

    /** Natural next-step type actor after timeout (e.g. any HR when next is HR) */
    if (currentStep?.escalated && reviewerEmployeeId) {
        const nextStep = getNextWorkflowInstanceStep(
            approvalInstance,
            currentStep.stepNumber
        );
        if (nextStep) {
            const nextDef = await loadWorkflowStepDefinition(approvalInstance, nextStep);
            const nextNatural = isNaturalActorForStep(
                req,
                nextDef?.approverType,
                nextStep,
                employeeLinked
            );
            if (nextNatural && !isAssignedApprover) {
                return {
                    approverIdForAction: reviewerEmployeeId || assignedApproverId,
                    performedByEmployeeId: reviewerEmployeeId || assignedApproverId,
                    reviewerEmployeeId,
                    overrideLabel: nextDef?.approverType || 'Next step',
                    approverType,
                    useHrOverrideFinalize: true,
                };
            }
        }
    }

    const mayAct = Boolean(naturalActor || managerTeamOverride || isAssignedApprover);

    if (!mayAct) {
        const stepLabel = workflowStep?.stepName || approverType || 'current';
        const err = new Error(
            `You are not authorized for the ${stepLabel} step. Wait for the assigned approver.`
        );
        err.statusCode = 403;
        throw err;
    }

    let overrideLabel = null;
    if (managerTeamOverride && !isAssignedApprover) overrideLabel = 'Manager';

    return {
        approverIdForAction: reviewerEmployeeId || assignedApproverId,
        performedByEmployeeId: reviewerEmployeeId || assignedApproverId,
        reviewerEmployeeId,
        overrideLabel,
        approverType,
        useHrOverrideFinalize: false,
    };
};

export const executeLeaveWorkflowAction = async ({
    req,
    approvalInstance,
    currentStep,
    action,
    comments,
    leave,
    employeeLinked = true,
}) => {
    const params = await resolveLeaveWorkflowAction({
        req,
        approvalInstance,
        currentStep,
        employeeLinked,
    });

    if (params.useHrOverrideFinalize) {
        const actor = req.employee;
        const performedByName = actor
            ? [actor.name, actor.lastName].filter(Boolean).join(' ').trim()
            : params.overrideLabel || 'Approver';
        const timeoutEscalation =
            Boolean(currentStep?.escalated) && params.overrideLabel !== 'HR';
        return hrOverrideFinalizeApproval({
            approvalInstanceId: approvalInstance._id,
            action,
            performedByEmployeeId: params.performedByEmployeeId,
            performedByName,
            comments: prefixWorkflowComment(comments, params.overrideLabel),
            metadata: {
                leaveId: leave._id,
                leaveType: leave.leaveType,
                duration: leave.duration,
                overrideRole: params.overrideLabel,
                ...(timeoutEscalation ? { timeoutEscalation: true } : {}),
            },
        });
    }

    return processApprovalAction({
        approvalInstanceId: approvalInstance._id,
        stepNumber: currentStep.stepNumber,
        approverId: params.approverIdForAction,
        action,
        comments: prefixWorkflowComment(comments, params.overrideLabel),
        metadata: {
            leaveId: leave._id,
            leaveType: leave.leaveType,
            duration: leave.duration,
            overrideRole: params.overrideLabel,
        },
        skipApproverValidation: true,
        performedByEmployeeId: params.performedByEmployeeId,
    });
};

export const sendLeaveActionError = (res, error, defaultMessage) => {
    const statusCode = error.statusCode || 500;
    let message = defaultMessage;

    if (statusCode === 403 || statusCode === 409) {
        message = error.message;
    } else if (error.message?.includes('Unauthorized')) {
        message = 'You are not authorized for the current workflow step.';
    }

    return res.status(statusCode).json({
        success: false,
        message,
        code: error.code,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined,
    });
};
