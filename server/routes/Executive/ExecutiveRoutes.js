import express from 'express';
import {
    getFinancialSummary,
    getExecutiveKPIs,
    getCriticalAlerts,
    getProjectPortfolio,
    getDepartmentPerformance,
    getEmployeeTrends,
    getStrategicInsights,
    getPredictiveAnalytics
} from '../../controllers/executive/executiveController.js';
import isAdminOrExecutiveAuthenticated from '../../middlewares/isAdminOrExecutiveAuthenticated.js';
import { readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Financial Summary
router.route('/financial-summary')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getFinancialSummary);

// Executive KPIs
router.route('/kpis')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getExecutiveKPIs);

// Critical Alerts
router.route('/alerts')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getCriticalAlerts);

// Project Portfolio
router.route('/project-portfolio')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getProjectPortfolio);

// Phase 2 Routes
router.route('/department-performance')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getDepartmentPerformance);

router.route('/employee-trends')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getEmployeeTrends);

// Phase 3 Routes
router.route('/strategic-insights')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getStrategicInsights);

router.route('/predictive-analytics')
    .get(isAdminOrExecutiveAuthenticated, readLimiter, getPredictiveAnalytics);

export default router;

