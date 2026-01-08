import express from 'express';
import {
    createSurvey,
    createRecognition
} from '../../controllers/engagement/engagementController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Surveys
router.route('/surveys')
    .post(isAdminOrHRAuthenticated, writeLimiter, createSurvey);

// Recognition
router.route('/recognition')
    .post(isAdminOrHRAuthenticated, writeLimiter, createRecognition);

export default router;

