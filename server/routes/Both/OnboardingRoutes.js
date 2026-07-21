import express from 'express';
import {
    getMyOnboardingWorkflow,
    updateOnboardingTask,
    uploadOnboardingDocument,
    updateOnboardingChecklistItem,
    acceptOnboardingPolicy,
    getMyOnboardingTasks,
    getOnboardingDashboard,
    signOnboardingPolicy,
    updateOnboardingTraining,
    updateBuddyCheckin,
    updateManagerAction,
} from '../../controllers/onboarding/onboardingController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/my-workflow')
    .get(isAuthenticatedBoth, readLimiter, getMyOnboardingWorkflow);

router.route('/my-tasks')
    .get(isAuthenticatedBoth, readLimiter, getMyOnboardingTasks);

router.route('/dashboard')
    .get(isAuthenticatedBoth, readLimiter, getOnboardingDashboard);

router.route('/workflow/:id/tasks/:taskId')
    .put(isAuthenticatedBoth, writeLimiter, updateOnboardingTask);

router.route('/workflow/:id/documents')
    .post(isAuthenticatedBoth, writeLimiter, uploadOnboardingDocument);

router.route('/workflow/:id/checklist/:itemId')
    .put(isAuthenticatedBoth, writeLimiter, updateOnboardingChecklistItem);

router.route('/workflow/:id/accept-policy')
    .post(isAuthenticatedBoth, writeLimiter, acceptOnboardingPolicy);

router.route('/workflow/:id/signatures/:signatureId/sign')
    .post(isAuthenticatedBoth, writeLimiter, signOnboardingPolicy);

router.route('/workflow/:id/training/:trainingId')
    .put(isAuthenticatedBoth, writeLimiter, updateOnboardingTraining);

router.route('/workflow/:id/buddy-checkins/:checkinId')
    .put(isAuthenticatedBoth, writeLimiter, updateBuddyCheckin);

router.route('/workflow/:id/manager-actions/:actionId')
    .put(isAuthenticatedBoth, writeLimiter, updateManagerAction);

export default router;
