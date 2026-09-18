import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createOnboardingWorkflow,
    getOnboardingWorkflows,
    getOnboardingWorkflow,
    deleteOnboardingWorkflow,
    updateOnboardingWorkflow,
    updateOnboardingTask,
    createOffboardingWorkflow,
    getOffboardingWorkflows,
    getOffboardingWorkflow,
    updateOffboardingWorkflow,
    deleteOffboardingWorkflow,
    updateOffboardingTask,
    updateOffboardingChecklistItem,
    updateOffboardingAsset,
    updateOffboardingKnowledgeTransfer,
    updateOffboardingExitInterview,
    updateOffboardingPayrollClearance,
    updateOffboardingAccessRevocation,
    addOffboardingNote,
    getOffboardingDashboard,
    getOffboardingAnalytics,
    performOffboardingAction,
    getOnboardingAnalytics,
    getOnboardingTemplates,
    createOnboardingTemplate,
    updateOnboardingTemplate,
    updateOnboardingChecklistItem,
    addOnboardingNote,
    getOnboardingDashboard,
    updateWorkflowStatus,
    performWorkflowAction,
    updateOnboardingAsset,
    updateOnboardingTraining,
    signOnboardingPolicy,
    updateBuddyCheckin,
    updateManagerAction,
} from '../../controllers/onboarding/onboardingController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { upload } from '../../controllers/fileUpload/uploadConfigController.js';
import { uploadOffboardingExperienceLetter } from '../../controllers/document/documentController.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LIFECYCLE));

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
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingWorkflow)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteOnboardingWorkflow);

router.route('/onboarding/:id/tasks/:taskId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingTask);

router.route('/onboarding/:id/checklist/:itemId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingChecklistItem);

router.route('/onboarding/:id/notes')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, addOnboardingNote);

router.route('/onboarding/:id/status')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateWorkflowStatus);

router.route('/onboarding/:id/actions/:action')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, performWorkflowAction);

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

// Offboarding analytics/dashboard must be declared before the :id route.
router.route('/offboarding/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingAnalytics);

router.route('/offboarding/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingDashboard);

router.route('/offboarding')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createOffboardingWorkflow)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingWorkflows);

router.route('/offboarding/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingWorkflow)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingWorkflow)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteOffboardingWorkflow);

router.route('/offboarding/:id/actions/:action')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, performOffboardingAction);

router.route('/offboarding/:id/tasks/:taskId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingTask);

router.route('/offboarding/:id/checklist/:itemId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingChecklistItem);

router.route('/offboarding/:id/assets/:assetId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingAsset);

router.route('/offboarding/:id/knowledge-transfer/:transferId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingKnowledgeTransfer);

router.route('/offboarding/:id/exit-interview')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingExitInterview);

router.route('/offboarding/:id/payroll-clearance')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingPayrollClearance);

router.route('/offboarding/:id/access-revocation/:accessId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingAccessRevocation);

router.route('/offboarding/:id/notes')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, addOffboardingNote);

router.route('/offboarding/:id/experience-letter')
    .post(
        isAdminOrHROrExecutiveAuthenticated,
        (req, res, next) => {
            upload(req, res, (err) => {
                if (err) return res.status(400).json({ success: false, message: err.message });
                next();
            });
        },
        writeLimiter,
        uploadOffboardingExperienceLetter,
    );

export default router;
