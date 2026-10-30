import express from 'express';
import asyncHandler from '../../middlewares/asyncHandler.js';
import { resolveCareerOrganizationId } from '../../helpers/careerPortalSlug.js';
import {
    listPublicJobs,
    getPublicJobById,
    publicApplyForJob,
} from '../../controllers/recruitment/recruitmentController.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.param('organizationId', asyncHandler(async (req, res, next) => {
    const organizationId = await resolveCareerOrganizationId(req.params.organizationId);
    if (!organizationId) {
        return res.status(404).json({ success: false, message: 'Career portal not found' });
    }
    req.params.organizationId = organizationId;
    next();
}));

router.route('/:organizationId/jobs')
    .get(readLimiter, listPublicJobs);

router.route('/:organizationId/jobs/:id')
    .get(readLimiter, getPublicJobById);

router.route('/:organizationId/jobs/:id/apply')
    .post(writeLimiter, publicApplyForJob);

export default router;
