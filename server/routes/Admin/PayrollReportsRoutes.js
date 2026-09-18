import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getPayrollStatistics,
    getMonthlySummary,
    getDepartmentWiseReport,
    getTaxReport,
    getDeductionsReport,
    getEarningsReport,
    getComparisonReport
} from '../../controllers/admin/payrollReportsController.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import { payrollLimiter } from '../../middlewares/endpointRateLimiters.js';
import { cacheMiddleware } from '../../helpers/cache.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PAYROLL));

// Get payroll statistics/analytics
router.route('/statistics')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:stats', 300), getPayrollStatistics);

// Get monthly summary
router.route('/monthly-summary')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:monthly', 300), getMonthlySummary);

// Get department-wise report
router.route('/department-wise')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:dept', 300), getDepartmentWiseReport);

// Get tax report
router.route('/tax-report')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:tax', 300), getTaxReport);

// Get deductions report
router.route('/deductions-report')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:deductions', 300), getDeductionsReport);

// Get earnings report
router.route('/earnings-report')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:earnings', 300), getEarningsReport);

// Get comparison report
router.route('/comparison')
    .get(isAdminOrManagerOrHRAuthenticated, payrollLimiter, cacheMiddleware('payroll:comparison', 300), getComparisonReport);

export default router;

