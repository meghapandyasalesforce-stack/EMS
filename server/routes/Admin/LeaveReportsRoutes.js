import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getLeaveUsageTrends,
    getLeaveBalanceReport,
    getLeaveApprovalAnalytics
} from '../../controllers/leave/leaveReportsController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LEAVE));

router.route('/usage-trends')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeaveUsageTrends);

router.route('/balance-report')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeaveBalanceReport);

router.route('/approval-analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, getLeaveApprovalAnalytics);

export default router;

