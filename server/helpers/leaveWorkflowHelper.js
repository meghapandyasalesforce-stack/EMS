import { ApprovalWorkflow } from '../models/approvalWorkflow.model.js';
import { processApprovalAction } from '../services/approvalWorkflowService.js';
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
    escalation: { enabled: true, escalateAfterHours: 48, escalateTo: 'HR' },
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

export const getLeaveApprovalStageLabel = (leave = {}) => {
    const status = (leave.status || '').toLowerCase();
    if (status === 'approved') return 'Approved';
    if (status === 'rejected') return 'Rejected';
    if (status === 'cancelled') return 'Cancelled';

    const summary = leave.workflowSummary;
    if (!summary?.hasWorkflow) return 'Pending';

    const pending = summary.pendingStep;
    if (!pending) {
        return summary.instanceStatus === 'In Progress' ? 'In review' : 'Pending';
    }

    if (pending.approverType === 'Manager') {
        return pending.approverName
            ? `Awaiting Manager (${pending.approverName})`
            : 'Awaiting Manager';
    }
    if (pending.approverType === 'HR') {
        return 'Awaiting HR';
    }

    return pending.stepName || 'Pending';
};

/**
 * Strict leave workflow: manager must approve before HR; no skipping steps.
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
        };
    }

    const naturalActor = isNaturalActorForStep(
        req,
        approverType,
        currentStep,
        employeeLinked
    );

    const isManager =
        req.employee?.isManager && !req.employee?.isHR && !req.user;
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

    if (approverType === 'Manager' && isHrEmployee(req) && !naturalActor && !isAssignedApprover) {
        const err = new Error(
            'This leave must be approved by the employee manager first before HR can verify it.'
        );
        err.statusCode = 403;
        throw err;
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
