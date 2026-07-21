import TaxRegimeChange from '../../models/taxRegimeChange.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import { initiateApproval, cancelApprovalInstance, processApprovalAction } from '../../services/approvalWorkflowService.js';
import {
  applyTaxRegimeChangeApproval,
  applyTaxRegimeChangeRejection,
  findTaxRegimeApproverRecipients,
} from '../../services/taxRegimeChangeWorkflowService.js';
import { sendNotification } from '../../helpers/notificationService.js';
import { getEffectiveFunctionalRoles } from '../../helpers/functionalRolesHelper.js';

const isNaRegime = (value) => {
  const normalized = String(value || '').trim().toLowerCase();
  return normalized === 'n/a' || normalized === 'na';
};

const canReviewTaxRegimeRequests = async (req) => {
  const ctx = req.authContext || {};
  const buckets = ctx.buckets || [];
  if (
    req.user?.role === 'admin' ||
    req.isAdmin ||
    ctx.isOrgOwner ||
    ctx.isHrManager ||
    ctx.isHrExecutive ||
    ctx.isExecutive ||
    buckets.includes('org_owner') ||
    buckets.includes('hr_manager') ||
    buckets.includes('hr_executive') ||
    buckets.includes('executive')
  ) {
    return true;
  }

  if (!req.employee?._id) return false;

  const reviewer = await Employee.findById(req.employee._id)
    .select('functionalRoles department position jobTitle')
    .lean();
  if (!reviewer) return false;

  const roles = getEffectiveFunctionalRoles(reviewer);
  return (
    roles.includes('hr') ||
    roles.includes('admin') ||
    roles.includes('executive') ||
    roles.includes('hr_manager') ||
    roles.includes('hr_executive')
  );
};

const getReviewerId = (req) => req.employee?._id || req.user?._id || null;

/**
 * Shared create logic used by dedicated endpoint and financial-details save.
 */
export const createTaxRegimeChangeRequestForEmployee = async ({
  employeeId,
  organizationId,
  currentTaxRegime,
  reason,
}) => {
  const existingPending = await TaxRegimeChange.findOne({
    employeeId,
    organizationId,
    status: 'pending',
    requestedTaxRegime: 'N/A',
  });

  if (existingPending) {
    return {
      request: existingPending,
      alreadyPending: true,
    };
  }

  const taxRegimeRequest = await TaxRegimeChange.create({
    organizationId,
    employeeId,
    currentTaxRegime: currentTaxRegime || 'New',
    requestedTaxRegime: 'N/A',
    reason: reason || 'Employee requested N/A (no TDS) tax regime',
    status: 'pending',
  });

  let approvalResult = null;
  try {
    approvalResult = await initiateApproval({
      organizationId,
      entityType: 'TaxRegimeChange',
      entityId: taxRegimeRequest._id,
      requestedBy: employeeId,
      metadata: {
        currentTaxRegime: taxRegimeRequest.currentTaxRegime,
        requestedTaxRegime: taxRegimeRequest.requestedTaxRegime,
        reason: taxRegimeRequest.reason,
        employeeId: String(employeeId),
      },
      priority: 'High',
    });
  } catch (approvalError) {
    logger.warn('Failed to initiate tax regime approval workflow', {
      error: approvalError.message,
      requestId: taxRegimeRequest._id,
    });
  }

  // If a workflow auto-approves (or no workflow configured with auto-approve behavior),
  // do NOT auto-apply N/A — leave pending for HR/Admin unless a real instance was created.
  if (approvalResult?.approvalInstanceId) {
    taxRegimeRequest.approvalInstanceId = approvalResult.approvalInstanceId;
    await taxRegimeRequest.save();
  } else {
    // No workflow instance: notify HR/Admin so they can act from Pending Approvals / list API
    const recipients = await findTaxRegimeApproverRecipients(organizationId);
    const employee = await Employee.findById(employeeId).select('name lastName').lean();
    const employeeName = [employee?.name, employee?.lastName].filter(Boolean).join(' ') || 'An employee';

    await Promise.allSettled(
      recipients.map((recipient) =>
        sendNotification({
          userId: recipient._id,
          title: 'Tax Regime Change Request',
          message: `${employeeName} requested tax regime N/A (no TDS). Please review and approve or reject.`,
          type: 'approval_request',
          priority: 'high',
          metadata: {
            entityType: 'TaxRegimeChange',
            entityId: taxRegimeRequest._id,
            currentTaxRegime: taxRegimeRequest.currentTaxRegime,
            requestedTaxRegime: 'N/A',
          },
        })
      )
    );
  }

  return {
    request: taxRegimeRequest,
    alreadyPending: false,
    approvalResult,
  };
};

/**
 * POST /api/v1/both/tax-regime-change/request
 */
export const createTaxRegimeChangeRequest = async (req, res) => {
  try {
    const employeeId = req.employee?._id;
    const organizationId = getOrganizationId(req);

    if (!employeeId || !organizationId) {
      return res.status(400).json({ message: 'Employee and organization are required' });
    }

    const employee = await Employee.findById(employeeId).select('financialDetails').lean();
    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const currentTaxRegime = employee.financialDetails?.taxRegime || 'New';
    if (isNaRegime(currentTaxRegime)) {
      return res.status(400).json({ message: 'Tax regime is already set to N/A' });
    }

    const { reason } = req.body || {};
    const result = await createTaxRegimeChangeRequestForEmployee({
      employeeId,
      organizationId,
      currentTaxRegime,
      reason,
    });

    return res.status(result.alreadyPending ? 200 : 201).json({
      message: result.alreadyPending
        ? 'A tax regime N/A request is already pending approval'
        : 'Tax regime N/A request submitted for HR/Admin approval',
      taxRegimeRequest: result.request,
    });
  } catch (error) {
    logger.error('Error creating tax regime change request', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: 'Failed to create tax regime change request' });
  }
};

/**
 * GET /api/v1/both/tax-regime-change/request
 */
export const getMyTaxRegimeChangeRequests = async (req, res) => {
  try {
    const employeeId = req.employee?._id;
    const organizationId = getOrganizationId(req);

    const requests = await TaxRegimeChange.find({
      employeeId,
      organizationId,
    })
      .sort({ createdAt: -1 })
      .lean();

    return res.status(200).json({ data: requests });
  } catch (error) {
    logger.error('Error fetching tax regime change requests', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch tax regime change requests' });
  }
};

/**
 * PATCH /api/v1/both/tax-regime-change/request/:id/cancel
 */
export const cancelTaxRegimeChangeRequest = async (req, res) => {
  try {
    const employeeId = req.employee?._id;
    const organizationId = getOrganizationId(req);
    const { id } = req.params;

    const taxRegimeRequest = await TaxRegimeChange.findOne({
      _id: id,
      employeeId,
      organizationId,
    });

    if (!taxRegimeRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }

    if (taxRegimeRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Only pending requests can be cancelled' });
    }

    if (taxRegimeRequest.approvalInstanceId) {
      await cancelApprovalInstance({
        approvalInstanceId: taxRegimeRequest.approvalInstanceId,
        cancelledBy: employeeId,
        reason: 'Cancelled by requester',
      });
    }

    taxRegimeRequest.status = 'cancelled';
    taxRegimeRequest.reviewedAt = new Date();
    await taxRegimeRequest.save();

    return res.status(200).json({
      message: 'Tax regime change request cancelled',
      taxRegimeRequest,
    });
  } catch (error) {
    logger.error('Error cancelling tax regime change request', { error: error.message });
    return res.status(500).json({ message: 'Failed to cancel tax regime change request' });
  }
};

/**
 * GET /api/v1/both/tax-regime-change/admin/pending
 * Pending requests for HR/Admin (including those without a workflow instance).
 */
export const getPendingTaxRegimeChangeRequests = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!(await canReviewTaxRegimeRequests(req))) {
      return res.status(403).json({ message: 'Not authorized to review tax regime requests' });
    }

    const requests = await TaxRegimeChange.find({
      organizationId,
      status: 'pending',
    })
      .populate('employeeId', 'name lastName email department')
      .sort({ createdAt: -1 })
      .lean();

    const shaped = requests.map((request) => ({
      _id: request._id,
      entityType: 'TaxRegimeChange',
      status: 'In Progress',
      priority: 'High',
      requestedBy: request.employeeId
        ? {
            _id: request.employeeId._id,
            name: [request.employeeId.name, request.employeeId.lastName].filter(Boolean).join(' '),
            email: request.employeeId.email,
          }
        : null,
      metadata: {
        currentTaxRegime: request.currentTaxRegime,
        requestedTaxRegime: request.requestedTaxRegime,
        reason: request.reason,
      },
      approvalInstanceId: request.approvalInstanceId,
      taxRegimeRequestId: request._id,
      isDirectTaxRegimeRequest: !request.approvalInstanceId,
      currentPendingStep: {
        stepNumber: 1,
        stepName: 'HR / Admin Review',
        status: 'Pending',
      },
      createdAt: request.createdAt,
    }));

    return res.status(200).json({ data: shaped });
  } catch (error) {
    logger.error('Error fetching pending tax regime requests', { error: error.message });
    return res.status(500).json({ message: 'Failed to fetch pending tax regime requests' });
  }
};

/**
 * PATCH /api/v1/both/tax-regime-change/admin/approve/:id
 */
export const approveTaxRegimeChangeRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!(await canReviewTaxRegimeRequests(req))) {
      return res.status(403).json({ message: 'Not authorized to approve tax regime requests' });
    }

    const { id } = req.params;
    const reviewerId = getReviewerId(req);
    const comments = req.body?.comments || 'Approved by HR/Admin';

    const taxRegimeRequest = await TaxRegimeChange.findOne({ _id: id, organizationId });
    if (!taxRegimeRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (taxRegimeRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    // If linked to workflow and still in progress, process through workflow
    if (taxRegimeRequest.approvalInstanceId) {
      try {
        await processApprovalAction({
          approvalInstanceId: taxRegimeRequest.approvalInstanceId,
          stepNumber: req.body?.stepNumber || 1,
          approverId: reviewerId,
          action: 'Approve',
          comments,
        });
        const refreshed = await TaxRegimeChange.findById(id);
        return res.status(200).json({
          message: 'Tax regime change approved',
          taxRegimeRequest: refreshed,
        });
      } catch (workflowError) {
        // Fall through to direct approve if workflow action fails (e.g. not assigned step)
        logger.warn('Workflow approve failed for tax regime; applying direct approve', {
          error: workflowError.message,
          requestId: id,
        });
      }
    }

    await applyTaxRegimeChangeApproval({
      taxRegimeRequest,
      reviewerId,
      comments,
    });

    try {
      await sendNotification({
        userId: taxRegimeRequest.employeeId,
        title: 'Tax Regime Request Approved',
        message: `Your request to set tax regime to ${taxRegimeRequest.requestedTaxRegime} has been approved.`,
        type: 'approval_approved',
        priority: 'medium',
        metadata: {
          entityType: 'TaxRegimeChange',
          entityId: taxRegimeRequest._id,
        },
      });
    } catch (notifyError) {
      logger.warn('Failed to notify employee of tax regime approval', {
        error: notifyError.message,
      });
    }

    return res.status(200).json({
      message: 'Tax regime change approved',
      taxRegimeRequest,
    });
  } catch (error) {
    logger.error('Error approving tax regime change request', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: 'Failed to approve tax regime change request' });
  }
};

/**
 * PATCH /api/v1/both/tax-regime-change/admin/reject/:id
 */
export const rejectTaxRegimeChangeRequest = async (req, res) => {
  try {
    const organizationId = getOrganizationId(req);
    if (!(await canReviewTaxRegimeRequests(req))) {
      return res.status(403).json({ message: 'Not authorized to reject tax regime requests' });
    }

    const { id } = req.params;
    const reviewerId = getReviewerId(req);
    const rejectionReason = (req.body?.comments || req.body?.rejectionReason || '').trim();

    if (!rejectionReason) {
      return res.status(400).json({ message: 'Rejection reason is required' });
    }

    const taxRegimeRequest = await TaxRegimeChange.findOne({ _id: id, organizationId });
    if (!taxRegimeRequest) {
      return res.status(404).json({ message: 'Request not found' });
    }
    if (taxRegimeRequest.status !== 'pending') {
      return res.status(400).json({ message: 'Request is not pending' });
    }

    if (taxRegimeRequest.approvalInstanceId) {
      try {
        await processApprovalAction({
          approvalInstanceId: taxRegimeRequest.approvalInstanceId,
          stepNumber: req.body?.stepNumber || 1,
          approverId: reviewerId,
          action: 'Reject',
          comments: rejectionReason,
        });
        const refreshed = await TaxRegimeChange.findById(id);
        return res.status(200).json({
          message: 'Tax regime change rejected',
          taxRegimeRequest: refreshed,
        });
      } catch (workflowError) {
        logger.warn('Workflow reject failed for tax regime; applying direct reject', {
          error: workflowError.message,
          requestId: id,
        });
      }
    }

    await applyTaxRegimeChangeRejection({
      taxRegimeRequest,
      reviewerId,
      rejectionReason,
    });

    try {
      await sendNotification({
        userId: taxRegimeRequest.employeeId,
        title: 'Tax Regime Request Rejected',
        message: `Your request to set tax regime to ${taxRegimeRequest.requestedTaxRegime} was rejected. ${rejectionReason}`,
        type: 'approval_rejected',
        priority: 'medium',
        metadata: {
          entityType: 'TaxRegimeChange',
          entityId: taxRegimeRequest._id,
        },
      });
    } catch (notifyError) {
      logger.warn('Failed to notify employee of tax regime rejection', {
        error: notifyError.message,
      });
    }

    return res.status(200).json({
      message: 'Tax regime change rejected',
      taxRegimeRequest,
    });
  } catch (error) {
    logger.error('Error rejecting tax regime change request', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({ message: 'Failed to reject tax regime change request' });
  }
};

export { isNaRegime };
