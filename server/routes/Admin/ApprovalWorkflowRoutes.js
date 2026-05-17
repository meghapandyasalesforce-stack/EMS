import express from 'express';
import {
    createWorkflow,
    getAllWorkflows,
    getWorkflowById,
    updateWorkflow,
    deleteWorkflow,
    getApprovalInstances,
    getApprovalInstanceById,
    getMyPendingApprovals,
    processApproval,
    initiateApprovalRequest,
    delegateApprovalRequest,
    backfillAttendanceRegularizationApprovals
} from '../../controllers/admin/approvalWorkflowController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';

const router = express.Router();

// Workflow management (Admin only)
router.route('/workflows')
    .post(isAdminAuthenticated, createWorkflow)
    .get(isAdminOrHROrExecutiveAuthenticated, getAllWorkflows);

router.route('/workflows/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, getWorkflowById)
    .put(isAdminAuthenticated, updateWorkflow)
    .delete(isAdminAuthenticated, deleteWorkflow);

// Approval instances
router.route('/instances')
    .get(isAdminOrHROrExecutiveAuthenticated, getApprovalInstances);

router.route('/instances/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, getApprovalInstanceById);

// User-specific approvals
router.route('/my-pending')
    .get(isAdminOrHROrExecutiveAuthenticated, getMyPendingApprovals);

router.route('/process/:id')
    .post(isAdminOrHROrExecutiveAuthenticated, processApproval);

// Delegate approval
router.route('/delegate/:id')
    .post(isAdminOrHROrExecutiveAuthenticated, delegateApprovalRequest);

// Initiate approval
router.route('/initiate')
    .post(isAdminOrHROrExecutiveAuthenticated, initiateApprovalRequest);

// Admin backfill utilities
router.route('/backfill/attendance-regularization')
    .post(isAdminAuthenticated, backfillAttendanceRegularizationApprovals);

export default router;

