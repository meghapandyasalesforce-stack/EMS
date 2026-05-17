import express from 'express';
import {
    createSurvey,
    createRecognition,
    updateSurvey,
    getSurveyResponses,
    updateFeedback
} from '../../controllers/engagement/engagementController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Surveys
router.route('/surveys')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createSurvey);

router.route('/surveys/:surveyId')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateSurvey);

router.route('/surveys/:surveyId/responses')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getSurveyResponses);

router.route('/feedback/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateFeedback);

// Recognition
router.route('/recognition')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createRecognition);

export default router;

