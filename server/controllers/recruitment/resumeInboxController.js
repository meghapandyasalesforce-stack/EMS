import asyncHandler from '../../middlewares/asyncHandler.js';
import Organization from '../../models/organization.model.js';
import {
    getResumeInboxConfig,
    updateResumeInboxConfig,
    pollOrganizationInbox,
    testResumeInboxConnection,
    getInboxStats,
    listImports,
    markImportRead,
    assignImportToJob,
    retryFailedImport,
    deleteImport,
    HOLDING_JOB_TAG,
} from '../../services/resumeInboxService.js';
import { Recruitment } from '../../models/recruitment.model.js';

const getOrganizationId = (req) =>
    req.employee?.organizationId || req.user?.organizationId || req.organizationId;

/**
 * GET /api/v1/admin/recruitment/inbox/stats
 */
export const getResumeInboxStats = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const stats = await getInboxStats(organizationId);
    const config = await getResumeInboxConfig(organizationId);
    res.json({ success: true, data: { ...stats, config } });
});

/**
 * GET /api/v1/admin/recruitment/inbox/imports
 */
export const listResumeInboxImports = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, page, limit } = req.query;
    const data = await listImports(organizationId, { status, page, limit });
    res.json({ success: true, data: data.items, pagination: { total: data.total, page: data.page, limit: data.limit } });
});

/**
 * GET /api/v1/admin/recruitment/inbox/config
 */
export const getInboxConfig = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const config = await getResumeInboxConfig(organizationId);
    res.json({ success: true, data: config });
});

/**
 * PUT /api/v1/admin/recruitment/inbox/config
 */
export const putInboxConfig = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const config = await updateResumeInboxConfig(organizationId, req.body || {});
    res.json({ success: true, message: 'Resume Inbox settings saved', data: config });
});

/**
 * POST /api/v1/admin/recruitment/inbox/poll
 * Manual poll trigger for the current organization.
 */
export const pollResumeInbox = asyncHandler(async (req, res, next) => {
    const organizationId = getOrganizationId(req);
    try {
        const result = await pollOrganizationInbox(organizationId);
        return res.json({
            success: true,
            message: result.skipped
                ? 'Resume Inbox is not configured or disabled'
                : `Poll complete: ${result.imported} imported, ${result.duplicates} duplicates, ${result.failed} failed`,
            data: result,
        });
    } catch (err) {
        return next(err);
    }
});

/**
 * POST /api/v1/admin/recruitment/inbox/test-connection
 * Verify IMAP credentials. Body may include { password } to test before save.
 */
export const testInboxConnection = asyncHandler(async (req, res, next) => {
    const organizationId = getOrganizationId(req);
    try {
        const result = await testResumeInboxConnection(organizationId, req.body || {});
        return res.json({
            success: true,
            message: `Connected to ${result.host} as ${result.user} (${result.unseen} unread in ${result.folder})`,
            data: result,
        });
    } catch (err) {
        await Organization.findByIdAndUpdate(organizationId, {
            $set: {
                'settings.resumeInbox.lastPollError': err.message,
            },
        }).catch(() => {});
        err.statusCode = err.status || err.statusCode || 500;
        return next(err);
    }
});

/**
 * POST /api/v1/admin/recruitment/inbox/imports/:id/read
 */
export const markInboxImportRead = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const doc = await markImportRead(organizationId, req.params.id);
    if (!doc) {
        return res.status(404).json({ success: false, message: 'Import not found' });
    }
    return res.json({ success: true, data: doc });
});

/**
 * POST /api/v1/admin/recruitment/inbox/imports/:id/assign-job
 * Body: { jobPostingId }
 */
export const assignInboxImportJob = asyncHandler(async (req, res, next) => {
    const organizationId = getOrganizationId(req);
    const { jobPostingId } = req.body || {};
    if (!jobPostingId) {
        return res.status(400).json({ success: false, message: 'jobPostingId is required' });
    }
    try {
        const result = await assignImportToJob(
            organizationId,
            req.params.id,
            jobPostingId,
            req.employee?._id || req.user?._id
        );
        return res.json({ success: true, message: 'Candidate assigned to job', data: result });
    } catch (err) {
        err.statusCode = err.status || err.statusCode || 500;
        return next(err);
    }
});

/**
 * POST /api/v1/admin/recruitment/inbox/imports/:id/retry
 */
export const retryInboxImport = asyncHandler(async (req, res, next) => {
    const organizationId = getOrganizationId(req);
    try {
        const result = await retryFailedImport(organizationId, req.params.id);
        return res.json({ success: true, message: 'Retry completed', data: result });
    } catch (err) {
        err.statusCode = err.status || err.statusCode || 500;
        return next(err);
    }
});

/**
 * DELETE /api/v1/admin/recruitment/inbox/imports/:id
 */
export const deleteInboxImport = asyncHandler(async (req, res, next) => {
    const organizationId = getOrganizationId(req);
    try {
        const doc = await deleteImport(organizationId, req.params.id);
        return res.json({ success: true, message: 'Import deleted', data: doc });
    } catch (err) {
        err.statusCode = err.status || err.statusCode || 500;
        return next(err);
    }
});

/**
 * GET /api/v1/admin/recruitment/inbox/jobs
 * Open jobs available for assignment (excludes holding job).
 */
export const listAssignableJobs = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const jobs = await Recruitment.find({
        organizationId,
        isActive: true,
        status: { $in: ['Open', 'Draft', 'On Hold'] },
        tags: { $ne: HOLDING_JOB_TAG },
    })
        .select('jobTitle department status location')
        .sort({ postedDate: -1 })
        .lean();
    res.json({ success: true, data: jobs });
});
