import express from 'express';
import {
    createWorkforcePlan,
    getWorkforcePlans,
    getWorkforcePlan,
    updateWorkforcePlan,
    deleteWorkforcePlan,
    createHeadcountForecast,
    getHeadcountForecasts,
    getHeadcountForecast,
    updateHeadcountForecast,
    deleteHeadcountForecast,
    getWorkforceAnalytics
} from '../../controllers/workforce/workforceController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.WORKFORCE_PLANNING));

// Workforce Plans
router.route('/workforce-plans')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createWorkforcePlan)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforcePlans);

router.route('/workforce-plans/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforcePlan)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateWorkforcePlan)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteWorkforcePlan);

// Headcount Forecasts
router.route('/headcount-forecasts')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createHeadcountForecast)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHeadcountForecasts);

router.route('/headcount-forecasts/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHeadcountForecast)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateHeadcountForecast)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteHeadcountForecast);

// Analytics
router.route('/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforceAnalytics);

export default router;

