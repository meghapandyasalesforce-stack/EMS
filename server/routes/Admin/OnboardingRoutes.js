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
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Onboarding
router.route('/onboarding')
    .post(isAdminOrHRAuthenticated, writeLimiter, createOnboardingWorkflow)
    .get(isAdminOrHRAuthenticated, readLimiter, getOnboardingWorkflows);

router.route('/onboarding/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getOnboardingWorkflow)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateOnboardingWorkflow);

router.route('/onboarding/:id/tasks/:taskId')
    .put(isAdminOrHRAuthenticated, writeLimiter, updateOnboardingTask);

router.route('/onboarding/analytics')
    .get(isAdminOrHRAuthenticated, readLimiter, getOnboardingAnalytics);

// Offboarding
router.route('/offboarding')
    .post(isAdminOrHRAuthenticated, writeLimiter, createOffboardingWorkflow)
    .get(isAdminOrHRAuthenticated, readLimiter, getOffboardingWorkflows);

router.route('/offboarding/:id/tasks/:taskId')
    .put(isAdminOrHRAuthenticated, writeLimiter, updateOffboardingTask);

export default router;

