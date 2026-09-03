import express from 'express';
import {
    createJobPosting,
    getJobPostings,
    getJobPostingById,
    updateJobPosting,
    deleteJobPosting,
    getCandidates,
    getCandidateById,
    updateCandidateStatus,
    scheduleInterview,
    getRecruitmentAnalytics,
    calculateCandidateScore,
    getCandidatePipeline,
    getRankedCandidates,
    generateOfferLetter,
    getRecruiterWorkspace,
    hireCandidate,
    getHireDefaults,
    updateJoiningStatus,
    archiveCandidate,
    blacklistCandidate,
    withdrawCandidate,
    logCandidateCommunication,
    bulkUpdateCandidates,
    updateInterviewFeedback,
    archiveJobPosting,
} from '../../controllers/recruitment/recruitmentController.js';
import {
    createRequisition,
    listRequisitions,
    getRequisitionById,
    updateRequisition,
    submitRequisition,
    approveRequisition,
    rejectRequisition,
    convertRequisitionToJob,
    getRecruitmentCalendar,
    assignAssessment,
    updateAssessment,
    sendCandidateEmail,
} from '../../controllers/recruitment/recruitmentP1Controller.js';
import {
    getResumeInboxStats,
    listResumeInboxImports,
    getInboxConfig,
    putInboxConfig,
    pollResumeInbox,
    testInboxConnection,
    markInboxImportRead,
    assignInboxImportJob,
    retryInboxImport,
    listAssignableJobs,
    deleteInboxImport,
} from '../../controllers/recruitment/resumeInboxController.js';
import {
    getScreeningSettings,
    putScreeningSettings,
    getScreeningDashboardStats,
    getJobScreeningStatsHandler,
    rescreenCandidate,
    hardDeleteCandidate,
} from '../../controllers/recruitment/resumeScreeningController.js';
import {
    listScreeningTemplates,
    getScreeningTemplate,
    createScreeningTemplate,
    updateScreeningTemplate,
    activateScreeningTemplate,
    deactivateScreeningTemplate,
    deleteScreeningTemplate,
} from '../../controllers/recruitment/resumeScreeningTemplateController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';
import { blockFailedScreeningActions } from '../../middlewares/blockFailedScreening.js';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.RECRUITMENT));
router.route('/screening/settings')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getScreeningSettings)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, putScreeningSettings);

router.route('/screening/dashboard')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getScreeningDashboardStats);

// Resume Screening Templates
router.route('/screening/templates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listScreeningTemplates)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createScreeningTemplate);

router.route('/screening/templates/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getScreeningTemplate)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateScreeningTemplate)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteScreeningTemplate);

router.route('/screening/templates/:id/activate')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, activateScreeningTemplate);

router.route('/screening/templates/:id/deactivate')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deactivateScreeningTemplate);

// Resume Inbox (additive — before generic :id routes)
router.route('/inbox/stats')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getResumeInboxStats);

router.route('/inbox/config')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getInboxConfig)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, putInboxConfig);

router.route('/inbox/poll')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, pollResumeInbox);

router.route('/inbox/test-connection')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, testInboxConnection);

router.route('/inbox/jobs')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listAssignableJobs);

router.route('/inbox/imports')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listResumeInboxImports);

router.route('/inbox/imports/:id/read')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, markInboxImportRead);

router.route('/inbox/imports/:id/assign-job')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, assignInboxImportJob);

router.route('/inbox/imports/:id/retry')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, retryInboxImport);

router.route('/inbox/imports/:id')
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteInboxImport);

// Workspace & Pipeline
router.route('/workspace')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRecruiterWorkspace);

router.route('/pipeline')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getCandidatePipeline);

router.route('/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRecruitmentAnalytics);

// Job Postings
router.route('/jobs')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createJobPosting)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getJobPostings);

router.route('/jobs/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getJobPostingById)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateJobPosting)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteJobPosting);

router.route('/jobs/:id/archive')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, archiveJobPosting);

router.route('/jobs/:id/screening-stats')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getJobScreeningStatsHandler);

router.route('/jobs/:id/candidates/ranked')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRankedCandidates);

// Candidates — bulk before :id
router.route('/candidates/bulk')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, bulkUpdateCandidates);

router.route('/candidates')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getCandidates);

router.route('/candidates/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getCandidateById)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, updateCandidateStatus);

router.route('/candidates/:id/interview')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, scheduleInterview);

router.route('/candidates/:id/interview/:interviewId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, updateInterviewFeedback);

router.route('/candidates/:id/score')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, calculateCandidateScore);

router.route('/candidates/:id/generate-offer')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, generateOfferLetter);

router.route('/candidates/:id/hire-defaults')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHireDefaults);

router.route('/candidates/:id/hire')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, hireCandidate);

router.route('/candidates/:id/joining')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, updateJoiningStatus);

router.route('/candidates/:id/archive')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, archiveCandidate);

router.route('/candidates/:id/blacklist')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blacklistCandidate);

router.route('/candidates/:id/withdraw')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, withdrawCandidate);

router.route('/candidates/:id/communication')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, logCandidateCommunication);

router.route('/candidates/:id/assessments')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, assignAssessment);

router.route('/candidates/:id/assessments/:assessmentId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, updateAssessment);

router.route('/candidates/:id/send-email')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, blockFailedScreeningActions, sendCandidateEmail);

router.route('/candidates/:id/rescreen')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, rescreenCandidate);

router.route('/candidates/:id/hard-delete')
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, hardDeleteCandidate);

// Requisitions
router.route('/requisitions')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, listRequisitions)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createRequisition);

router.route('/requisitions/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRequisitionById)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateRequisition);

router.route('/requisitions/:id/submit')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, submitRequisition);

router.route('/requisitions/:id/approve')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, approveRequisition);

router.route('/requisitions/:id/reject')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, rejectRequisition);

router.route('/requisitions/:id/convert')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, convertRequisitionToJob);

// Calendar
router.route('/calendar')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getRecruitmentCalendar);

export default router;
