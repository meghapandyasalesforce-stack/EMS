import express from 'express';
import asyncHandler from '../../middlewares/asyncHandler.js';
import Organization from '../../models/organization.model.js';
import { ensureCareerSlug, resolveCareerOrganizationId } from '../../helpers/careerPortalSlug.js';
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

// Idempotent public link initialization. The name comes from the organization,
// never from caller input; listings remain readable when initialization fails.
router.post('/:organizationId/portal-link', writeLimiter, asyncHandler(async (req, res) => {
    const org = await Organization.findOne({ _id: req.params.organizationId, isActive: true, deletedAt: null })
        .select('_id').lean();
    if (!org) return res.status(404).json({ success: false, message: 'Career portal not found' });
    const slug = await ensureCareerSlug(org._id);
    if (!slug) return res.status(404).json({ success: false, message: 'Career portal not found' });
    res.json({ success: true, data: { slug } });
}));

router.route('/:organizationId/jobs')
    .get(readLimiter, listPublicJobs);

router.route('/:organizationId/jobs/:id')
    .get(readLimiter, getPublicJobById);

router.route('/:organizationId/jobs/:id/apply')
    .post(writeLimiter, publicApplyForJob);

export default router;
