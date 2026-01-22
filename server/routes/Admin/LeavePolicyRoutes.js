import express from 'express';
import {
    createLeavePolicy,
    getAllLeavePolicies,
    getLeavePolicyById,
    updateLeavePolicy,
    deleteLeavePolicy,
    getEmployeeLeaveBalance,
    recalculateBalances
} from '../../controllers/leave/leavePolicyController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

// Policy management routes (HR/Admin only)
router.route('/')
    .get(isAdminOrHRAuthenticated, getAllLeavePolicies)
    .post(isAdminOrHRAuthenticated, createLeavePolicy);

router.route('/:id')
    .get(isAdminOrHRAuthenticated, getLeavePolicyById)
    .put(isAdminOrHRAuthenticated, updateLeavePolicy)
    .delete(isAdminOrHRAuthenticated, deleteLeavePolicy);

// Balance routes
router.route('/balance/:employeeId')
    .get(isAuthenticated, getEmployeeLeaveBalance);

router.route('/balance/recalculate')
    .post(isAdminOrHRAuthenticated, recalculateBalances);

export default router;

