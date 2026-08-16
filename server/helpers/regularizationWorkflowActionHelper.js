import { ApprovalWorkflow, ApprovalInstance } from '../models/approvalWorkflow.model.js';
import { shouldScopeDataToManagedTeam } from './permissionService.js';
import {
    processApprovalAction,
    adminBypassApprovalInstance,
    hrOverrideFinalizeApproval,
    getNextWorkflowInstanceStep,
    isTimeoutNextStepAssignee,
} from '../services/approvalWorkflowService.js';

export const EARLY_APPROVAL_CONFIRM_CODE = 'EARLY_APPROVAL_CONFIRM_REQUIRED';

/**
 * Employee id for reviewedBy / audit (never admin User id).
 */
export const getReviewerEmployeeId = (req) => req.employee?._id || null;

/** Org owner / platform admin — not merely having a linked User record. */
export const isAdminUser = (req) =>
    Boolean(req.authContext?.isOrgOwner) ||
    (req.decoded?.role === 'admin' && Boolean(req.authContext?.isOrgOwner || req.authContext?.isHrManager));

export const isHrEmployee = (req) =>
    Boolean(
        req.authContext?.isHrManager ||
            req.authContext?.isHrExecutive ||
            req.employee?.isHR
    );

/**
 * First pending step in workflow order.
 */
export const getCurrentPendingStep = (approvalInstance) => {
    if (!approvalInstance?.steps?.length) return null;
    const sorted = [...approvalInstance.steps].sort(
        (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
    );
    return sorted.find((step) => step.status === 'Pending') || null;
};

export const loadWorkflowStepDefinition = async (approvalInstance, currentStep) => {
    if (!approvalInstance?.workflowId || currentStep?.stepNumber == null) {
        return null;
    }
    const workflow = await ApprovalWorkflow.findById(approvalInstance.workflowId)
        .select('steps.stepNumber steps.stepName steps.approverType')
        .lean();
    return workflow?.steps?.find((s) => s.stepNumber === currentStep.stepNumber) || null;
};

/**
 * Whether the logged-in employee is the natural actor for this step type.
 */
export const isNaturalActorForStep = (req, approverType, currentStep, employeeLinked = true) => {
    const reviewerEmployeeId = getReviewerEmployeeId(req);
    if (!reviewerEmployeeId || !currentStep) return false;

    const assignedApproverId = currentStep.approverId;
    const isAssignedApprover =
        assignedApproverId &&
        String(assignedApproverId) === String(reviewerEmployeeId);

    if (isAssignedApprover) return true;

    const isManager = shouldScopeDataToManagedTeam(req);
    const isHR = isHrEmployee(req);
    const isExecutive =
        Boolean(req.authContext?.isExecutive) || Boolean(req.employee?.isExecutive);

    switch (approverType) {
        case 'Manager':
            return isManager && employeeLinked;
        case 'HR':
            return isHR;
        case 'Executive':
            return isExecutive;
        default:
            return false;
    }
};

/**
 * HR/Admin acting on a step that is not theirs (e.g. HR on Manager step).
 */
export const needsEarlyApprovalConfirm = (
    req,
    approverType,
    currentStep,
    employeeLinked = true
) => {
    if (isAdminUser(req)) return false;
    if (!isHrEmployee(req)) return false;
    return !isNaturalActorForStep(req, approverType, currentStep, employeeLinked);
};

export const buildWorkflowSummary = async (approvalInstanceId) => {
    if (!approvalInstanceId) {
        return { hasWorkflow: false };
    }

    const instance = await ApprovalInstance.findById(approvalInstanceId).lean();
    if (!instance) {
        return { hasWorkflow: false };
    }

    const workflow = instance.workflowId
        ? await ApprovalWorkflow.findById(instance.workflowId)
              .select('steps.stepNumber steps.stepName steps.approverType')
              .lean()
        : null;

    const stepTypeByNumber = new Map(
        (workflow?.steps || []).map((s) => [s.stepNumber, s.approverType])
    );
    const stepNameByNumber = new Map(
        (workflow?.steps || []).map((s) => [s.stepNumber, s.stepName])
    );

    const sortedSteps = [...(instance.steps || [])].sort(
        (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
    );

    const pendingStep = sortedSteps.find((s) => s.status === 'Pending') || null;
    const pendingApproverType = pendingStep
        ? stepTypeByNumber.get(pendingStep.stepNumber) || null
        : null;

    return {
        hasWorkflow: true,
        instanceStatus: instance.status,
        slaEscalated: Boolean(instance.slaEscalated || pendingStep?.escalated),
        slaEscalatedAt: instance.slaEscalatedAt || pendingStep?.escalatedAt || null,
        hrOverrideUsed: Boolean(instance.hrOverride?.used),
        hrOverrideAction: instance.hrOverride?.action || null,
        hrOverrideByName: instance.hrOverride?.byName || null,
        auditTrail: Array.isArray(instance.auditTrail) ? instance.auditTrail : [],
        pendingStep: pendingStep
            ? {
                  stepNumber: pendingStep.stepNumber,
                  stepName:
                      pendingStep.stepName ||
                      stepNameByNumber.get(pendingStep.stepNumber) ||
                      `Step ${pendingStep.stepNumber}`,
                  approverType: pendingApproverType,
                  approverName: pendingStep.approverName || null,
                  status: pendingStep.status,
                  escalated: Boolean(pendingStep.escalated),
              }
            : null,
        steps: sortedSteps.map((s) => ({
            stepNumber: s.stepNumber,
            stepName: s.stepName || stepNameByNumber.get(s.stepNumber) || `Step ${s.stepNumber}`,
            approverType: stepTypeByNumber.get(s.stepNumber) || null,
            approverName: s.approverName || null,
            status: s.status,
        })),
    };
};

export const attachWorkflowSummariesToRequests = async (requests) => {
    if (!requests?.length) return requests;

    const withWorkflow = requests.filter((r) => r.approvalInstanceId);
    if (!withWorkflow.length) {
        return requests.map((r) => ({ ...r, workflowSummary: { hasWorkflow: false } }));
    }

    const instanceIds = [
        ...new Set(withWorkflow.map((r) => String(r.approvalInstanceId))),
    ];
    const instances = await ApprovalInstance.find({ _id: { $in: instanceIds } }).lean();
    const instanceMap = new Map(instances.map((i) => [String(i._id), i]));

    const workflowIds = [
        ...new Set(instances.map((i) => String(i.workflowId)).filter(Boolean)),
    ];
    const workflows = workflowIds.length
        ? await ApprovalWorkflow.find({ _id: { $in: workflowIds } })
              .select('steps.stepNumber steps.stepName steps.approverType')
              .lean()
        : [];
    const workflowMap = new Map(workflows.map((w) => [String(w._id), w]));

    return requests.map((request) => {
        const instance = request.approvalInstanceId
            ? instanceMap.get(String(request.approvalInstanceId))
            : null;
        if (!instance) {
            return { ...request, workflowSummary: { hasWorkflow: false } };
        }

        const workflow = instance.workflowId
            ? workflowMap.get(String(instance.workflowId))
            : null;
        const stepTypeByNumber = new Map(
            (workflow?.steps || []).map((s) => [s.stepNumber, s.approverType])
        );
        const stepNameByNumber = new Map(
            (workflow?.steps || []).map((s) => [s.stepNumber, s.stepName])
        );

        const sortedSteps = [...(instance.steps || [])].sort(
            (a, b) => (a.stepNumber || 0) - (b.stepNumber || 0)
        );
        const pendingStep = sortedSteps.find((s) => s.status === 'Pending') || null;

        return {
            ...request,
            workflowSummary: {
                hasWorkflow: true,
                instanceStatus: instance.status,
                slaEscalated: Boolean(instance.slaEscalated || pendingStep?.escalated),
                slaEscalatedAt: instance.slaEscalatedAt || pendingStep?.escalatedAt || null,
                hrOverrideUsed: Boolean(instance.hrOverride?.used),
                hrOverrideAction: instance.hrOverride?.action || null,
                hrOverrideByName: instance.hrOverride?.byName || null,
                auditTrail: Array.isArray(instance.auditTrail) ? instance.auditTrail : [],
                pendingStep: pendingStep
                    ? {
                          stepNumber: pendingStep.stepNumber,
                          stepName:
                              pendingStep.stepName ||
                              stepNameByNumber.get(pendingStep.stepNumber) ||
                              `Step ${pendingStep.stepNumber}`,
                          approverType:
                              stepTypeByNumber.get(pendingStep.stepNumber) || null,
                          approverName: pendingStep.approverName || null,
                          status: pendingStep.status,
                          escalated: Boolean(pendingStep.escalated),
                      }
                    : null,
                steps: sortedSteps.map((s) => ({
                    stepNumber: s.stepNumber,
                    stepName:
                        s.stepName ||
                        stepNameByNumber.get(s.stepNumber) ||
                        `Step ${s.stepNumber}`,
                    approverType: stepTypeByNumber.get(s.stepNumber) || null,
                    approverName: s.approverName || null,
                    status: s.status,
                })),
            },
        };
    });
};

/**
 * Resolve params for processApprovalAction on regularization requests.
 */
export const resolveRegularizationWorkflowAction = async ({
    req,
    approvalInstance,
    currentStep,
    employeeLinked = true,
    confirmEarlyApproval = false,
}) => {
    const reviewerEmployeeId = getReviewerEmployeeId(req);
    const workflowStep = await loadWorkflowStepDefinition(approvalInstance, currentStep);
    const approverType = workflowStep?.approverType || null;
    const assignedApproverId = currentStep?.approverId;

    const naturalActor = isNaturalActorForStep(
        req,
        approverType,
        currentStep,
        employeeLinked
    );

    const earlyConfirmNeeded = needsEarlyApprovalConfirm(
        req,
        approverType,
        currentStep,
        employeeLinked
    );

    /**
     * Additive HR override: HR may finalize immediately while Manager (or other
     * non-HR) step is pending — no confirm dialog required.
     * Legacy confirmEarlyApproval path remains for non-finalize early step use.
     */
    const hrImmediateOverride =
        isHrEmployee(req) &&
        Boolean(approverType) &&
        approverType !== 'HR' &&
        !naturalActor;

    if (earlyConfirmNeeded && !confirmEarlyApproval && !hrImmediateOverride) {
        const stepLabel = workflowStep?.stepName || approverType || 'current';
        const err = new Error(
            `The ${stepLabel} step has not been completed by the assigned approver yet. Confirm to proceed on this step only.`
        );
        err.statusCode = 409;
        err.code = EARLY_APPROVAL_CONFIRM_CODE;
        throw err;
    }

    const isManager =
        shouldScopeDataToManagedTeam(req);
    const isManagerStep = approverType === 'Manager';
    const managerTeamOverride =
        isManager && employeeLinked && isManagerStep && Boolean(reviewerEmployeeId);

    const isAssignedApprover =
        reviewerEmployeeId &&
        assignedApproverId &&
        String(assignedApproverId) === String(reviewerEmployeeId);

    const hrEarlyOverride =
        hrImmediateOverride ||
        (earlyConfirmNeeded && confirmEarlyApproval && isHrEmployee(req));

    /** After step timeout: next-step assignee (or natural next-step actor) may finalize */
    let timeoutEscalationOverride = false;
    let timeoutOverrideLabel = null;
    if (currentStep?.escalated && reviewerEmployeeId && !hrEarlyOverride && !isAssignedApprover) {
        if (isTimeoutNextStepAssignee(approvalInstance, reviewerEmployeeId)) {
            timeoutEscalationOverride = true;
            const nextStep = getNextWorkflowInstanceStep(
                approvalInstance,
                currentStep.stepNumber
            );
            const nextDef = nextStep
                ? await loadWorkflowStepDefinition(approvalInstance, nextStep)
                : null;
            timeoutOverrideLabel =
                nextDef?.approverType || nextStep?.stepName || 'Next step';
        } else {
            const nextStep = getNextWorkflowInstanceStep(
                approvalInstance,
                currentStep.stepNumber
            );
            if (nextStep) {
                const nextDef = await loadWorkflowStepDefinition(
                    approvalInstance,
                    nextStep
                );
                if (
                    isNaturalActorForStep(
                        req,
                        nextDef?.approverType,
                        nextStep,
                        employeeLinked
                    )
                ) {
                    timeoutEscalationOverride = true;
                    timeoutOverrideLabel =
                        nextDef?.approverType || nextStep?.stepName || 'Next step';
                }
            }
        }
    }

    const mayAct = Boolean(
        naturalActor ||
            managerTeamOverride ||
            isAssignedApprover ||
            hrEarlyOverride ||
            timeoutEscalationOverride
    );

    let overrideLabel = null;
    if (hrEarlyOverride) overrideLabel = 'HR';
    else if (timeoutEscalationOverride) overrideLabel = timeoutOverrideLabel;
    else if (managerTeamOverride && !isAssignedApprover) overrideLabel = 'Manager';

    const approverIdForAction =
        reviewerEmployeeId || assignedApproverId || null;
    const performedByEmployeeId = reviewerEmployeeId || assignedApproverId || null;

    if (!mayAct) {
        const err = new Error(
            'You are not authorized for the current workflow step. Wait for the previous approver or contact HR.'
        );
        err.statusCode = 403;
        throw err;
    }

    return {
        approverIdForAction,
        performedByEmployeeId,
        reviewerEmployeeId,
        overrideLabel,
        approverType,
        useTimeoutFinalize: timeoutEscalationOverride,
    };
};

export const prefixWorkflowComment = (comments, overrideLabel) => {
    if (!overrideLabel) return comments;
    const base = String(comments || '').trim();
    return base ? `[${overrideLabel} override] ${base}` : `[${overrideLabel} override]`;
};

export const executeRegularizationWorkflowAction = async ({
    req,
    approvalInstance,
    currentStep,
    action,
    comments,
    regularizationRequest,
    employeeLinked = true,
    confirmEarlyApproval = false,
}) => {
    const params = await resolveRegularizationWorkflowAction({
        req,
        approvalInstance,
        currentStep,
        employeeLinked,
        confirmEarlyApproval,
    });

    // Additive: HR early override OR next-step actor after timeout — finalize remaining steps
    if (
        (params.overrideLabel === 'HR' && params.approverType && params.approverType !== 'HR') ||
        params.useTimeoutFinalize
    ) {
        const actor = req.employee;
        const performedByName = actor
            ? [actor.name, actor.lastName].filter(Boolean).join(' ').trim()
            : params.overrideLabel || 'Approver';
        return hrOverrideFinalizeApproval({
            approvalInstanceId: approvalInstance._id,
            action,
            performedByEmployeeId: params.performedByEmployeeId,
            performedByName,
            comments: prefixWorkflowComment(comments, params.overrideLabel),
            metadata: {
                regularizationId: regularizationRequest._id,
                regularizationType: regularizationRequest.regularizationType,
                overrideRole: params.overrideLabel,
                ...(params.useTimeoutFinalize ? { timeoutEscalation: true } : {}),
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
            regularizationId: regularizationRequest._id,
            regularizationType: regularizationRequest.regularizationType,
            overrideRole: params.overrideLabel,
        },
        skipApproverValidation: true,
        performedByEmployeeId: params.performedByEmployeeId,
    });
};

/**
 * Admin: approve all remaining workflow steps and finalize the request.
 */
export const executeAdminBypassRegularization = async ({
    approvalInstance,
    comments,
    regularizationRequest,
}) => {
    return adminBypassApprovalInstance({
        approvalInstanceId: approvalInstance._id,
        comments: prefixWorkflowComment(comments, 'Admin'),
        metadata: {
            regularizationId: regularizationRequest._id,
            regularizationType: regularizationRequest.regularizationType,
            adminBypass: true,
        },
    });
};

export const sendRegularizationActionError = (res, error, defaultMessage) => {
    const statusCode = error.statusCode || 500;
    let message = defaultMessage;

    if (statusCode === 403) {
        message = error.message;
    } else if (statusCode === 409) {
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
