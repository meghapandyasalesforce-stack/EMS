import express from 'express';
import {
    getLeaveUsageTrends,
    getLeaveBalanceReport,
    getLeaveApprovalAnalytics
} from '../../controllers/leave/leaveReportsController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';

const router = express.Router();

router.route('/usage-trends')
    .get(isAdminOrHRAuthenticated, getLeaveUsageTrends);

router.route('/balance-report')
    .get(isAdminOrHRAuthenticated, getLeaveBalanceReport);

router.route('/approval-analytics')
    .get(isAdminOrHRAuthenticated, getLeaveApprovalAnalytics);

export default router;

