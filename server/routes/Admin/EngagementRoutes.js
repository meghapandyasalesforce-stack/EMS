import express from 'express';
import {
    createSurvey,
    createRecognition
} from '../../controllers/engagement/engagementController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Surveys
router.route('/surveys')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createSurvey);

// Recognition
router.route('/recognition')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createRecognition);

export default router;

