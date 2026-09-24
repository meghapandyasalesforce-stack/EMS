import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getLifecycleRegistry,
    getLifecycleSettings,
    patchLifecycleSettings,
    postInstallIndustryPack,
    postInstallCompliancePack,
    postUninstallIndustryPack,
    postUninstallCompliancePack,
    getOnboardingTemplatesGated,
    getOffboardingTemplatesGated,
    createOffboardingTemplate,
    updateOffboardingTemplate,
    updateOnboardingTemplateStagesHandler,
    updateOffboardingTemplateStagesHandler,
    getLifecycleTemplateById,
    createLifecycleTemplateHandler,
    updateLifecycleTemplateWorkflowHandler,
    cloneLifecycleTemplateHandler,
    publishLifecycleTemplateHandler,
    previewLifecycleTemplateHandler,
    getDocumentCatalog,
    seedLifecycleDefaults,
    getFeatureRegistryOnly,
} from '../../controllers/lifecycle/lifecycleConfigController.js';
import {
    getFormDefinitions,
    saveFormDefinition,
    deleteFormDefinition,
    getFormFieldTypes,
    listLifecycleForms,
    getLifecycleForm,
    createLifecycleForm,
    updateLifecycleForm,
    cloneLifecycleForm,
    publishLifecycleForm,
    archiveLifecycleForm,
    rollbackLifecycleForm,
    previewLifecycleForm,
    assignLifecycleForm,
    getLifecycleFormResponses,
    exportLifecycleFormResponses,
    submitLifecycleFormResponse,
    saveLifecycleFormDraft,
    reviewFormResponseHandler,
    addFormAttachmentHandler,
    removeFormAttachmentHandler,
    getFormResponseWithHistoryHandler,
    rollbackFormResponseHandler,
} from '../../controllers/lifecycle/lifecycleFormController.js';
import {
    getDocumentHubCategories,
    listDocumentHubLibrary,
    getDocumentHubPending,
    getDocumentHubExpiryDashboard,
    getDocumentHubCatalog,
    postDocumentHubCatalogEntry,
    assignDocumentHubWorkflow,
    verifyDocumentHub,
    bulkVerifyDocumentHub,
    bulkReminderDocumentHub,
    restoreDocumentHubVersion,
    getDocumentHubReports,
    exportDocumentHubLibrary,
    processDocumentOCRHandler,
    createDocumentVersionHandler,
    getDocumentPreviewHandler,
    initiateDocumentRenewalHandler,
    completeDocumentRenewalHandler,
    getDocumentVersionHistoryHandler,
    bulkDocumentOperationHandler,
} from '../../controllers/lifecycle/lifecycleDocumentHubController.js';
import {
    getExitInterviewTypes,
    getExitInterviewSettingsHandler,
    patchExitInterviewSettingsHandler,
    listExitInterviewTemplatesHandler,
    getExitInterviewTemplateHandler,
    createExitInterviewTemplateHandler,
    updateExitInterviewTemplateHandler,
    publishExitInterviewTemplateHandler,
    listExitInterviewSessionsHandler,
    getExitInterviewSessionHandler,
    scheduleExitInterviewSessionHandler,
    rescheduleExitInterviewSessionHandler,
    cancelExitInterviewSessionHandler,
    saveExitInterviewDraftHandler,
    submitExitInterviewSessionHandler,
    closeExitInterviewSessionHandler,
    addExitInterviewActionItemHandler,
    updateExitInterviewActionItemHandler,
    getExitInterviewAnalyticsHandler,
    exportExitInterviewAnalyticsHandler,
    provisionExitInterviewSessionsHandler,
} from '../../controllers/lifecycle/lifecycleExitInterviewController.js';
import {
    getLetterTypes,
    listLetterTemplatesHandler,
    getLetterTemplateHandler,
    createLetterTemplateHandler,
    updateLetterTemplateHandler,
    cloneLetterTemplateHandler,
    publishLetterTemplateHandler,
    archiveLetterTemplateHandler,
    previewLetterTemplateHandler,
    generateLetterHandler,
    bulkGenerateLettersHandler,
    sendLetterHandler,
    resendLetterHandler,
    listGeneratedLettersHandler,
    exportLettersHandler,
} from '../../controllers/lifecycle/lifecycleLetterController.js';
import {
    getOfferTemplates,
    saveOfferTemplate,
    postOfferLetter,
    postOfferPreview,
    postOfferTemplatePreview,
    getOffersForCandidate,
    deleteOfferLetterHandler,
    postOfferSubmitApproval,
    postOfferSend,
    postOfferRevise,
    getBgvCases,
    postBgvCase,
    patchBgvCheck,
    postBgvSync,
    postBgvTimeline,
    postBgvApproval,
    postBgvManualVerification,
    getBgvCaseAnalytics,
    postBgvBulkSync,
    postBgvWaive,
    getBgvStatisticsHandler,
    getNoticePeriodDashboard,
    postNoticeBuyout,
    patchNoticeLeaveAdjustment,
    getFnfDashboard,
    postFnfCalculate,
    postFnfSubmitApproval,
    postFnfGeneratePdf,
} from '../../controllers/lifecycle/lifecycleGapController.js';
import {
    getPdfTemplateFields,
    postPdfTemplateUpload,
    getPdfTemplateExtract,
    postPdfTemplateDetect,
    putPdfTemplateMappings,
    postPdfOfferPreview,
} from '../../controllers/lifecycle/offerPdfTemplateController.js';
import { offerPdfTemplateUpload } from '../../middlewares/offerPdfTemplateUpload.js';
import {
    getReportsCatalogHandler,
    getLifecycleDashboardHandler,
    getLifecycleDrilldownHandler,
    exportLifecycleReportHandler,
    listScheduledReportsHandler,
    createScheduledReportHandler,
    updateScheduledReportHandler,
    deleteScheduledReportHandler,
} from '../../controllers/lifecycle/lifecycleReportsController.js';
import {
    verifyCheckHandler,
    requestAdditionalInfoHandler,
    updateDocumentOcrStatusHandler,
    updateDocumentMatchStatusHandler,
    getHrBgvDashboardHandler,
    getHrBgvCaseDetailHandler,
    addHrRemarksHandler,
    addInternalNoteHandler,
    updateVerificationDetailsHandler,
    updateReferenceContactStatusHandler,
    uploadVendorReportHandler,
    generateBgvReportHandler,
    saveEmploymentDraftHandler,
    saveEducationDraftHandler,
    saveAddressDraftHandler,
} from '../../controllers/lifecycle/lifecycleGapController.js';
import {
    getHRDashboardHandler,
    bulkUpdateStatusHandler,
    bulkAssignManagerHandler,
    bulkAssignBuddyHandler,
    getHRPendingApprovalsHandler,
    getHRReportsHandler,
    exportHRReportHandler,
    getAllWorkflowsHandler,
} from '../../controllers/lifecycle/lifecycleHRController.js';
import {
    getOnboardingStages,
    getOffboardingStages,
    updateOnboardingStageState,
    updateOffboardingStageState,
    autoProgressOnboardingStages,
    autoProgressOffboardingStages,
    progressOnboardingToNextStage,
    progressOffboardingToNextStage,
    unblockOnboardingStage,
    unblockOffboardingStage,
    skipOnboardingStage,
    skipOffboardingStage,
    getOnboardingStageProgress,
    getOffboardingStageProgress,
    validateOnboardingStages,
    validateOffboardingStages,
    canProgressOnboarding,
    canProgressOffboarding,
} from '../../controllers/lifecycle/lifecycleWorkflowRuntimeController.js';
import {
    postEnterpriseBootstrap,
    postAutoConfigurePacks,
    getAdapterCatalog,
    postMilestoneReview,
    postProbationExtend,
    postProbationReview,
    getAlumniList,
    postAlumniBlacklist,
    postAlumniRehire,
    postAutoRevokeAccess,
    postSyncLmsTraining,
    getMilestoneDashboard,
    getProbationDashboard,
    getFormGateStatus,
    getOnboardingGoalsHandler,
    postAssignOnboardingGoals,
    postFnfPayrollBridge,
    getOffboardingGeneratedLetters,
    refreshOnboardingProgress,
} from '../../controllers/lifecycle/lifecycleEnterpriseController.js';
import {
    getStatutoryDocTypes,
    postGenerateStatutoryDoc,
    getEmployeeStatutoryDocs,
    getItInventoryDashboard,
    getItTicketingProviders,
    getAccessProvisioningCatalogHandler,
    postSoftwareRequest,
    postApproveSoftwareRequest,
    postMarkSoftwareProvisioned,
    postDeviceReplacement,
    getStatutoryModules,
    getStatutoryPreview,
    getStatutoryDashboard,
    getStatutoryHistory,
    postBulkGenerateStatutory,
    getLmsDashboard,
    getManagerTrainingDashboard,
    postAssignCourse,
    postLmsSyncCertify,
    getTrainingHistoryHandler,
    getLmsProviders,
    getProbationCenter,
    getDashboardTypes,
    getEnterpriseDashboard,
    getSearchCategories,
    getGlobalSearch,
    postSavedSearch,
    getSavedSearches,
    getNotificationCenter,
    patchNotificationCenter,
    getNotificationMeta,
    getBulkOperations,
    postBulkOperation,
    getLifecycleBranding,
    patchLifecycleBranding,
} from '../../controllers/lifecycle/lifecyclePhaseFController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { isAdminOnly } from '../../middlewares/createAuthMiddleware.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { requireLifecycleFeature } from '../../middlewares/requireLifecycleFeature.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LIFECYCLE));

router.route('/registry')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLifecycleRegistry);

router.route('/registry/features')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getFeatureRegistryOnly);

router.route('/settings')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLifecycleSettings)
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, patchLifecycleSettings);

router.route('/settings/seed')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, seedLifecycleDefaults);

router.route('/enterprise/bootstrap')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postEnterpriseBootstrap);

router.route('/packs/auto-configure')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postAutoConfigurePacks);

router.route('/adapters')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getAdapterCatalog);

router.route('/milestones/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getMilestoneDashboard);

router.route('/onboarding/:workflowId/milestones/review')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postMilestoneReview);

router.route('/probation/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getProbationDashboard);

router.route('/onboarding/:workflowId/probation/extend')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postProbationExtend);

router.route('/onboarding/:workflowId/probation/review')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postProbationReview);

router.route('/alumni')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['alumniManagement', 'rehireEligibility'], 'Alumni', true), getAlumniList);

router.route('/alumni/:alumniId/blacklist')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('blacklisting', 'Blacklisting'), postAlumniBlacklist);

router.route('/alumni/:alumniId/rehire')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('rehireEligibility', 'Rehire'), postAlumniRehire);

router.route('/offboarding/:workflowId/access/auto-revoke')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature(['accessRevocation', 'emailAccessRemoval'], 'Access revocation'), postAutoRevokeAccess);

router.route('/onboarding/:workflowId/lms/sync')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature(['trainingLms', 'mandatoryTraining', 'lmsDashboard'], 'LMS'), postSyncLmsTraining);

router.route('/onboarding/:workflowId/forms/status')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), getFormGateStatus);

router.route('/onboarding/:workflowId/goals')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('goalAssignment', 'Goals', true), getOnboardingGoalsHandler)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('goalAssignment', 'Goals'), postAssignOnboardingGoals);

router.route('/onboarding/:workflowId/progress/refresh')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, refreshOnboardingProgress);

router.route('/offboarding/:workflowId/fnf/payroll-bridge')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postFnfPayrollBridge);

router.route('/offboarding/:workflowId/letters/generated')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingGeneratedLetters);

router.route('/packs/industry/install')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postInstallIndustryPack);

router.route('/packs/industry/uninstall')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postUninstallIndustryPack);

router.route('/packs/compliance/install')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postInstallCompliancePack);

router.route('/packs/compliance/uninstall')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postUninstallCompliancePack);

router.route('/templates/onboarding')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingTemplatesGated)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'onboarding';
        return createLifecycleTemplateHandler(req, res);
    });

router.route('/templates/onboarding/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, (req, res) => {
        req.params.module = 'onboarding';
        return getLifecycleTemplateById(req, res);
    })
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'onboarding';
        return updateLifecycleTemplateWorkflowHandler(req, res);
    });

router.route('/templates/onboarding/:id/stages')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingTemplateStagesHandler);

router.route('/templates/onboarding/:id/clone')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'onboarding';
        return cloneLifecycleTemplateHandler(req, res);
    });

router.route('/templates/onboarding/:id/publish')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'onboarding';
        return publishLifecycleTemplateHandler(req, res);
    });

router.route('/templates/onboarding/:id/preview')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, (req, res) => {
        req.params.module = 'onboarding';
        return previewLifecycleTemplateHandler(req, res);
    });

router.route('/templates/offboarding')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingTemplatesGated)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'offboarding';
        return createLifecycleTemplateHandler(req, res);
    });

router.route('/templates/offboarding/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, (req, res) => {
        req.params.module = 'offboarding';
        return getLifecycleTemplateById(req, res);
    })
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingTemplate);

router.route('/templates/offboarding/:id/workflow')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'offboarding';
        return updateLifecycleTemplateWorkflowHandler(req, res);
    });

router.route('/templates/offboarding/:id/stages')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingTemplateStagesHandler);

router.route('/templates/offboarding/:id/clone')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'offboarding';
        return cloneLifecycleTemplateHandler(req, res);
    });

router.route('/templates/offboarding/:id/publish')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, (req, res) => {
        req.params.module = 'offboarding';
        return publishLifecycleTemplateHandler(req, res);
    });

router.route('/templates/offboarding/:id/preview')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, (req, res) => {
        req.params.module = 'offboarding';
        return previewLifecycleTemplateHandler(req, res);
    });

router.route('/document-catalog')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getDocumentCatalog);

router.route('/forms/field-types')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), getFormFieldTypes);

router.route('/forms')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), listLifecycleForms)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), createLifecycleForm);

router.route('/forms/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), getLifecycleForm)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), updateLifecycleForm)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), archiveLifecycleForm);

router.route('/forms/:id/clone')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), cloneLifecycleForm);

router.route('/forms/:id/publish')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), publishLifecycleForm);

router.route('/forms/:id/rollback')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), rollbackLifecycleForm);

router.route('/forms/:id/preview')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), previewLifecycleForm);

router.route('/forms/:id/assign')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), assignLifecycleForm);

router.route('/forms/:id/responses')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), getLifecycleFormResponses);

router.route('/forms/:id/responses/export')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), exportLifecycleFormResponses);

router.route('/forms/:id/submit')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), submitLifecycleFormResponse);

router.route('/forms/:id/draft')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), saveLifecycleFormDraft);

// Enhanced form response handlers
router.route('/forms/responses/:responseId/review')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), reviewFormResponseHandler);

router.route('/forms/responses/:responseId/attachments')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), addFormAttachmentHandler);

router.route('/forms/responses/:responseId/attachments/:attachmentIndex')
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), removeFormAttachmentHandler);

router.route('/forms/responses/:responseId/history')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('digitalForms', 'Digital forms', true), getFormResponseWithHistoryHandler);

router.route('/forms/responses/:responseId/rollback/:version')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('digitalForms', 'Digital forms'), rollbackFormResponseHandler);

/** @deprecated use explicit form routes above — kept for backward compatibility */
router.route('/forms-legacy')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getFormDefinitions)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, saveFormDefinition);

// Phase 2.3 — Document Hub
router.route('/document-hub/categories')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentHubCategories);

router.route('/document-hub/library')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), listDocumentHubLibrary);

router.route('/document-hub/library/export')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), exportDocumentHubLibrary);

router.route('/document-hub/pending')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentHubPending);

router.route('/document-hub/expiry')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentHubExpiryDashboard);

router.route('/document-hub/catalog')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentHubCatalog)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub'), postDocumentHubCatalogEntry);

router.route('/document-hub/reports')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentHubReports);

router.route('/document-hub/bulk/verify')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentApproval', 'Document approval'), bulkVerifyDocumentHub);

router.route('/document-hub/bulk/remind')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), bulkReminderDocumentHub);

router.route('/document-hub/:id/assign')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), assignDocumentHubWorkflow);

router.route('/document-hub/:id/verify')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentApproval', 'Document approval'), verifyDocumentHub);

router.route('/document-hub/:id/restore-version')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), restoreDocumentHubVersion);

// Enhanced Document Hub endpoints
router.route('/document-hub/:id/ocr')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), processDocumentOCRHandler);

router.route('/document-hub/:id/version')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), createDocumentVersionHandler);

router.route('/document-hub/:id/preview')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentPreviewHandler);

router.route('/document-hub/:id/renewal')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), initiateDocumentRenewalHandler);

router.route('/document-hub/:id/renewal/complete')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('documentCollection', 'Document collection'), completeDocumentRenewalHandler);

router.route('/document-hub/:id/versions')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub', true), getDocumentVersionHistoryHandler);

router.route('/document-hub/bulk/operation')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature(['documentCollection', 'documentApproval'], 'Document hub'), bulkDocumentOperationHandler);

// Phase 2.4 — Exit Interview & Exit Management
router.route('/exit-interviews/types')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('exitInterview', 'Exit interview', true), getExitInterviewTypes);

router.route('/exit-interviews/settings')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('exitInterview', 'Exit interview', true), getExitInterviewSettingsHandler)
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('exitInterview', 'Exit interview'), patchExitInterviewSettingsHandler);

router.route('/exit-interviews/templates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('exitInterview', 'Exit interview', true), listExitInterviewTemplatesHandler)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('exitInterview', 'Exit interview'), createExitInterviewTemplateHandler);

router.route('/exit-interviews/templates/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getExitInterviewTemplateHandler)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateExitInterviewTemplateHandler);

router.route('/exit-interviews/templates/:id/publish')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, publishExitInterviewTemplateHandler);

router.route('/exit-interviews/sessions')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listExitInterviewSessionsHandler);

router.route('/exit-interviews/sessions/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getExitInterviewSessionHandler);

router.route('/exit-interviews/sessions/:id/schedule')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, scheduleExitInterviewSessionHandler);

router.route('/exit-interviews/sessions/:id/reschedule')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, rescheduleExitInterviewSessionHandler);

router.route('/exit-interviews/sessions/:id/cancel')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, cancelExitInterviewSessionHandler);

router.route('/exit-interviews/sessions/:id/submit')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, submitExitInterviewSessionHandler);

router.route('/exit-interviews/sessions/:id/draft')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, saveExitInterviewDraftHandler);

router.route('/exit-interviews/sessions/:id/close')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, closeExitInterviewSessionHandler);

router.route('/exit-interviews/sessions/:id/action-items')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, addExitInterviewActionItemHandler);

router.route('/exit-interviews/sessions/:id/action-items/:itemId')
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateExitInterviewActionItemHandler);

router.route('/exit-interviews/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getExitInterviewAnalyticsHandler);

router.route('/exit-interviews/analytics/export')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, exportExitInterviewAnalyticsHandler);

router.route('/exit-interviews/provision/:workflowId')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, provisionExitInterviewSessionsHandler);

// Phase 2.5 — Letter Generator
router.route('/letters/types')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLetterTypes);

router.route('/letters/templates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listLetterTemplatesHandler)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createLetterTemplateHandler);

router.route('/letters/templates/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLetterTemplateHandler)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateLetterTemplateHandler)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, archiveLetterTemplateHandler);

router.route('/letters/templates/:id/clone')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, cloneLetterTemplateHandler);

router.route('/letters/templates/:id/publish')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, publishLetterTemplateHandler);

router.route('/letters/templates/:id/preview')
    .post(isAdminOrHROrExecutiveAuthenticated, readLimiter, previewLetterTemplateHandler);

router.route('/letters/generate')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, generateLetterHandler);

router.route('/letters/bulk-generate')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, bulkGenerateLettersHandler);

router.route('/letters/generated')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listGeneratedLettersHandler);

router.route('/letters/generated/export')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, exportLettersHandler);

router.route('/letters/generated/:id/send')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, sendLetterHandler);

router.route('/letters/generated/:id/resend')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, resendLetterHandler);

// Phase 1 — Offer letters
router.route('/offers/templates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOfferTemplates)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, saveOfferTemplate);

router.route('/offers/templates/preview')
    .post(isAdminOrHROrExecutiveAuthenticated, readLimiter, postOfferTemplatePreview);

router.route('/offers/templates/pdf/fields')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getPdfTemplateFields);

router.route('/offers/templates/pdf/upload')
    .post(
        isAdminOrHROrExecutiveAuthenticated,
        writeLimiter,
        (req, _res, next) => { req.organizationId = req.organizationId || req.employee?.organizationId || req.user?.organizationId; next(); },
        offerPdfTemplateUpload.single('pdf'),
        postPdfTemplateUpload,
    );

router.route('/offers/templates/:id/pdf/extract')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getPdfTemplateExtract);

router.route('/offers/templates/:id/pdf/detect')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postPdfTemplateDetect);

router.route('/offers/templates/:id/pdf/mappings')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, putPdfTemplateMappings);

router.route('/offers/preview/pdf')
    .post(isAdminOrHROrExecutiveAuthenticated, readLimiter, postPdfOfferPreview);

router.route('/offers/preview')
    .post(isAdminOrHROrExecutiveAuthenticated, readLimiter, postOfferPreview);

router.route('/offers')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postOfferLetter);

router.route('/offers/candidate/:candidateId')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffersForCandidate);

router.route('/offers/:id/submit-approval')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postOfferSubmitApproval);

router.route('/offers/:id/send')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postOfferSend);

router.route('/offers/:id/revise')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postOfferRevise);

router.route('/offers/:id')
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteOfferLetterHandler);

// Phase 1 — Background verification (Configure toggle gates API + UI)
router.route('/bgv')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getBgvCases)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvCase);

router.route('/bgv/:id/checks/:checkId')
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), patchBgvCheck);

router.route('/bgv/:id/sync')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvSync);

// Enhanced BGV endpoints
router.route('/bgv/:id/timeline')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvTimeline);

router.route('/bgv/:id/approval')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvApproval);

router.route('/bgv/:id/checks/:checkId/manual-verification')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvManualVerification);

router.route('/bgv/:id/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getBgvCaseAnalytics);

router.route('/bgv/bulk-sync')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvBulkSync);

router.route('/bgv/:id/waive')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), postBgvWaive);

router.route('/bgv/statistics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getBgvStatisticsHandler);

// Real-time BGV HR actions
router.route('/bgv/:id/checks/:checkId/verify')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), verifyCheckHandler);

router.route('/bgv/:id/checks/:checkId/request-info')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), requestAdditionalInfoHandler);

router.route('/bgv/:id/checks/:checkId/documents/:documentId/ocr')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), updateDocumentOcrStatusHandler);

router.route('/bgv/:id/checks/:checkId/documents/:documentId/match')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), updateDocumentMatchStatusHandler);

// HR BGV Dashboard routes
router.route('/bgv/hr/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getHrBgvDashboardHandler);

router.route('/bgv/hr/:id/detail')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), getHrBgvCaseDetailHandler);

router.route('/bgv/hr/:id/checks/:checkId/remarks')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), addHrRemarksHandler);

router.route('/bgv/hr/:id/checks/:checkId/internal-notes')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), addInternalNoteHandler);

router.route('/bgv/hr/:id/checks/:checkId/verification-details')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), updateVerificationDetailsHandler);

router.route('/bgv/hr/:id/checks/:checkId/references/:referenceId/contact')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), updateReferenceContactStatusHandler);

router.route('/bgv/hr/:id/checks/:checkId/vendor-report')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), uploadVendorReportHandler);

router.route('/bgv/hr/reports')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification', true), generateBgvReportHandler);

// HR Draft save endpoints (for HR to assist employees if needed)
router.route('/bgv/:id/checks/:checkId/draft/employment')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), saveEmploymentDraftHandler);

router.route('/bgv/:id/checks/:checkId/draft/education')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), saveEducationDraftHandler);

router.route('/bgv/:id/checks/:checkId/draft/address')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('backgroundVerification', 'Background verification'), saveAddressDraftHandler);

// Phase 1 — Notice period & F&F dashboards
router.route('/dashboard/notice-period')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('noticePeriod', 'Notice period', true), getNoticePeriodDashboard);

router.route('/dashboard/fnf')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, requireLifecycleFeature('fnfSettlement', 'F&F settlement', true), getFnfDashboard);

router.route('/offboarding/:workflowId/notice-period/buyout')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('noticePeriod', 'Notice period'), postNoticeBuyout);

router.route('/offboarding/:workflowId/notice-period/leave-adjustment')
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature(['noticePeriod', 'leaveAdjustmentNotice'], 'Notice leave adjustment'), patchNoticeLeaveAdjustment);

router.route('/offboarding/:workflowId/fnf/calculate')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('fnfSettlement', 'F&F settlement'), postFnfCalculate);

router.route('/offboarding/:workflowId/fnf/submit-approval')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('fnfSettlement', 'F&F settlement'), postFnfSubmitApproval);

router.route('/offboarding/:workflowId/fnf/pdf')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature('fnfSettlement', 'F&F settlement'), postFnfGeneratePdf);

// Phase 2.6 — Enterprise Lifecycle Reports & Analytics
router.route('/reports/catalog')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getReportsCatalogHandler);

router.route('/reports/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLifecycleDashboardHandler);

router.route('/reports/drilldown/:category')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLifecycleDrilldownHandler);

router.route('/reports/export/:category')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, exportLifecycleReportHandler);

router.route('/reports/scheduled')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listScheduledReportsHandler)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createScheduledReportHandler);

router.route('/reports/scheduled/:id')
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateScheduledReportHandler)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteScheduledReportHandler);

// Phase F — Enterprise completion
router.route('/statutory/types').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getStatutoryDocTypes);
router.route('/statutory/modules').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getStatutoryModules);
router.route('/statutory/preview').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getStatutoryPreview);
router.route('/statutory/dashboard').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getStatutoryDashboard);
router.route('/statutory/history').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getStatutoryHistory);
router.route('/statutory/bulk-generate').post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postBulkGenerateStatutory);
router.route('/statutory/generate').post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postGenerateStatutoryDoc);
router.route('/statutory/employee/:employeeId').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getEmployeeStatutoryDocs);

router.route('/it/inventory').get(isAdminOnly, readLimiter, getItInventoryDashboard);
router.route('/it/ticketing-providers').get(isAdminOnly, readLimiter, getItTicketingProviders);
router.route('/it/access-provisioning-catalog').get(isAdminOnly, readLimiter, getAccessProvisioningCatalogHandler);
router.route('/onboarding/:workflowId/software-requests')
    .post(isAdminOnly, writeLimiter, requireLifecycleFeature('softwareAccessRequest', 'Software access'), postSoftwareRequest);
router.route('/onboarding/:workflowId/software-requests/:requestId/approve')
    .post(isAdminOnly, writeLimiter, requireLifecycleFeature('softwareAccessRequest', 'Software access'), postApproveSoftwareRequest);
router.route('/onboarding/:workflowId/software-requests/:requestId/provision')
    .post(isAdminOnly, writeLimiter, requireLifecycleFeature('softwareAccessRequest', 'Software access'), postMarkSoftwareProvisioned);
router.route('/onboarding/:workflowId/device-replacement')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, requireLifecycleFeature(['itAssetProvisioning', 'softwareAccessRequest'], 'IT provisioning'), postDeviceReplacement);

router.route('/lms/dashboard').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLmsDashboard);
router.route('/lms/manager-dashboard').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getManagerTrainingDashboard);
router.route('/lms/providers').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLmsProviders);
router.route('/onboarding/:workflowId/lms/assign-course')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postAssignCourse);
router.route('/onboarding/:workflowId/lms/sync-certify')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postLmsSyncCertify);
router.route('/lms/training-history/:employeeId')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getTrainingHistoryHandler);

router.route('/probation/center').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getProbationCenter);

router.route('/dashboards/types').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getDashboardTypes);
router.route('/dashboards/:type').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getEnterpriseDashboard);

router.route('/search/categories').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getSearchCategories);
router.route('/search').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getGlobalSearch);
router.route('/search/saved')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getSavedSearches)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postSavedSearch);

router.route('/notifications/center')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getNotificationCenter)
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, patchNotificationCenter);
router.route('/notifications/meta').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getNotificationMeta);

router.route('/bulk/operations').get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getBulkOperations);
router.route('/bulk/execute').post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, postBulkOperation);

router.route('/branding')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getLifecycleBranding)
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, patchLifecycleBranding);

// HR Experience - Full visibility, bulk actions, reports
router.route('/hr/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHRDashboardHandler);

router.route('/hr/bulk/status')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, bulkUpdateStatusHandler);

router.route('/hr/bulk/assign-manager')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, bulkAssignManagerHandler);

router.route('/hr/bulk/assign-buddy')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, bulkAssignBuddyHandler);

router.route('/hr/pending-approvals')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHRPendingApprovalsHandler);

router.route('/hr/reports')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHRReportsHandler);

router.route('/hr/reports/export')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, exportHRReportHandler);

router.route('/hr/workflows')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getAllWorkflowsHandler);

// Workflow Runtime - Stages
router.route('/onboarding/:workflowId/stages')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingStages);

router.route('/offboarding/:workflowId/stages')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingStages);

router.route('/onboarding/:workflowId/stages/:stageId/state')
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOnboardingStageState);

router.route('/offboarding/:workflowId/stages/:stageId/state')
    .patch(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateOffboardingStageState);

router.route('/onboarding/:workflowId/stages/auto-progress')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, autoProgressOnboardingStages);

router.route('/offboarding/:workflowId/stages/auto-progress')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, autoProgressOffboardingStages);

router.route('/onboarding/:workflowId/stages/next')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, progressOnboardingToNextStage);

router.route('/offboarding/:workflowId/stages/next')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, progressOffboardingToNextStage);

router.route('/onboarding/:workflowId/stages/:stageId/unblock')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, unblockOnboardingStage);

router.route('/offboarding/:workflowId/stages/:stageId/unblock')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, unblockOffboardingStage);

router.route('/onboarding/:workflowId/stages/:stageId/skip')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, skipOnboardingStage);

router.route('/offboarding/:workflowId/stages/:stageId/skip')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, skipOffboardingStage);

router.route('/onboarding/:workflowId/stages/:stageId/progress')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOnboardingStageProgress);

router.route('/offboarding/:workflowId/stages/:stageId/progress')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getOffboardingStageProgress);

router.route('/onboarding/:workflowId/stages/validate')
    .post(isAdminOrHROrExecutiveAuthenticated, readLimiter, validateOnboardingStages);

router.route('/offboarding/:workflowId/stages/validate')
    .post(isAdminOrHROrExecutiveAuthenticated, readLimiter, validateOffboardingStages);

router.route('/onboarding/:workflowId/stages/can-progress')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, canProgressOnboarding);

router.route('/offboarding/:workflowId/stages/can-progress')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, canProgressOffboarding);

export default router;
