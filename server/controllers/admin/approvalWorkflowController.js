import { ApprovalWorkflow, ApprovalInstance } from '../../models/approvalWorkflow.model.js';
import {
    initiateApproval,
    processApprovalAction,
    getPendingApprovals,
    getEscalatedApprovalsCount,
    delegateApproval,
    hrOverrideFinalizeApproval,
    isTimeoutNextStepAssignee,
    getFirstPendingStep,
    getNextWorkflowInstanceStep,
} from '../../services/approvalWorkflowService.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError } from '../../helpers/responseHelper.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import AttendanceRegularization from '../../models/attendanceRegularization.model.js';
import { applyRegularizationApproval } from '../../services/attendanceRegularizationWorkflowService.js';
import { isHrEmployee } from '../../helpers/regularizationWorkflowActionHelper.js';

/**
 * Create approval workflow
 */
export const createWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { name, description, entityType, steps, autoApprove, escalation } = req.body;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const workflow = await ApprovalWorkflow.create({
        organizationId,
        name,
        description,
        entityType,
        steps,
        autoApprove,
        escalation,
        createdBy: req.user?._id || req.employee?._id
    });

    return sendSuccess(res, workflow, 'Workflow created successfully', 201);
});

/**
 * Get all workflows
 */
export const getAllWorkflows = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { entityType, isActive } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const query = { organizationId };
    if (entityType) query.entityType = entityType;
    if (isActive !== undefined) query.isActive = isActive === 'true';

    const workflows = await ApprovalWorkflow.find(query)
        .populate('steps.approverRole', 'name')
        .populate('steps.approverEmployee', 'name email')
        .sort({ createdAt: -1 });

    return sendSuccess(res, workflows, 'Workflows retrieved successfully');
});

/**
 * Get workflow by ID
 */
export const getWorkflowById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const workflow = await ApprovalWorkflow.findOne({
        _id: id,
        organizationId
    })
        .populate('steps.approverRole', 'name')
        .populate('steps.approverEmployee', 'name email');

    if (!workflow) {
        return sendError(res, 'Workflow not found', 404);
    }

    return sendSuccess(res, workflow, 'Workflow retrieved successfully');
});

/**
 * Update workflow
 */
export const updateWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;
    const updateData = req.body;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const workflow = await ApprovalWorkflow.findOneAndUpdate(
        { _id: id, organizationId },
        { ...updateData, updatedBy: req.user?._id || req.employee?._id },
        { new: true, runValidators: true }
    );

    if (!workflow) {
        return sendError(res, 'Workflow not found', 404);
    }

    return sendSuccess(res, workflow, 'Workflow updated successfully');
});

/**
 * Delete workflow
 */
export const deleteWorkflow = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    // Check if workflow is in use
    const inUse = await ApprovalInstance.findOne({
        workflowId: id,
        status: { $in: ['Pending', 'In Progress'] }
    });

    if (inUse) {
        return sendError(res, 'Cannot delete workflow that has active approvals', 400);
    }

    const workflow = await ApprovalWorkflow.findOneAndDelete({
        _id: id,
        organizationId
    });

    if (!workflow) {
        return sendError(res, 'Workflow not found', 404);
    }

    return sendSuccess(res, null, 'Workflow deleted successfully');
});

/**
 * Get approval instances
 */
export const getApprovalInstances = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, entityType, page = 1, limit = 20 } = req.query;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const query = { organizationId };
    if (status) query.status = status;
    if (entityType) query.entityType = entityType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const [instances, total] = await Promise.all([
        ApprovalInstance.find(query)
            .populate('requestedBy', 'name email')
            .populate('workflowId', 'name')
            .populate('steps.approverId', 'name email')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit)),
        ApprovalInstance.countDocuments(query)
    ]);

    return sendSuccess(res, {
        instances,
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    }, 'Approval instances retrieved successfully');
});

/**
 * Get approval instance by ID
 */
export const getApprovalInstanceById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const instance = await ApprovalInstance.findOne({
        _id: id,
        organizationId
    })
        .populate('requestedBy', 'name email')
        .populate('workflowId')
        .populate('steps.approverId', 'name email')
        .populate('steps.delegatedTo', 'name email');

    if (!instance) {
        return sendError(res, 'Approval instance not found', 404);
    }

    return sendSuccess(res, instance, 'Approval instance retrieved successfully');
});

/**
 * Get pending approvals for current user
 */
export const getMyPendingApprovals = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const approverId = req.user?._id || req.employee?._id;

    if (!organizationId || !approverId) {
        return sendError(res, 'Organization ID and approver ID are required', 400);
    }

    const approvals = await getPendingApprovals(approverId, organizationId, {
        includeHrOverrides: isHrEmployee(req),
    });

    return sendSuccess(res, approvals, 'Pending approvals retrieved successfully');
});

/**
 * Escalated (SLA) approvals count for HR/Admin dashboards — additive metric only.
 */
export const getEscalatedApprovalsMetric = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }
    const count = await getEscalatedApprovalsCount(organizationId);
    return sendSuccess(res, { count }, 'Escalated approvals count retrieved');
});

/**
 * Process approval action
 */
export const processApproval = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { stepNumber, action, comments, metadata, hrOverride, timeoutEscalation } = req.body;
    const approverId = req.user?._id || req.employee?._id;

    if (!approverId) {
        return sendError(res, 'Approver ID is required', 400);
    }

    if (!['Approve', 'Reject', 'Request Changes'].includes(action)) {
        return sendError(res, 'Invalid action', 400);
    }

    // Additive HR override path: finalize without waiting for manager
    if (hrOverride && isHrEmployee(req) && ['Approve', 'Reject'].includes(action)) {
        const actor = req.employee;
        const performedByName = actor
            ? [actor.name, actor.lastName].filter(Boolean).join(' ').trim()
            : 'HR';
        const result = await hrOverrideFinalizeApproval({
            approvalInstanceId: id,
            action,
            performedByEmployeeId: req.employee?._id || approverId,
            performedByName,
            comments,
            metadata: { ...(metadata || {}), hrOverride: true },
        });
        return sendSuccess(res, result, 'Approval processed via HR override successfully');
    }

    // Step-timeout handoff: next-step assignee may finalize after previous step timed out
    if (timeoutEscalation && ['Approve', 'Reject'].includes(action)) {
        const instance = await ApprovalInstance.findById(id);
        if (!instance || instance.status !== 'In Progress') {
            return sendError(res, 'Approval instance not found or already processed', 404);
        }
        const actorId = req.employee?._id || approverId;

        if (!isTimeoutNextStepAssignee(instance, actorId)) {
            return sendError(
                res,
                'Timeout escalation is only available to the next step approver after the current step times out',
                403
            );
        }

        const pending = getFirstPendingStep(instance);
        const next = pending
            ? getNextWorkflowInstanceStep(instance, pending.stepNumber)
            : null;
        const actor = req.employee;
        const performedByName = actor
            ? [actor.name, actor.lastName].filter(Boolean).join(' ').trim()
            : next?.approverName || 'Next step';

        const result = await hrOverrideFinalizeApproval({
            approvalInstanceId: id,
            action,
            performedByEmployeeId: actorId,
            performedByName,
            comments,
            metadata: {
                ...(metadata || {}),
                timeoutEscalation: true,
                overrideRole: next?.stepName || 'Next step',
            },
        });
        return sendSuccess(
            res,
            result,
            'Approval processed via step-timeout escalation successfully'
        );
    }

    const result = await processApprovalAction({
        approvalInstanceId: id,
        stepNumber,
        approverId,
        action,
        comments,
        metadata
    });

    return sendSuccess(res, result, 'Approval processed successfully');
});

/**
 * Initiate approval (called from other controllers)
 */
export const initiateApprovalRequest = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { entityType, entityId, workflowId, metadata, priority } = req.body;
    const requestedBy = req.user?._id || req.employee?._id;

    if (!organizationId || !requestedBy) {
        return sendError(res, 'Organization ID and requester ID are required', 400);
    }

    const result = await initiateApproval({
        organizationId,
        entityType,
        entityId,
        requestedBy,
        workflowId,
        metadata,
        priority
    });

    return sendSuccess(res, result, 'Approval initiated successfully');
});

/**
 * Delegate approval to another employee
 */
export const delegateApprovalRequest = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const { stepNumber, delegateToId, comments } = req.body;
    const approverId = req.user?._id || req.employee?._id;

    if (!approverId) {
        return sendError(res, 'Approver ID is required', 400);
    }

    if (!delegateToId) {
        return sendError(res, 'Delegate employee ID is required', 400);
    }

    if (!stepNumber) {
        return sendError(res, 'Step number is required', 400);
    }

    try {
        const result = await delegateApproval({
            approvalInstanceId: id,
            stepNumber,
            approverId,
            delegateToId,
            comments
        });

        return sendSuccess(res, result, 'Approval delegated successfully');
    } catch (error) {
        logger.error('Delegate approval error', {
            error: error.message,
            approvalInstanceId: id,
            stepNumber,
            approverId
        });
        return sendError(res, error.message || 'Error delegating approval', 400);
    }
});

/**
 * Backfill pending attendance regularization requests into approval workflow.
 */
export const backfillAttendanceRegularizationApprovals = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const dryRun = req.body?.dryRun === true;
    const parsedLimit = Number(req.body?.limit);
    const limit = Number.isFinite(parsedLimit) ? Math.min(Math.max(parsedLimit, 1), 2000) : 500;

    if (!organizationId) {
        return sendError(res, 'Organization ID is required', 400);
    }

    const workflow = await ApprovalWorkflow.findOne({
        organizationId,
        entityType: 'AttendanceRegularization',
        isActive: true
    }).select('_id name');

    if (!workflow) {
        return sendError(res, 'No active attendance regularization workflow found', 400);
    }

    const pendingRequests = await AttendanceRegularization.find({
        organizationId,
        status: 'pending'
    })
        .sort({ createdAt: 1 })
        .limit(limit);

    const existingInstanceIds = pendingRequests
        .map((request) => request.approvalInstanceId)
        .filter(Boolean);

    const existingInstances = existingInstanceIds.length > 0
        ? await ApprovalInstance.find({
            _id: { $in: existingInstanceIds },
            organizationId
        })
            .select('_id status')
            .lean()
        : [];

    const existingInstanceMap = new Map(existingInstances.map((instance) => [String(instance._id), instance]));

    const summary = {
        scanned: pendingRequests.length,
        created: 0,
        autoApproved: 0,
        alreadyLinked: 0,
        errors: []
    };

    for (const request of pendingRequests) {
        try {
            if (request.approvalInstanceId && existingInstanceMap.has(String(request.approvalInstanceId))) {
                summary.alreadyLinked += 1;
                continue;
            }

            if (dryRun) {
                summary.created += 1;
                continue;
            }

            const approvalResult = await initiateApproval({
                organizationId,
                entityType: 'AttendanceRegularization',
                entityId: request._id,
                requestedBy: request.employeeId,
                metadata: {
                    attendanceDate: request.attendanceDate,
                    regularizationType: request.regularizationType,
                    managerId: request.managerId,
                    requestedClockIn: request.requestedClockIn,
                    requestedClockOut: request.requestedClockOut
                },
                priority: request.regularizationType === 'full_day' ? 'High' : 'Medium'
            });

            if (approvalResult.approvalInstanceId) {
                request.approvalInstanceId = approvalResult.approvalInstanceId;
                await request.save();
                summary.created += 1;
                continue;
            }

            if (approvalResult.autoApproved && approvalResult.status === 'Approved') {
                await applyRegularizationApproval({
                    regularizationRequest: request,
                    organizationId,
                    reviewerId: request.managerId || null,
                    managerResponse: 'Auto-approved through regularization backfill'
                });
                summary.autoApproved += 1;
                continue;
            }

            summary.errors.push({
                requestId: request._id,
                message: 'Workflow did not create an approval instance'
            });
        } catch (error) {
            logger.error('Regularization workflow backfill error', {
                error: error.message,
                requestId: request._id,
                stack: error.stack
            });
            summary.errors.push({
                requestId: request._id,
                message: error.message
            });
        }
    }

    return sendSuccess(res, summary, dryRun
        ? 'Regularization workflow backfill preview completed'
        : 'Regularization workflow backfill completed');
});

