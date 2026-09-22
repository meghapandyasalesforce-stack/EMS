import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import {
    getEmployeeOnboardingHandler,
    getEmployeeOffboardingHandler,
    getEmployeeDashboardHandler,
    getEmployeeTasksHandler,
    completeEmployeeTaskHandler,
    getEmployeeBuddyAssignmentsHandler,
    getEmployeePendingFormsHandler,
    getEmployeeCompletedFormsHandler,
    getEmployeeSummaryHandler,
    updateEmployeeOnboardingTaskHandler,
    updateEmployeeOnboardingChecklistHandler,
    updateEmployeeOnboardingAssetHandler,
    updateEmployeeOnboardingTrainingHandler,
    signEmployeePolicyHandler,
    updateEmployeeBuddyCheckinHandler,
    addEmployeeNoteHandler,
    updateEmployeeOffboardingTaskHandler,
    updateEmployeeOffboardingChecklistHandler,
    updateEmployeeOffboardingAssetHandler,
    updateEmployeeKnowledgeTransferHandler,
    updateEmployeeExitInterviewHandler,
    updateEmployeeAccessRevocationHandler,
} from '../../controllers/lifecycle/lifecycleEmployeeController.js';
import {
    getEmployeeBgvCaseHandler,
    uploadBgvDocumentHandler,
    submitCheckForReviewHandler,
    respondToInfoRequestHandler,
    deleteBgvDocumentHandler,
    replaceBgvDocumentHandler,
    addReferenceHandler,
    updateReferenceHandler,
    deleteReferenceHandler,
    acceptCriminalDeclarationHandler,
    getMyOnboardingBgv,
    postMyOnboardingBgv,
    patchMyOnboardingBgvCheck,
    saveEmploymentDraftHandler,
    saveEducationDraftHandler,
    saveAddressDraftHandler,
    getEmployeeBgvDashboardHandler,
} from '../../controllers/lifecycle/lifecycleGapController.js';
import { requireLifecycleFeature, requireLifecycleModule } from '../../middlewares/requireLifecycleFeature.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LIFECYCLE));

router.route('/employee/onboarding')
    .get(isAuthenticated, readLimiter, requireLifecycleModule('onboarding', 'Onboarding'), getEmployeeOnboardingHandler);

router.route('/employee/offboarding')
    .get(isAuthenticated, readLimiter, requireLifecycleModule('offboarding', 'Offboarding'), getEmployeeOffboardingHandler);

router.route('/employee/dashboard')
    .get(isAuthenticated, readLimiter, getEmployeeDashboardHandler);

router.route('/employee/tasks')
    .get(isAuthenticated, readLimiter, getEmployeeTasksHandler);

router.route('/employee/workflows/:workflowId/tasks/:taskId/complete')
    .post(isAuthenticated, writeLimiter, completeEmployeeTaskHandler);

router.route('/employee/buddy-assignments')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), getEmployeeBuddyAssignmentsHandler);

router.route('/employee/forms/pending')
    .get(isAuthenticated, readLimiter, getEmployeePendingFormsHandler);

router.route('/employee/forms/completed')
    .get(isAuthenticated, readLimiter, getEmployeeCompletedFormsHandler);

router.route('/employee/summary')
    .get(isAuthenticated, readLimiter, getEmployeeSummaryHandler);

// Enhanced Onboarding Endpoints
router.route('/employee/onboarding/:workflowId/tasks/:taskId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), updateEmployeeOnboardingTaskHandler);

router.route('/employee/onboarding/:workflowId/checklist/:itemId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), updateEmployeeOnboardingChecklistHandler);

router.route('/employee/onboarding/:workflowId/assets/:assetId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), updateEmployeeOnboardingAssetHandler);

router.route('/employee/onboarding/:workflowId/training/:trainingId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), updateEmployeeOnboardingTrainingHandler);

router.route('/employee/onboarding/:workflowId/signatures/:signatureId/sign')
    .post(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), signEmployeePolicyHandler);

router.route('/employee/onboarding/:workflowId/buddy-checkins/:checkinId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), updateEmployeeBuddyCheckinHandler);

router.route('/employee/onboarding/:workflowId/notes')
    .post(isAuthenticated, writeLimiter, requireLifecycleModule('onboarding', 'Onboarding'), addEmployeeNoteHandler);

// Enhanced Offboarding Endpoints
router.route('/employee/offboarding/:workflowId/tasks/:taskId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), updateEmployeeOffboardingTaskHandler);

router.route('/employee/offboarding/:workflowId/checklist/:itemId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), updateEmployeeOffboardingChecklistHandler);

router.route('/employee/offboarding/:workflowId/assets/:assetId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), updateEmployeeOffboardingAssetHandler);

router.route('/employee/offboarding/:workflowId/knowledge-transfer/:transferId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), updateEmployeeKnowledgeTransferHandler);

router.route('/employee/offboarding/:workflowId/exit-interview')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), updateEmployeeExitInterviewHandler);

router.route('/employee/offboarding/:workflowId/access-revocation/:accessId')
    .put(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), updateEmployeeAccessRevocationHandler);

router.route('/employee/offboarding/:workflowId/notes')
    .post(isAuthenticated, writeLimiter, requireLifecycleModule('offboarding', 'Offboarding'), addEmployeeNoteHandler);

// Real-time BGV Employee actions
router.route('/employee/bgv')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), getEmployeeBgvCaseHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/upload')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), uploadBgvDocumentHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/documents/:documentId')
    .delete(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), deleteBgvDocumentHandler)
    .put(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), replaceBgvDocumentHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/submit')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), submitCheckForReviewHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/references')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), addReferenceHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/references/:referenceId')
    .put(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), updateReferenceHandler)
    .delete(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), deleteReferenceHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/declaration')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), acceptCriminalDeclarationHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/respond')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), respondToInfoRequestHandler);

// Employee BGV Draft save endpoints
router.route('/employee/bgv/:bgvCaseId/checks/:checkId/draft/employment')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), saveEmploymentDraftHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/draft/education')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), saveEducationDraftHandler);

router.route('/employee/bgv/:bgvCaseId/checks/:checkId/draft/address')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), saveAddressDraftHandler);

// Employee BGV Dashboard
router.route('/employee/bgv/dashboard')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getEmployeeBgvDashboardHandler);

// Employee BGV workflow integration with onboarding
router.route('/employee/onboarding/:workflowId/bgv')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getMyOnboardingBgv)
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postMyOnboardingBgv);

router.route('/employee/onboarding/:workflowId/bgv/checks/:checkId')
    .patch(isAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), patchMyOnboardingBgvCheck);

export default router;
