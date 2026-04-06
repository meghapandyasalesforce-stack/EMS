import express from 'express';
import {
    createOnboardingWorkflow,
    getOnboardingWorkflows,
    getOnboardingWorkflow,
    updateOnboardingWorkflow,
    updateOnboardingTask,
    createOffboardingWorkflow,
    getOffboardingWorkflows,
    updateOffboardingTask,
    getOnboardingAnalytics
} from '../../controllers/onboarding/onboardingController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Onboarding
router.route('/onboarding')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createOnboardingWorkflow)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingWorkflows);

router.route('/onboarding/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingWorkflow)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingWorkflow);

router.route('/onboarding/:id/tasks/:taskId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingTask);

router.route('/onboarding/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingAnalytics);

// Offboarding
router.route('/offboarding')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createOffboardingWorkflow)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingWorkflows);

router.route('/offboarding/:id/tasks/:taskId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingTask);

export default router;

