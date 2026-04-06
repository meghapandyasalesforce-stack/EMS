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
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

// Policy management routes (HR/Admin only)
router.route('/')
    .get(isAdminOrHROrExecutiveAuthenticated, getAllLeavePolicies)
    .post(isAdminOrHROrExecutiveAuthenticated, createLeavePolicy);

router.route('/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeavePolicyById)
    .put(isAdminOrHROrExecutiveAuthenticated, updateLeavePolicy)
    .delete(isAdminOrHROrExecutiveAuthenticated, deleteLeavePolicy);

// Balance routes
router.route('/balance/:employeeId')
    .get(isAuthenticated, getEmployeeLeaveBalance);

router.route('/balance/recalculate')
    .post(isAdminOrHROrExecutiveAuthenticated, recalculateBalances);

export default router;

