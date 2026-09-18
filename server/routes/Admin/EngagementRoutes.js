import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createSurvey,
    createRecognition,
    updateSurvey,
    deleteSurvey,
    getSurveyResponses,
    updateFeedback,
    updateRecognition,
    getEngagementSettings,
    updateEngagementSettings,
    cloneSurvey,
    exportSurveyResponses,
    exportFeedback,
    exportSuggestions,
    exportRecognition,
    exportEngagementSummary
} from '../../controllers/engagement/engagementController.js';
import {
    createPulseProgram,
    getPulsePrograms,
    getPulseProgramById,
    updatePulseProgram,
    activatePulseProgram,
    pausePulseProgram,
    resumePulseProgram,
    archivePulseProgram,
    getPulseProgramHistory,
    getPulseProgramAnalytics
} from '../../controllers/engagement/pulseProgramController.js';
import {
    createActionPlan,
    getActionPlans,
    getActionPlanById,
    updateActionPlan
} from '../../controllers/engagement/actionPlanController.js';
import { requireAnyPermission } from '../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ENGAGEMENT));

const surveyManage = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const feedbackManage = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_FEEDBACK_MANAGE,
    PERMISSIONS.ENGAGEMENT_SUGGESTIONS_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const recognitionManage = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE,
    PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);

// Surveys
router.route('/surveys')
    .post(...surveyManage, writeLimiter, createSurvey);

router.route('/surveys/:surveyId')
    .put(...surveyManage, writeLimiter, updateSurvey)
    .delete(...surveyManage, writeLimiter, deleteSurvey);

router.route('/surveys/:surveyId/responses')
    .get(...surveyManage, readLimiter, getSurveyResponses);

router.route('/surveys/:surveyId/clone')
    .post(...surveyManage, writeLimiter, cloneSurvey);

router.route('/surveys/:surveyId/export/responses')
    .get(...surveyManage, readLimiter, exportSurveyResponses);

router.route('/export/feedback')
    .get(...feedbackManage, readLimiter, exportFeedback);

router.route('/export/suggestions')
    .get(...feedbackManage, readLimiter, exportSuggestions);

router.route('/export/recognition')
    .get(...recognitionManage, readLimiter, exportRecognition);

router.route('/export/summary')
    .get(
        ...requireAnyPermission([
            PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG,
            PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM,
            PERMISSIONS.ENGAGEMENT_MANAGE
        ]),
        readLimiter,
        exportEngagementSummary
    );

router.route('/feedback/:id')
    .put(...feedbackManage, writeLimiter, updateFeedback);

// Recognition — peer create also available on both; admin path for HR tools
router.route('/recognition')
    .post(...recognitionManage, writeLimiter, createRecognition);

router.route('/recognition/:id')
    .put(
        ...requireAnyPermission([
            PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE,
            PERMISSIONS.ENGAGEMENT_MANAGE
        ]),
        writeLimiter,
        updateRecognition
    );

// Pulse Programs
router.route('/pulse-programs')
    .get(...surveyManage, readLimiter, getPulsePrograms)
    .post(...surveyManage, writeLimiter, createPulseProgram);

router.route('/pulse-programs/:id')
    .get(...surveyManage, readLimiter, getPulseProgramById)
    .put(...surveyManage, writeLimiter, updatePulseProgram);

router.route('/pulse-programs/:id/activate')
    .post(...surveyManage, writeLimiter, activatePulseProgram);

router.route('/pulse-programs/:id/pause')
    .post(...surveyManage, writeLimiter, pausePulseProgram);

router.route('/pulse-programs/:id/resume')
    .post(...surveyManage, writeLimiter, resumePulseProgram);

router.route('/pulse-programs/:id/archive')
    .post(...surveyManage, writeLimiter, archivePulseProgram);

router.route('/pulse-programs/:id/history')
    .get(...surveyManage, readLimiter, getPulseProgramHistory);

router.route('/pulse-programs/:id/analytics')
    .get(...surveyManage, readLimiter, getPulseProgramAnalytics);

router.route('/settings')
    .get(
        ...requireAnyPermission([
            PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE,
            PERMISSIONS.ENGAGEMENT_MANAGE,
            PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE,
            PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG
        ]),
        readLimiter,
        getEngagementSettings
    )
    .put(
        ...requireAnyPermission([
            PERMISSIONS.ENGAGEMENT_MANAGE,
            PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE
        ]),
        writeLimiter,
        updateEngagementSettings
    );

router.route('/action-plans')
    .get(...surveyManage, readLimiter, getActionPlans)
    .post(...surveyManage, writeLimiter, createActionPlan);

router.route('/action-plans/:id')
    .get(...surveyManage, readLimiter, getActionPlanById)
    .put(...surveyManage, writeLimiter, updateActionPlan);

export default router;
