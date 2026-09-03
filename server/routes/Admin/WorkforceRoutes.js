import express from 'express';
import {
    createWorkforcePlan,
    getWorkforcePlans,
    getWorkforcePlan,
    updateWorkforcePlan,
    deleteWorkforcePlan,
    submitWorkforcePlan,
    approveWorkforcePlan,
    rejectWorkforcePlan,
    startWorkforcePlan,
    completeWorkforcePlan,
    createHeadcountForecast,
    getHeadcountForecasts,
    getHeadcountForecast,
    updateHeadcountForecast,
    deleteHeadcountForecast,
    getWorkforceAnalytics,
    getLiveHeadcountEndpoint,
    getWorkforceDashboard,
    getGapAnalysis,
    createRecruitmentFromHiring,
    updateHiringFill,
    getWorkforceReports
} from '../../controllers/workforce/workforceController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Live headcount + dashboard + gap + reports
router.route('/live-headcount')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLiveHeadcountEndpoint);

router.route('/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforceDashboard);

router.route('/gap-analysis')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getGapAnalysis);

router.route('/reports')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforceReports);

// Workforce Plans
router.route('/workforce-plans')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createWorkforcePlan)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforcePlans);

router.route('/workforce-plans/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getWorkforcePlan)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateWorkforcePlan)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteWorkforcePlan);

// Approval / status workflow
router.route('/workforce-plans/:id/submit')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, submitWorkforcePlan);

router.route('/workforce-plans/:id/approve')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, approveWorkforcePlan);

router.route('/workforce-plans/:id/reject')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, rejectWorkforcePlan);

router.route('/workforce-plans/:id/start')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, startWorkforcePlan);

router.route('/workforce-plans/:id/complete')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, completeWorkforcePlan);

// Recruitment handoff + fill tracking on hiring lines
router.route('/workforce-plans/:id/hiring/:hiringIndex/create-job')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createRecruitmentFromHiring);

router.route('/workforce-plans/:id/hiring/:hiringIndex/fill')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateHiringFill);

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
