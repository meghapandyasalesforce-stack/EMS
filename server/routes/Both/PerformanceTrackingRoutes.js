import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getEmployeePerformanceMetrics,
    getTeamPerformanceMetrics,
    getPerformanceTrends,
    getPerformanceDashboard
} from '../../controllers/performance/performanceTrackingController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PERFORMANCE));

// Employee routes (authenticated)
router.get('/metrics', isAuthenticated, getEmployeePerformanceMetrics);
router.get('/trends', isAuthenticated, getPerformanceTrends);
router.get('/dashboard', isAuthenticated, getPerformanceDashboard);

// Admin routes
router.get('/team', isAdminAuthenticated, getTeamPerformanceMetrics);

export default router;

