import express from 'express';
import {
    createSurvey,
    getSurveys,
    getSurveyById,
    submitSurveyResponse,
    createFeedback,
    getFeedbacks,
    getRecognitions,
    getEngagementAnalytics,
    createPulseSurvey,
    get360Feedback
} from '../../controllers/engagement/engagementController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Surveys
router.route('/surveys')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createSurvey)
    .get(isAuthenticatedBoth, readLimiter, getSurveys);

router.route('/surveys/:surveyId')
    .get(isAuthenticatedBoth, readLimiter, getSurveyById);

router.route('/surveys/:surveyId/respond')
    .post(isAuthenticatedBoth, writeLimiter, submitSurveyResponse);

// Pulse Surveys (Admin/HR only)
router.route('/pulse-surveys')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createPulseSurvey);

// Feedback
router.route('/feedback')
    .post(isAuthenticatedBoth, writeLimiter, createFeedback)
    .get(isAuthenticatedBoth, readLimiter, getFeedbacks);

// 360 Feedback
router.route('/360-feedback/:employeeId')
    .get(isAuthenticatedBoth, readLimiter, get360Feedback);

// Recognition
router.route('/recognition')
    .get(isAuthenticatedBoth, readLimiter, getRecognitions);

// Analytics (Admin/HR only)
router.route('/analytics')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getEngagementAnalytics);

export default router;

