import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    getResumeScreeningSettings,
    updateResumeScreeningSettings,
    getJobScreeningStats,
    getScreeningDashboard,
    hardDeleteScreenedCandidate,
    screenCandidateById,
    isScreeningFailed,
    attachNormalizedScreening,
} from '../../services/resumeScreeningService.js';
import { Candidate } from '../../models/recruitment.model.js';

const getOrganizationId = (req) =>
    req.employee?.organizationId || req.user?.organizationId || req.organizationId;

/**
 * GET /api/v1/admin/recruitment/screening/settings
 */
export const getScreeningSettings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const data = await getResumeScreeningSettings(organizationId);
    res.json({ success: true, data });
});

/**
 * PUT /api/v1/admin/recruitment/screening/settings
 */
export const putScreeningSettings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const data = await updateResumeScreeningSettings(organizationId, req.body || {});
    res.json({ success: true, message: 'Resume screening settings saved', data });
});

/**
 * GET /api/v1/admin/recruitment/screening/dashboard
 */
export const getScreeningDashboardStats = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const data = await getScreeningDashboard(organizationId);
    res.json({ success: true, data });
});

/**
 * GET /api/v1/admin/recruitment/jobs/:id/screening-stats
 */
export const getJobScreeningStatsHandler = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const data = await getJobScreeningStats(organizationId, req.params.id);
    res.json({ success: true, data });
});

/**
 * POST /api/v1/admin/recruitment/candidates/:id/rescreen
 */
export const rescreenCandidate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    const updated = await screenCandidateById(candidate._id, {
        force: true,
        replaceCompleted: true,
    });
    res.json({
        success: true,
        message: 'Screening completed',
        data: attachNormalizedScreening(updated),
    });
});

/**
 * DELETE /api/v1/admin/recruitment/candidates/:id/hard-delete
 * Allowed for failed-screening candidates (manual delete).
 */
export const hardDeleteCandidate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId })
        .select('resumeScreening')
        .lean();
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    if (!isScreeningFailed(candidate) && req.query.force !== 'true') {
        return res.status(400).json({
            success: false,
            message: 'Hard delete is intended for candidates who failed screening. Pass force=true to override.',
        });
    }
    const result = await hardDeleteScreenedCandidate(req.params.id, {
        organizationId,
        actorId: req.employee?._id || req.user?._id,
        auto: false,
    });
    res.json({ success: true, message: 'Candidate deleted', data: result });
});
