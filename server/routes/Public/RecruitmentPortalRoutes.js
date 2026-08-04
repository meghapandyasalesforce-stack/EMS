import express from 'express';
import {
    listPublicJobs,
    getPublicJobById,
    publicApplyForJob,
} from '../../controllers/recruitment/recruitmentController.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/:organizationId/jobs')
    .get(readLimiter, listPublicJobs);

router.route('/:organizationId/jobs/:id')
    .get(readLimiter, getPublicJobById);

router.route('/:organizationId/jobs/:id/apply')
    .post(writeLimiter, publicApplyForJob);

export default router;
