import express from 'express';
import {
    createLeavePolicy,
    getAllLeavePolicies,
    getLeavePolicyById,
    updateLeavePolicy,
    deleteLeavePolicy,
    getEmployeeLeaveBalance,
    adjustEmployeeLeaveBalance,
    recalculateBalances,
    getLeavePolicyMeta,
    getEmployeeLeaveHistory,
} from '../../controllers/leave/leavePolicyController.js';
import {
    updateLeaveFromPeriod,
    carryForwardLeave,
    getLeaveBalanceAuditLog,
} from '../../controllers/leave/leaveBalanceAutomationController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isAuthenticatedBoth from '../../middlewares/isAuthenticatedBoth.js';

const router = express.Router();

// Balance routes — must be registered BEFORE /:id to avoid route shadowing
router.route('/balance/recalculate')
    .post(isAdminOrHROrExecutiveAuthenticated, recalculateBalances);

router.route('/balance/:employeeId')
    .get(isAuthenticatedBoth, getEmployeeLeaveBalance);

router.route('/balance/:employeeId/adjust')
    .patch(isAuthenticatedBoth, adjustEmployeeLeaveBalance);

router.route('/balance/:employeeId/update-leave')
    .post(isAuthenticatedBoth, updateLeaveFromPeriod);

router.route('/balance/:employeeId/carry-forward')
    .post(isAuthenticatedBoth, carryForwardLeave);

router.route('/balance/:employeeId/audit')
    .get(isAuthenticatedBoth, getLeaveBalanceAuditLog);

router.route('/balance/:employeeId/history')
    .get(isAuthenticatedBoth, getEmployeeLeaveHistory);

router.route('/meta')
    .get(isAuthenticatedBoth, getLeavePolicyMeta);

// Policy management routes (HR/Admin only)
router.route('/')
    .get(isAdminOrHROrExecutiveAuthenticated, getAllLeavePolicies)
    .post(isAdminOrHROrExecutiveAuthenticated, createLeavePolicy);

router.route('/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeavePolicyById)
    .put(isAdminOrHROrExecutiveAuthenticated, updateLeavePolicy)
    .delete(isAdminOrHROrExecutiveAuthenticated, deleteLeavePolicy);

export default router;

