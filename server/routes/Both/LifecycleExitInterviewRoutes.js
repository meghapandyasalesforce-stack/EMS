import express from 'express';
import {
    listMyExitInterviewSessions,
    getExitInterviewSessionHandler,
    saveExitInterviewDraftHandler,
    submitExitInterviewSessionHandler,
} from '../../controllers/lifecycle/lifecycleExitInterviewController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/exit-interviews/mine')
    .get(isAuthenticated, readLimiter, listMyExitInterviewSessions);

router.route('/exit-interviews/:id')
    .get(isAuthenticated, readLimiter, getExitInterviewSessionHandler);

router.route('/exit-interviews/:id/draft')
    .post(isAuthenticated, writeLimiter, saveExitInterviewDraftHandler);

router.route('/exit-interviews/:id/submit')
    .post(isAuthenticated, writeLimiter, submitExitInterviewSessionHandler);

export default router;
