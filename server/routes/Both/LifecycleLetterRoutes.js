import express from 'express';
import {
    listMyLetters,
    viewLetterHandler,
    acknowledgeLetterHandler,
} from '../../controllers/lifecycle/lifecycleLetterController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/letters/mine')
    .get(isAuthenticated, readLimiter, listMyLetters);

router.route('/letters/:id/view')
    .post(isAuthenticated, writeLimiter, viewLetterHandler);

router.route('/letters/:id/acknowledge')
    .post(isAuthenticated, writeLimiter, acknowledgeLetterHandler);

export default router;
