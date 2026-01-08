import express from 'express';
import {
    getMyOnboardingWorkflow,
    updateOnboardingTask
} from '../../controllers/onboarding/onboardingController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Get employee's own onboarding workflow
router.route('/my-workflow')
    .get(isAuthenticatedBoth, readLimiter, getMyOnboardingWorkflow);

// Update task status (employee can update their own tasks)
router.route('/workflow/:id/tasks/:taskId')
    .put(isAuthenticatedBoth, writeLimiter, updateOnboardingTask);

export default router;

