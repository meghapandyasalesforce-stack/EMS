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

const router = express.Router();

// Balance routes — must be registered BEFORE /:id to avoid route shadowing
router.route('/balance/recalculate')
    .post(isAdminOrHROrExecutiveAuthenticated, recalculateBalances);

router.route('/balance/:employeeId')
    .get(isAdminOrHROrExecutiveAuthenticated, getEmployeeLeaveBalance);

// Policy management routes (HR/Admin only)
router.route('/')
    .get(isAdminOrHROrExecutiveAuthenticated, getAllLeavePolicies)
    .post(isAdminOrHROrExecutiveAuthenticated, createLeavePolicy);

router.route('/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeavePolicyById)
    .put(isAdminOrHROrExecutiveAuthenticated, updateLeavePolicy)
    .delete(isAdminOrHROrExecutiveAuthenticated, deleteLeavePolicy);

export default router;

