import express from 'express';
import {
    createOneOnOne,
    getOneOnOnes,
    updateOneOnOne,
    completeOneOnOne
} from '../../controllers/oneOnOne/oneOnOneController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// One-on-One Meetings
router.route('/one-on-ones')
    .post(isAuthenticatedBoth, writeLimiter, createOneOnOne)
    .get(isAuthenticatedBoth, readLimiter, getOneOnOnes);

router.route('/one-on-ones/:id')
    .put(isAuthenticatedBoth, writeLimiter, updateOneOnOne);

router.route('/one-on-ones/:id/complete')
    .post(isAuthenticatedBoth, writeLimiter, completeOneOnOne);

export default router;

