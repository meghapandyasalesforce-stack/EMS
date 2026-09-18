import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createSurvey,
    getSurveys,
    getSurveyById,
    getMySurveys,
    submitSurveyResponse,
    createFeedback,
    getFeedbacks,
    getFeedbackById,
    getRecognitions,
    createRecognition,
    reactToRecognition,
    getRecognitionById,
    getRecognitionAnalytics,
    getEngagementAnalytics,
    getSurveyAnalytics,
    createPulseSurvey,
    get360Feedback,
    getPublicEngagementSettings,
    getWellbeingTemplate,
    getEngagementActivity,
    getEngagementCelebrations
} from '../../controllers/engagement/engagementController.js';
import {
    getActionPlans,
    getActionPlanById,
    updateActionPlan
} from '../../controllers/engagement/actionPlanController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { requireAnyPermission } from '../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ENGAGEMENT));

const surveyManage = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const surveyTake = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_SURVEY_TAKE,
    PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const feedbackSubmit = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_FEEDBACK_SUBMIT,
    PERMISSIONS.ENGAGEMENT_FEEDBACK_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const recognitionGive = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_RECOGNITION_GIVE,
    PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const recognitionManage = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const analyticsAccess = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG,
    PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM,
    PERMISSIONS.ENGAGEMENT_SURVEY_MANAGE,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);
const recognitionAnalyticsAccess = requireAnyPermission([
    PERMISSIONS.ENGAGEMENT_RECOGNITION_MANAGE,
    PERMISSIONS.ENGAGEMENT_ANALYTICS_ORG,
    PERMISSIONS.ENGAGEMENT_ANALYTICS_TEAM,
    PERMISSIONS.ENGAGEMENT_MANAGE
]);

// Surveys
router.route('/surveys')
    .post(...surveyManage, writeLimiter, createSurvey)
    .get(isAuthenticatedBoth, readLimiter, getSurveys);

router.route('/my-surveys')
    .get(...surveyTake, readLimiter, getMySurveys);

router.route('/surveys/:surveyId')
    .get(isAuthenticatedBoth, readLimiter, getSurveyById);

router.route('/surveys/:surveyId/respond')
    .post(...surveyTake, writeLimiter, submitSurveyResponse);

router.route('/surveys/:surveyId/analytics')
    .get(...analyticsAccess, readLimiter, getSurveyAnalytics);

// Pulse Surveys
router.route('/pulse-surveys')
    .post(...surveyManage, writeLimiter, createPulseSurvey);

// Feedback
router.route('/feedback')
    .post(...feedbackSubmit, writeLimiter, createFeedback)
    .get(isAuthenticatedBoth, readLimiter, getFeedbacks);

router.route('/feedback/:id')
    .get(isAuthenticatedBoth, readLimiter, getFeedbackById);

// 360 Feedback (placeholder — unchanged scope)
router.route('/360-feedback/:employeeId')
    .get(isAuthenticatedBoth, readLimiter, get360Feedback);

// Recognition
router.route('/recognition')
    .get(isAuthenticatedBoth, readLimiter, getRecognitions)
    .post(...recognitionGive, writeLimiter, createRecognition);

router.route('/recognition/analytics')
    .get(...recognitionAnalyticsAccess, readLimiter, getRecognitionAnalytics);

router.route('/recognition/:id')
    .get(isAuthenticatedBoth, readLimiter, getRecognitionById);

router.route('/recognition/:id/react')
    .post(...recognitionGive, writeLimiter, reactToRecognition);

// Analytics
router.route('/analytics')
    .get(...analyticsAccess, readLimiter, getEngagementAnalytics);

router.route('/settings')
    .get(isAuthenticatedBoth, readLimiter, getPublicEngagementSettings);

router.route('/wellbeing-template')
    .get(...surveyManage, readLimiter, getWellbeingTemplate);

router.route('/activity')
    .get(isAuthenticatedBoth, readLimiter, getEngagementActivity);

router.route('/celebrations')
    .get(isAuthenticatedBoth, readLimiter, getEngagementCelebrations);

router.route('/action-plans')
    .get(isAuthenticatedBoth, readLimiter, getActionPlans);

router.route('/action-plans/:id')
    .get(isAuthenticatedBoth, readLimiter, getActionPlanById)
    .put(isAuthenticatedBoth, writeLimiter, updateActionPlan);

export default router;
