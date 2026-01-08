import express from 'express';
import { applyForJob } from '../../controllers/recruitment/recruitmentController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Public job application
router.route('/jobs/:jobPostingId/apply')
    .post(isAuthenticatedBoth, writeLimiter, applyForJob);

export default router;

