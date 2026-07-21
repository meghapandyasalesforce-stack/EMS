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
    getOnboardingAnalytics,
    getOnboardingTemplates,
    createOnboardingTemplate,
    updateOnboardingTemplate,
    uploadOnboardingDocument,
    verifyOnboardingDocument,
    updateOnboardingChecklistItem,
    addOnboardingNote,
    getOnboardingDashboard,
    updateWorkflowStatus,
    updateOnboardingAsset,
    updateOnboardingTraining,
    signOnboardingPolicy,
    updateBuddyCheckin,
    updateManagerAction,
} from '../../controllers/onboarding/onboardingController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Analytics BEFORE :id routes to avoid "analytics" being captured as id
router.route('/onboarding/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingAnalytics);

router.route('/onboarding/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingDashboard);

router.route('/onboarding/templates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingTemplates)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createOnboardingTemplate);

router.route('/onboarding/templates/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingTemplate);

router.route('/onboarding')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createOnboardingWorkflow)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingWorkflows);

router.route('/onboarding/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingWorkflow)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingWorkflow);

router.route('/onboarding/:id/tasks/:taskId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingTask);

router.route('/onboarding/:id/documents')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, uploadOnboardingDocument);

router.route('/onboarding/:id/documents/:docId/verify')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, verifyOnboardingDocument);

router.route('/onboarding/:id/checklist/:itemId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingChecklistItem);

router.route('/onboarding/:id/notes')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, addOnboardingNote);

router.route('/onboarding/:id/status')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateWorkflowStatus);

router.route('/onboarding/:id/assets/:assetId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingAsset);

router.route('/onboarding/:id/training/:trainingId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingTraining);

router.route('/onboarding/:id/signatures/:signatureId/sign')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, signOnboardingPolicy);

router.route('/onboarding/:id/buddy-checkins/:checkinId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateBuddyCheckin);

router.route('/onboarding/:id/manager-actions/:actionId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateManagerAction);

// Offboarding
router.route('/offboarding')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createOffboardingWorkflow)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingWorkflows);

router.route('/offboarding/:id/tasks/:taskId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingTask);

export default router;
