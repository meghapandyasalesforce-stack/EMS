import express from 'express';
import {
    getMyOnboardingWorkflow,
    updateOnboardingTask,
    updateOnboardingChecklistItem,
    acceptOnboardingPolicy,
    getMyOnboardingTasks,
    getOnboardingDashboard,
    signOnboardingPolicy,
    updateOnboardingTraining,
    updateBuddyCheckin,
    updateManagerAction,
    getMyOffboardingWorkflow,
    getOffboardingDashboard,
    getOffboardingWorkflow,
    updateOffboardingTask,
    updateOffboardingChecklistItem,
    updateOffboardingKnowledgeTransfer,
    updateOffboardingExitInterview,
    updateOffboardingAsset,
    updateOffboardingAccessRevocation,
    updateOffboardingPayrollClearance,
} from '../../controllers/onboarding/onboardingController.js';
import {
    getMyOnboardingBgv,
    postMyOnboardingBgv,
    patchMyOnboardingBgvCheck,
} from '../../controllers/lifecycle/lifecycleGapController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { requireLifecycleFeature } from '../../middlewares/requireLifecycleFeature.js';

const router = express.Router();

router.route('/my-workflow')
    .get(isAuthenticatedBoth, readLimiter, getMyOnboardingWorkflow);

router.route('/my-tasks')
    .get(isAuthenticatedBoth, readLimiter, getMyOnboardingTasks);

router.route('/dashboard')
    .get(isAuthenticatedBoth, readLimiter, getOnboardingDashboard);

router.route('/workflow/:workflowId/bgv')
    .get(
        isAuthenticatedBoth,
        readLimiter,
        requireLifecycleFeature('backgroundVerification', 'Background verification'),
        getMyOnboardingBgv,
    )
    .post(
        isAuthenticatedBoth,
        writeLimiter,
        requireLifecycleFeature('backgroundVerification', 'Background verification'),
        postMyOnboardingBgv,
    );

router.route('/workflow/:workflowId/bgv/checks/:checkId')
    .patch(
        isAuthenticatedBoth,
        writeLimiter,
        requireLifecycleFeature('backgroundVerification', 'Background verification'),
        patchMyOnboardingBgvCheck,
    );

router.route('/workflow/:id/tasks/:taskId')
    .put(isAuthenticatedBoth, writeLimiter, updateOnboardingTask);

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

router.route('/offboarding/my-workflow')
    .get(isAuthenticatedBoth, readLimiter, getMyOffboardingWorkflow);

router.route('/offboarding/dashboard')
    .get(isAuthenticatedBoth, readLimiter, getOffboardingDashboard);

router.route('/offboarding/workflow/:id')
    .get(isAuthenticatedBoth, readLimiter, getOffboardingWorkflow);

router.route('/offboarding/workflow/:id/tasks/:taskId')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingTask);

router.route('/offboarding/workflow/:id/checklist/:itemId')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingChecklistItem);

router.route('/offboarding/workflow/:id/knowledge-transfer/:transferId')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingKnowledgeTransfer);

router.route('/offboarding/workflow/:id/exit-interview')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingExitInterview);

router.route('/offboarding/workflow/:id/assets/:assetId')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingAsset);

router.route('/offboarding/workflow/:id/access-revocation/:accessId')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingAccessRevocation);

router.route('/offboarding/workflow/:id/payroll-clearance')
    .put(isAuthenticatedBoth, writeLimiter, updateOffboardingPayrollClearance);

export default router;
