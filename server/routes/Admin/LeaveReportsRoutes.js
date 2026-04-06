import express from 'express';
import {
    getLeaveUsageTrends,
    getLeaveBalanceReport,
    getLeaveApprovalAnalytics
} from '../../controllers/leave/leaveReportsController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';

const router = express.Router();

router.route('/usage-trends')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeaveUsageTrends);

router.route('/balance-report')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeaveBalanceReport);

router.route('/approval-analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeaveApprovalAnalytics);

export default router;

