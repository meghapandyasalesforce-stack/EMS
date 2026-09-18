import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createLeavePolicy,
    getAllLeavePolicies,
    getLeavePolicyById,
    updateLeavePolicy,
    deleteLeavePolicy,
    getEmployeeLeaveBalance,
    adjustEmployeeLeaveBalance,
    addManualCarryForward,
    reduceManualCarryForward,
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

router.use(requireFeature(SAAS_FEATURES.LEAVE));

// Balance routes — must be registered BEFORE /:id to avoid route shadowing
router.route('/balance/recalculate')
    .post(isAdminOrHROrExecutiveAuthenticated, recalculateBalances);

router.route('/balance/:employeeId')
    .get(isAuthenticatedBoth, getEmployeeLeaveBalance);

router.route('/balance/:employeeId/adjust')
    .patch(isAuthenticatedBoth, adjustEmployeeLeaveBalance);

router.route('/balance/:employeeId/manual-carry-forward')
    .post(isAdminOrHROrExecutiveAuthenticated, addManualCarryForward);

router.route('/balance/:employeeId/manual-carry-forward/reduce')
    .post(isAdminOrHROrExecutiveAuthenticated, reduceManualCarryForward);

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

