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
    deleteHeadcountForecast
} from '../../controllers/workforce/workforceController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Workforce Plans
router.route('/workforce-plans')
    .post(isAdminOrHRAuthenticated, writeLimiter, createWorkforcePlan)
    .get(isAdminOrHRAuthenticated, readLimiter, getWorkforcePlans);

router.route('/workforce-plans/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getWorkforcePlan)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateWorkforcePlan)
    .delete(isAdminOrHRAuthenticated, writeLimiter, deleteWorkforcePlan);

// Headcount Forecasts
router.route('/headcount-forecasts')
    .post(isAdminOrHRAuthenticated, writeLimiter, createHeadcountForecast)
    .get(isAdminOrHRAuthenticated, readLimiter, getHeadcountForecasts);

router.route('/headcount-forecasts/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getHeadcountForecast)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateHeadcountForecast)
    .delete(isAdminOrHRAuthenticated, writeLimiter, deleteHeadcountForecast);

export default router;

