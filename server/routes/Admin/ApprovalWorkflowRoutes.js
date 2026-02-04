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
    delegateApprovalRequest
} from '../../controllers/admin/approvalWorkflowController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';

const router = express.Router();

// Workflow management (Admin only)
router.route('/workflows')
    .post(isAdminAuthenticated, createWorkflow)
    .get(isAdminOrHRAuthenticated, getAllWorkflows);

router.route('/workflows/:id')
    .get(isAdminOrHRAuthenticated, getWorkflowById)
    .put(isAdminAuthenticated, updateWorkflow)
    .delete(isAdminAuthenticated, deleteWorkflow);

// Approval instances
router.route('/instances')
    .get(isAdminOrHRAuthenticated, getApprovalInstances);

router.route('/instances/:id')
    .get(isAdminOrHRAuthenticated, getApprovalInstanceById);

// User-specific approvals
router.route('/my-pending')
    .get(isAdminOrHRAuthenticated, getMyPendingApprovals);

router.route('/process/:id')
    .post(isAdminOrHRAuthenticated, processApproval);

// Delegate approval
router.route('/delegate/:id')
    .post(isAdminOrHRAuthenticated, delegateApprovalRequest);

// Initiate approval
router.route('/initiate')
    .post(isAdminOrHRAuthenticated, initiateApprovalRequest);

export default router;

