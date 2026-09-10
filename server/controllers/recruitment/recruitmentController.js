import { Recruitment, Candidate } from '../../models/recruitment.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { parsePagination, parseSort, sendPaginatedResponse } from '../../helpers/paginationHelper.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import mongoose from 'mongoose';
import {
    getWorkspaceSummary,
    getFullPipeline,
    markHired,
    mapStatusToStage,
} from '../../services/recruitmentService.js';
import { isOrgAdminRequest, loadRequesterHrStaff, isHrStaffEmployee } from '../../helpers/functionalRolesHelper.js';
import {
    convertCandidateToEmployee,
    suggestHireDefaults,
    EMPLOYEE_DEPARTMENTS,
    EMPLOYEE_JOB_TITLES,
    EMPLOYEE_POSITIONS,
    EMPLOYEE_JOB_CATEGORIES,
} from '../../services/hireConversionService.js';
import { normalizeMinimumMatchPercent, normalizeKeywordList } from '../../services/resumeScreeningService.js';

/** Ensure job screeningCriteria keywords + minimumMatchPercent are clean before persist. */
function normalizeJobBodyScreeningCriteria(body = {}) {
    if (!body.screeningCriteria || typeof body.screeningCriteria !== 'object') return body;
    const sc = { ...body.screeningCriteria };
    if (sc.minimumMatchPercent != null && sc.minimumMatchPercent !== '') {
        sc.minimumMatchPercent = normalizeMinimumMatchPercent(sc.minimumMatchPercent, 70);
    }
    if (sc.requiredKeywords != null) {
        sc.requiredKeywords = normalizeKeywordList(sc.requiredKeywords);
    }
    if (sc.optionalKeywords != null) {
        sc.optionalKeywords = normalizeKeywordList(sc.optionalKeywords);
    }
    return { ...body, screeningCriteria: sc };
}

/** Clients must not set postedDate; server stamps it only on publish/reopen. */
function withoutClientPostedDate(body = {}) {
    const next = { ...body };
    delete next.postedDate;
    return next;
}

// If asyncHandler doesn't exist, use try-catch pattern
const handleAsync = asyncHandler || ((fn) => async (req, res, next) => {
    try {
        await fn(req, res, next);
    } catch (error) {
        logger.error('Error in recruitment controller', { error: error.message });
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

/**
 * @route   POST /api/v1/admin/recruitment/jobs
 * @desc    Create a new job posting
 * @access  Admin only
 * @param   {Object} req.body - Job posting data
 * @param   {string} req.body.jobTitle - Job title (required)
 * @param   {string} req.body.department - Department (required)
 * @param   {string} req.body.jobDescription - Job description (required)
 * @returns {Object} Created job posting
 */
export const createJobPosting = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const createdBy = req.user?._id || req.employee?._id;
    const body = withoutClientPostedDate(normalizeJobBodyScreeningCriteria(req.body));
    const status = body.status || 'Draft';

    const workforcePlanId = body.workforcePlanId || null;
    const workforceHiringIndex =
        body.workforceHiringIndex != null && body.workforceHiringIndex !== ''
            ? Number(body.workforceHiringIndex)
            : null;

    const jobPosting = new Recruitment({
        ...body,
        organizationId,
        createdBy,
        workforcePlanId: workforcePlanId || null,
        workforceHiringIndex: Number.isFinite(workforceHiringIndex) ? workforceHiringIndex : null,
        // Draft create time is not a posting date — stamp only when published Open
        postedDate: status === 'Open' ? new Date() : null,
    });

    if (workforcePlanId) {
        const tags = new Set([...(jobPosting.tags || []), 'workforce-planning', String(workforcePlanId)]);
        jobPosting.tags = [...tags];
    }

    await jobPosting.save();

    // Link back to workforce hiring line when created from a WP requirement
    if (workforcePlanId && Number.isFinite(workforceHiringIndex)) {
        try {
            const { WorkforcePlan } = await import('../../models/workforce.model.js');
            const plan = await WorkforcePlan.findOne({ _id: workforcePlanId, organizationId });
            if (plan?.hiringPlan?.[workforceHiringIndex]) {
                const hiring = plan.hiringPlan[workforceHiringIndex];
                if (!hiring.recruitmentJobId) {
                    hiring.recruitmentJobId = jobPosting._id;
                    if (hiring.status === 'Planned') hiring.status = 'In Progress';
                    await plan.save();
                }
            }
        } catch (linkErr) {
            logger.warn('Failed to link job posting to workforce hiring line', {
                error: linkErr.message,
                workforcePlanId,
                workforceHiringIndex,
            });
        }
    }

    // Notify employees when posted directly as Open + internal
    if (jobPosting.status === 'Open' && jobPosting.internalVisible) {
        try {
            const { notifyEmployeesOfInternalJob } = await import('../../services/internalJobsService.js');
            await notifyEmployeesOfInternalJob(jobPosting);
        } catch (e) {
            logger.warn('Internal job notify on create failed', { error: e.message });
        }
    }

    res.status(201).json({
        success: true,
        message: 'Job posting created successfully',
        data: jobPosting
    });
});

/**
 * @route   GET /api/v1/admin/recruitment/jobs
 * @desc    Get all job postings with pagination
 * @access  Admin/HR
 * @query   {number} page - Page number (default: 1)
 * @query   {number} limit - Items per page (default: 20, max: 100)
 * @query   {string} status - Filter by status (Draft, Open, Closed, etc.)
 * @query   {string} department - Filter by department
 * @query   {string} sort - Sort field (default: -createdAt)
 * @returns {Object} Paginated job postings
 */
export const getJobPostings = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { status, department } = req.query;

    // Parse pagination and sort
    const { page, limit, skip } = parsePagination(req, { defaultLimit: 20, maxLimit: 100 });
    const sort = parseSort(req, '-createdAt');

    const query = addOrganizationFilter(req, {});

    if (status) query.status = status;
    if (department) query.department = department;
    if (req.query.includeArchived !== 'true') {
        query.$or = [{ archivedAt: null }, { archivedAt: { $exists: false } }];
        if (req.query.activeOnly !== 'false') {
            query.isActive = { $ne: false };
        }
    }
    // Hide system Resume Inbox holding job unless explicitly requested
    if (req.query.includeHolding !== 'true') {
        query.tags = { ...(query.tags || {}), $ne: '__resume_inbox_holding__' };
    }

    // Optimized query with lean() and parallel count
    const [jobPostings, total] = await Promise.all([
        Recruitment.find(query)
            .populate('hiringManager', 'name email')
            .populate('recruiter', 'name email')
            .sort(sort)
            .skip(skip)
            .limit(limit)
            .lean(),
        Recruitment.countDocuments(query)
    ]);

    return sendPaginatedResponse(res, jobPostings, page, limit, total, 'Job postings retrieved successfully');
});

/**
 * @route   GET /api/v1/admin/recruitment/jobs/:id
 * @desc    Get job posting by ID
 * @access  Admin/HR
 * @param   {string} id - Job posting ID
 * @returns {Object} Job posting details
 */
export const getJobPostingById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const jobPosting = await Recruitment.findOne({
        _id: id,
        organizationId
    })
        .populate('hiringManager', 'name email')
        .populate('recruiter', 'name email')
        .populate('createdBy', 'name email')
        .lean(); // Use lean() for better performance

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    res.json({
        success: true,
        data: jobPosting
    });
});

/**
 * Update job posting
 */
export const updateJobPosting = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const previous = await Recruitment.findOne({ _id: id, organizationId }).lean();
    if (!previous) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    // Reset notify stamp if re-opening or toggling internal visibility on
    const becomingOpenInternal =
        (req.body.status === 'Open' || (req.body.status === undefined && previous.status === 'Open'))
        && (req.body.internalVisible === true || (req.body.internalVisible === undefined && previous.internalVisible));
    const wasAlreadyNotifiedOpen =
        previous.status === 'Open' && previous.internalVisible && previous.employeesNotifiedAt;

    if (req.body.status && req.body.status !== 'Open') {
        req.body.employeesNotifiedAt = null;
    }

    const updateBody = withoutClientPostedDate(normalizeJobBodyScreeningCriteria(req.body));

    // Draft→Open and Close→Open (reopen) = new posting; edits while already Open keep original postedDate
    const becomingOpen = updateBody.status === 'Open' && previous.status !== 'Open';
    if (becomingOpen) {
        updateBody.postedDate = new Date();
    }

    const jobPosting = await Recruitment.findOneAndUpdate(
        { _id: id, organizationId },
        updateBody,
        { new: true, runValidators: true }
    );

    if ((becomingOpenInternal && !wasAlreadyNotifiedOpen) || req.body.forceNotify === true) {
        try {
            const { notifyEmployeesOfInternalJob } = await import('../../services/internalJobsService.js');
            await notifyEmployeesOfInternalJob(jobPosting, { force: req.body.forceNotify === true });
        } catch (e) {
            logger.warn('Internal job notify on update failed', { error: e.message });
        }
    }

    res.json({
        success: true,
        message: 'Job posting updated successfully',
        data: jobPosting
    });
});

/**
 * Soft-archive / restore job posting
 * @route POST /api/v1/admin/recruitment/jobs/:id/archive
 */
export const archiveJobPosting = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const restore = !!req.body.restore;

    const jobPosting = await Recruitment.findOneAndUpdate(
        { _id: id, organizationId },
        restore
            ? { archivedAt: null, isActive: true }
            : { archivedAt: new Date(), isActive: false, status: 'Closed' },
        { new: true }
    );

    if (!jobPosting) {
        return res.status(404).json({ success: false, message: 'Job posting not found' });
    }

    res.json({
        success: true,
        message: restore ? 'Job restored' : 'Job archived',
        data: jobPosting,
    });
});

/**
 * Delete job posting
 */
export const deleteJobPosting = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    // Soft-delete by default; hard delete only when ?hard=true and no candidates
    if (req.query.hard === 'true') {
        const candidateCount = await Candidate.countDocuments({ organizationId, jobPostingId: id });
        if (candidateCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Cannot hard-delete: ${candidateCount} candidate(s) linked. Archive instead.`,
            });
        }
        const jobPosting = await Recruitment.findOneAndDelete({ _id: id, organizationId });
        if (!jobPosting) {
            return res.status(404).json({ success: false, message: 'Job posting not found' });
        }
        return res.json({ success: true, message: 'Job posting permanently deleted' });
    }

    const jobPosting = await Recruitment.findOneAndUpdate(
        { _id: id, organizationId },
        { archivedAt: new Date(), isActive: false, status: 'Closed' },
        { new: true }
    );

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    res.json({
        success: true,
        message: 'Job posting archived (soft delete)',
        data: jobPosting
    });
});

/**
 * Apply for a job (Create candidate)
 */
export const applyForJob = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { jobPostingId } = req.params;

    // Check if job posting exists and is open
    const jobPosting = await Recruitment.findOne({
        _id: jobPostingId,
        organizationId,
        status: 'Open'
    });

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found or not accepting applications'
        });
    }

    const screeningDueAt = new Date();
    screeningDueAt.setDate(screeningDueAt.getDate() + 2);

    const consentAccepted = req.body.consentAccepted === true || req.body.consent?.accepted === true;
    const candidate = new Candidate({
        ...req.body,
        organizationId,
        jobPostingId,
        applicationDate: new Date(),
        screeningDueAt,
        primaryRecruiterId: jobPosting.primaryRecruiterId || jobPosting.recruiter,
        consent: consentAccepted
            ? {
                accepted: true,
                acceptedAt: new Date(),
                policyVersion: req.body.consent?.policyVersion || 'v1',
                ipAddress: req.ip,
            }
            : undefined,
    });

    await candidate.save();

    // Update job posting stats
    jobPosting.currentApplications = (jobPosting.currentApplications || 0) + 1;
    await jobPosting.save();

    res.status(201).json({
        success: true,
        message: 'Application submitted successfully',
        data: candidate
    });
});

/**
 * Get all candidates
 */
export const getCandidates = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const {
        jobPostingId, status, stage, page = 1, limit = 20, includeArchived, tag, recruiterId,
        screeningStatus, screeningDecision, matchMin, matchMax, q, searchRejected,
    } = req.query;

    const query = addOrganizationFilter(req, {});

    if (jobPostingId) query.jobPostingId = jobPostingId;
    if (status) query.status = status;
    if (stage) query.stage = stage;
    if (tag) query.tags = tag;
    if (recruiterId) query.primaryRecruiterId = recruiterId;
    if (includeArchived !== 'true') query.archivedAt = null;

    // Resume screening filters (additive)
    if (screeningStatus === 'pending' || screeningStatus === 'skipped') {
        query.$or = [
            { 'resumeScreening.status': 'pending' },
            { 'resumeScreening.status': 'skipped' },
            { resumeScreening: { $exists: false } },
            { 'resumeScreening.status': { $exists: false } },
        ];
    } else if (screeningStatus === 'passed' || screeningStatus === 'approved') {
        query['resumeScreening.status'] = 'passed';
    } else if (screeningStatus === 'failed' || screeningStatus === 'rejected') {
        query['resumeScreening.status'] = 'failed';
    }

    if (screeningDecision === 'approved' || screeningDecision === 'rejected') {
        query['resumeScreening.decision'] = screeningDecision;
    }

    if (searchRejected === 'true') {
        query['resumeScreening.status'] = 'failed';
        query.status = 'Rejected';
    }

    if (matchMin != null && matchMin !== '') {
        query['resumeScreening.matchScore'] = {
            ...(query['resumeScreening.matchScore'] || {}),
            $gte: Number(matchMin),
        };
    }
    if (matchMax != null && matchMax !== '') {
        query['resumeScreening.matchScore'] = {
            ...(query['resumeScreening.matchScore'] || {}),
            $lte: Number(matchMax),
        };
    }

    if (q && String(q).trim()) {
        const term = String(q).trim();
        const rx = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
        query.$and = [
            ...(query.$and || []),
            {
                $or: [
                    { firstName: rx },
                    { lastName: rx },
                    { email: rx },
                    { phone: rx },
                ],
            },
        ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const candidates = await Candidate.find(query)
        .populate('jobPostingId', 'jobTitle department tags')
        .populate('referredBy', 'name email')
        .populate('primaryRecruiterId', 'name email')
        .sort({ applicationDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

    const total = await Candidate.countDocuments(query);

    const { attachNormalizedScreening } = await import('../../services/resumeScreeningService.js');
    res.json({
        success: true,
        data: candidates.map((c) => attachNormalizedScreening(c)),
        pagination: {
            page: parseInt(page),
            limit: parseInt(limit),
            total,
            pages: Math.ceil(total / parseInt(limit))
        }
    });
});

/**
 * Get candidate by ID
 */
export const getCandidateById = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    })
        .populate('jobPostingId', 'jobTitle department tags screeningCriteria')
        .populate('referredBy', 'name email')
        .populate('interviewSchedule.interviewer', 'name lastName email')
        .populate('linkedEmployeeId', 'name lastName employeeId email department jobTitle');

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    // Normalize legacy skipped + conflicting decision without recomputing scores
    const { reconcileScreeningFields, attachNormalizedScreening } = await import('../../services/resumeScreeningService.js');
    const reconciled = reconcileScreeningFields(candidate.resumeScreening?.toObject?.() || candidate.resumeScreening || {});
    const before = candidate.resumeScreening?.status;
    const beforeDecision = candidate.resumeScreening?.decision;
    if (
        before !== reconciled.status
        || beforeDecision !== reconciled.decision
        || before === 'skipped'
    ) {
        candidate.resumeScreening.status = reconciled.status;
        candidate.resumeScreening.decision = reconciled.decision;
        if (reconciled.status === 'pending' && (candidate.status === 'Rejected' || candidate.stage === 'Rejected')) {
            // Pending screening must not keep a screening-only Rejected pipeline state
            if (candidate.resumeScreening?.reason || before === 'skipped' || beforeDecision === 'pending') {
                candidate.status = 'Applied';
                candidate.stage = 'Application';
            }
        }
        candidate.markModified('resumeScreening');
        await candidate.save();
    }

    res.json({
        success: true,
        data: attachNormalizedScreening(candidate)
    });
});

/**
 * Update candidate status
 */
export const updateCandidateStatus = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { status, stage, notes } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    });

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    const previousStatus = candidate.status;

    if (status) {
        candidate.status = status;
        const mappedStage = mapStatusToStage(status);
        if (mappedStage && !stage) candidate.stage = mappedStage;
    }
    if (stage) candidate.stage = stage;
    if (notes) {
        candidate.notes.push({
            note: notes,
            addedBy: req.user?._id || req.employee?._id,
            addedAt: new Date()
        });
    }

    if (req.body.primaryRecruiterId !== undefined) {
        candidate.assignmentHistory.push({
            field: 'primary',
            from: candidate.primaryRecruiterId,
            to: req.body.primaryRecruiterId || null,
            reason: req.body.assignmentReason || 'Reassigned',
            changedBy: req.employee?._id || req.user?._id,
            changedAt: new Date(),
        });
        candidate.primaryRecruiterId = req.body.primaryRecruiterId || null;
    }
    if (req.body.tags) candidate.tags = req.body.tags;
    if (req.body.poolMemberships) candidate.poolMemberships = req.body.poolMemberships;
    if (req.body.referralBonusStatus) candidate.referralBonusStatus = req.body.referralBonusStatus;

    // Allow HR to assign a real job posting from candidate detail / email prep (not the holding job).
    if (req.body.jobPostingId !== undefined && req.body.jobPostingId !== null && req.body.jobPostingId !== '') {
        const job = await Recruitment.findOne({
            _id: req.body.jobPostingId,
            organizationId,
            isActive: { $ne: false },
        });
        if (!job) {
            return res.status(400).json({ success: false, message: 'Job posting not found' });
        }
        const holdingTag = '__resume_inbox_holding__';
        if ((job.tags || []).includes(holdingTag) || /unassigned/i.test(job.jobTitle || '')) {
            return res.status(400).json({
                success: false,
                message: 'Please assign a real job posting, not the Resume Inbox holding job.',
            });
        }
        const prevJob = candidate.jobPostingId;
        candidate.jobPostingId = job._id;
        if (String(prevJob || '') !== String(job._id)) {
            candidate.notes.push({
                note: `Assigned to job "${job.jobTitle}"`,
                addedBy: req.user?._id || req.employee?._id,
                addedAt: new Date(),
            });
            candidate.tags = (candidate.tags || []).filter((t) => t !== 'Unassigned');
        }
    }

    await candidate.save();

    if (status && status !== previousStatus) {
        try {
            const { sendCandidateStatusEmail } = await import('../../services/internalJobsService.js');
            await sendCandidateStatusEmail(candidate, previousStatus);
        } catch (e) {
            logger.warn('Candidate status email skipped', { error: e.message });
        }
    }

    res.json({
        success: true,
        message: 'Candidate status updated successfully',
        data: candidate
    });
});

/**
 * Schedule interview
 */
export const scheduleInterview = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const {
        interviewType,
        scheduledDate,
        scheduledTime,
        location,
        meetingLink,
        interviewer,
    } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    }).populate('jobPostingId', 'jobTitle department');

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    if (!interviewer) {
        return res.status(400).json({
            success: false,
            message: 'Please select who will take the interview',
        });
    }

    if (scheduledDate) {
        const parts = String(scheduledDate).slice(0, 10).split('-').map(Number);
        const [y, m, d] = parts;
        if (y && m && d) {
            const weekday = new Date(y, m - 1, d).getDay(); // 0 = Sun, 6 = Sat
            if (weekday === 0 || weekday === 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Interviews cannot be scheduled on Saturday or Sunday',
                });
            }
        }
    }

    const feedbackDueAt = scheduledDate
        ? new Date(new Date(scheduledDate).getTime() + 24 * 60 * 60 * 1000)
        : undefined;

    candidate.interviewSchedule.push({
        interviewType,
        scheduledDate,
        scheduledTime,
        location,
        meetingLink,
        interviewer,
        status: 'Scheduled',
        feedbackDueAt,
    });

    if (candidate.stage === 'Application' || candidate.stage === 'Screening') {
        candidate.stage = 'Interview';
    }

    await candidate.save();

    const last = candidate.interviewSchedule[candidate.interviewSchedule.length - 1];

    // In-app notify the assigned interviewer only — do NOT email the candidate.
    // Interview invitation is sent only when HR clicks "Interview Invite" on Communications.
    try {
        const { notify } = await import('../../helpers/notificationManager.js');
        await notify({
            type: 'recruitment_interview_assigned',
            organizationId,
            recipients: [interviewer],
            data: {
                interviewerId: interviewer,
                candidate: {
                    _id: candidate._id,
                    firstName: candidate.firstName,
                    lastName: candidate.lastName,
                },
                interview: last,
                jobTitle: candidate.jobPostingId?.jobTitle,
            },
            senderId: req.employee?._id || req.user?._id,
        });
    } catch (e) {
        logger.warn('Interviewer notification skipped', { error: e.message });
    }

    const populated = await Candidate.findById(candidate._id)
        .populate('jobPostingId', 'jobTitle department')
        .populate('interviewSchedule.interviewer', 'name lastName email');

    res.json({
        success: true,
        message: 'Interview scheduled — interviewer notified in-app. Use Communication → Interview Invite to email the candidate.',
        data: populated
    });
});

/**
 * Get recruitment analytics (live)
 */
export const getRecruitmentAnalytics = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { startDate, endDate } = req.query;
    const orgOid = mongoose.Types.ObjectId.isValid(organizationId)
        ? new mongoose.Types.ObjectId(organizationId)
        : organizationId;

    const dateFilter = {};
    if (startDate || endDate) {
        dateFilter.createdAt = {};
        if (startDate) dateFilter.createdAt.$gte = new Date(startDate);
        if (endDate) dateFilter.createdAt.$lte = new Date(endDate);
    }

    const candMatch = { organizationId: orgOid, archivedAt: null, ...dateFilter };
    const jobMatch = { organizationId: orgOid, ...dateFilter };

    const [
        totalPostings,
        openPostings,
        totalCandidates,
        candidatesByStage,
        candidatesByStatus,
        timeToHireAgg,
        sourceStats,
        offerStats,
        interviewStats,
        monthlyHiring,
        jobBreakdown,
        recruiterPerf,
    ] = await Promise.all([
        Recruitment.countDocuments(jobMatch),
        Recruitment.countDocuments({ organizationId: orgOid, status: 'Open', isActive: { $ne: false }, archivedAt: null }),
        Candidate.countDocuments(candMatch),
        Candidate.aggregate([
            { $match: candMatch },
            { $group: { _id: '$stage', count: { $sum: 1 } } },
        ]),
        Candidate.aggregate([
            { $match: candMatch },
            { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        Candidate.aggregate([
            { $match: { ...candMatch, stage: 'Hired' } },
            {
                $project: {
                    days: {
                        $divide: [
                            { $subtract: ['$updatedAt', '$applicationDate'] },
                            86400000,
                        ],
                    },
                },
            },
            { $group: { _id: null, avgDays: { $avg: '$days' }, count: { $sum: 1 } } },
        ]),
        Candidate.aggregate([
            { $match: candMatch },
            { $group: { _id: '$source', count: { $sum: 1 }, hired: { $sum: { $cond: [{ $eq: ['$stage', 'Hired'] }, 1, 0] } } } },
            { $sort: { count: -1 } },
        ]),
        Candidate.aggregate([
            { $match: candMatch },
            {
                $group: {
                    _id: null,
                    offered: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['Offer Extended', 'Offer Accepted', 'Offer Declined']] }, 1, 0],
                        },
                    },
                    accepted: { $sum: { $cond: [{ $eq: ['$status', 'Offer Accepted'] }, 1, 0] } },
                    declined: { $sum: { $cond: [{ $eq: ['$status', 'Offer Declined'] }, 1, 0] } },
                },
            },
        ]),
        Candidate.aggregate([
            { $match: candMatch },
            { $unwind: { path: '$interviewSchedule', preserveNullAndEmptyArrays: false } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    completed: { $sum: { $cond: [{ $eq: ['$interviewSchedule.status', 'Completed'] }, 1, 0] } },
                    withFeedback: {
                        $sum: {
                            $cond: [{ $ifNull: ['$interviewSchedule.feedback.submittedAt', false] }, 1, 0],
                        },
                    },
                    strongHire: {
                        $sum: {
                            $cond: [{ $eq: ['$interviewSchedule.feedback.recommendation', 'Strong Hire'] }, 1, 0],
                        },
                    },
                    hireRec: {
                        $sum: {
                            $cond: [{ $in: ['$interviewSchedule.feedback.recommendation', ['Strong Hire', 'Hire']] }, 1, 0],
                        },
                    },
                },
            },
        ]),
        Candidate.aggregate([
            { $match: { organizationId: orgOid, stage: 'Hired', archivedAt: null } },
            {
                $group: {
                    _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } },
                    hires: { $sum: 1 },
                },
            },
            { $sort: { _id: 1 } },
            { $limit: 12 },
        ]),
        Candidate.aggregate([
            { $match: candMatch },
            {
                $group: {
                    _id: '$jobPostingId',
                    apps: { $sum: 1 },
                    interviewed: {
                        $sum: {
                            $cond: [{ $in: ['$stage', ['Interview', 'Offer', 'Hired']] }, 1, 0],
                        },
                    },
                    offers: {
                        $sum: {
                            $cond: [{ $in: ['$status', ['Offer Extended', 'Offer Accepted', 'Offer Declined']] }, 1, 0],
                        },
                    },
                    hired: { $sum: { $cond: [{ $eq: ['$stage', 'Hired'] }, 1, 0] } },
                },
            },
            {
                $lookup: {
                    from: 'recruitments',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'job',
                },
            },
            {
                $project: {
                    jobTitle: { $arrayElemAt: ['$job.jobTitle', 0] },
                    department: { $arrayElemAt: ['$job.department', 0] },
                    status: { $arrayElemAt: ['$job.status', 0] },
                    apps: 1,
                    interviewed: 1,
                    offers: 1,
                    hired: 1,
                    conversion: {
                        $cond: [
                            { $gt: ['$apps', 0] },
                            { $multiply: [{ $divide: ['$hired', '$apps'] }, 100] },
                            0,
                        ],
                    },
                },
            },
            { $sort: { apps: -1 } },
            { $limit: 20 },
        ]),
        Candidate.aggregate([
            { $match: { ...candMatch, primaryRecruiterId: { $ne: null } } },
            {
                $group: {
                    _id: '$primaryRecruiterId',
                    candidates: { $sum: 1 },
                    hired: { $sum: { $cond: [{ $eq: ['$stage', 'Hired'] }, 1, 0] } },
                },
            },
            {
                $lookup: {
                    from: 'employees',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'recruiter',
                },
            },
            {
                $project: {
                    name: {
                        $trim: {
                            input: {
                                $concat: [
                                    { $ifNull: [{ $arrayElemAt: ['$recruiter.name', 0] }, ''] },
                                    ' ',
                                    { $ifNull: [{ $arrayElemAt: ['$recruiter.lastName', 0] }, ''] },
                                ],
                            },
                        },
                    },
                    candidates: 1,
                    hired: 1,
                },
            },
            { $sort: { hired: -1 } },
            { $limit: 10 },
        ]),
    ]);

    const stageMap = Object.fromEntries((candidatesByStage || []).map((s) => [s._id, s.count]));
    const funnelOrder = ['Application', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];
    const funnel = funnelOrder.map((stage) => ({
        stage,
        count: stageMap[stage] || 0,
    }));
    const funnelBase = funnel[0]?.count || totalCandidates || 1;

    const offers = offerStats[0] || { offered: 0, accepted: 0, declined: 0 };
    const offerAcceptanceRate = offers.offered
        ? Math.round((offers.accepted / offers.offered) * 1000) / 10
        : 0;

    const interviews = interviewStats[0] || { total: 0, completed: 0, withFeedback: 0, strongHire: 0, hireRec: 0 };
    const interviewSuccessRate = interviews.withFeedback
        ? Math.round((interviews.hireRec / interviews.withFeedback) * 1000) / 10
        : 0;

    const avgTimeToHire = Math.round((timeToHireAgg[0]?.avgDays || 0) * 10) / 10;
    // Time to fill: avg days from job postedDate to first hire — approximate via hired candidates' application span
    const timeToFill = avgTimeToHire;

    res.json({
        success: true,
        data: {
            totalPostings,
            openPostings,
            totalCandidates,
            candidatesByStage,
            candidatesByStatus,
            funnel,
            funnelPct: funnel.map((f) => ({
                ...f,
                pct: Math.round((f.count / funnelBase) * 1000) / 10,
            })),
            averageTimeToHire: avgTimeToHire,
            averageTimeToFill: timeToFill,
            timeToHire: { avgTimeToHire: avgTimeToHire, count: timeToHireAgg[0]?.count || 0 },
            offerAcceptanceRate,
            offers,
            interviewSuccessRate,
            interviews,
            sourceStatistics: sourceStats,
            sourcePerformance: sourceStats,
            monthlyHiring,
            jobBreakdown,
            recruiterPerformance: recruiterPerf,
            avgTimeToFill: timeToFill,
        },
    });
});

/**
 * Calculate and update candidate scores
 * @route POST /api/v1/admin/recruitment/candidates/:id/score
 */
export const calculateCandidateScore = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { resumeScore, technicalScore, culturalFitScore } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    });

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    // Calculate overall score (weighted average)
    const weights = {
        resume: 0.3,
        technical: 0.4,
        cultural: 0.3
    };

    const overallScore = (
        (resumeScore || 0) * weights.resume +
        (technicalScore || 0) * weights.technical +
        (culturalFitScore || 0) * weights.cultural
    );

    candidate.scores = {
        resumeScore: resumeScore || candidate.scores?.resumeScore || 0,
        technicalScore: technicalScore || candidate.scores?.technicalScore || 0,
        culturalFitScore: culturalFitScore || candidate.scores?.culturalFitScore || 0,
        overallScore: overallScore || candidate.scores?.overallScore || 0
    };

    await candidate.save();

    res.json({
        success: true,
        message: 'Candidate score calculated successfully',
        data: candidate
    });
});

/**
 * Get candidate pipeline visualization
 * @route GET /api/v1/admin/recruitment/pipeline
 */
export const getCandidatePipeline = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { jobPostingId } = req.query;

    const pipeline = await getFullPipeline(organizationId, jobPostingId);

    res.json({
        success: true,
        data: pipeline
    });
});

/**
 * Get ranked candidates for a job posting
 * @route GET /api/v1/admin/recruitment/jobs/:id/candidates/ranked
 */
export const getRankedCandidates = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { limit = 20 } = req.query;

    const jobPosting = await Recruitment.findOne({
        _id: id,
        organizationId
    });

    if (!jobPosting) {
        return res.status(404).json({
            success: false,
            message: 'Job posting not found'
        });
    }

    const candidates = await Candidate.find({
        organizationId,
        jobPostingId: id
    })
        .populate('referredBy', 'name email')
        .sort({ 'scores.overallScore': -1, applicationDate: -1 })
        .limit(parseInt(limit))
        .lean();

    res.json({
        success: true,
        data: candidates
    });
});

/**
 * Generate offer letter data
 * @route POST /api/v1/admin/recruitment/candidates/:id/generate-offer
 */
export const generateOfferLetter = asyncHandler(async (req, res) => {
    const { id } = req.params;
    const organizationId = getOrganizationId(req);
    const { position, startDate, salary, benefits, expiryDays = 7 } = req.body;

    const candidate = await Candidate.findOne({
        _id: id,
        organizationId
    }).populate('jobPostingId');

    if (!candidate) {
        return res.status(404).json({
            success: false,
            message: 'Candidate not found'
        });
    }

    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + expiryDays);

    candidate.offerDetails = {
        position: position || candidate.jobPostingId?.jobTitle,
        startDate: startDate ? new Date(startDate) : new Date(),
        salary: salary || candidate.jobPostingId?.salaryRange?.max,
        benefits: benefits || [],
        offerLetter: {
            sentDate: new Date(),
            expiryDate: expiryDate,
            status: 'Draft'
        },
        status: 'Draft'
    };

    candidate.status = 'Offer Extended';
    candidate.stage = 'Offer';

    await candidate.save();

    res.json({
        success: true,
        message: 'Offer letter generated successfully',
        data: {
            candidate,
            offerDetails: candidate.offerDetails
        }
    });
});

/**
 * Recruiter workspace widgets
 * @route GET /api/v1/admin/recruitment/workspace
 */
async function resolveWorkspaceRecruiterId(req) {
    const sessionRole = String(req.user?.role || req.decoded?.role || '').toLowerCase();
    const viewAll =
        isOrgAdminRequest(req)
        || sessionRole === 'admin'
        || sessionRole === 'hr'
        || req.authContext?.isHrManager
        || req.authContext?.isHrExecutive
        || (req.employee && isHrStaffEmployee(req.employee))
        || (await loadRequesterHrStaff(req));

    if (viewAll) {
        return req.query.recruiterId || null;
    }
    return req.employee?._id || req.query.recruiterId || null;
}

export const getRecruiterWorkspace = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const recruiterId = await resolveWorkspaceRecruiterId(req);
    const data = await getWorkspaceSummary(organizationId, recruiterId);
    res.json({ success: true, data });
});

/**
 * Hire candidate → create Employee + login + onboarding
 * @route POST /api/v1/admin/recruitment/candidates/:id/hire
 * Body: optional hire fields (department, jobTitle, position, jobCategory, salary, managerId, joiningDate, ...)
 * Query/body createEmployee=false → ATS-only mark hired (legacy)
 */
export const hireCandidate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const actorId = req.employee?._id || req.user?._id;
    const createEmployee = req.body.createEmployee !== false && req.query.atsOnly !== 'true';

    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId })
        .populate('jobPostingId');
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (!createEmployee) {
        if (candidate.stage === 'Hired' && candidate.linkedEmployeeId) {
            return res.json({ success: true, message: 'Candidate already hired', data: candidate });
        }
        const updated = await markHired(candidate, actorId);
        return res.json({ success: true, message: 'Candidate marked as hired (ATS only)', data: updated });
    }

    try {
        const result = await convertCandidateToEmployee({
            candidate,
            organizationId,
            actorId,
            hirePayload: req.body,
        });
        return res.status(result.alreadyConverted ? 200 : 201).json({
            success: true,
            message: result.alreadyConverted
                ? 'Candidate already linked to an employee'
                : 'Employee created, login generated, and onboarding started',
            data: result,
        });
    } catch (err) {
        const status = err.status || 500;
        return res.status(status).json({
            success: false,
            code: err.code || 'HIRE_FAILED',
            message: err.message || 'Hire conversion failed',
        });
    }
});

/**
 * Suggested hire form defaults + enum lists
 * @route GET /api/v1/admin/recruitment/candidates/:id/hire-defaults
 */
export const getHireDefaults = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId })
        .populate('jobPostingId');
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    const job = candidate.jobPostingId;
    res.json({
        success: true,
        data: {
            defaults: suggestHireDefaults(candidate, job),
            enums: {
                departments: EMPLOYEE_DEPARTMENTS,
                jobTitles: EMPLOYEE_JOB_TITLES,
                positions: EMPLOYEE_POSITIONS,
                jobCategories: EMPLOYEE_JOB_CATEGORIES,
            },
            linkedEmployeeId: candidate.linkedEmployeeId || null,
        },
    });
});

/**
 * Confirm / delay / decline joining after offer accept
 * @route POST /api/v1/admin/recruitment/candidates/:id/joining
 */
export const updateJoiningStatus = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { joiningStatus, expectedJoiningDate, notes } = req.body;
    const allowed = ['Confirmed', 'Delayed', 'Declined'];
    if (!allowed.includes(joiningStatus)) {
        return res.status(400).json({ success: false, message: 'Invalid joiningStatus' });
    }

    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    candidate.joiningStatus = joiningStatus;
    if (expectedJoiningDate) candidate.expectedJoiningDate = new Date(expectedJoiningDate);
    if (joiningStatus === 'Declined') {
        const wasHired = candidate.stage === 'Hired';
        candidate.status = 'Withdrawn';
        candidate.stage = 'Rejected';
        candidate.withdrawnReason = notes || 'Did not join after offer acceptance';
        if (wasHired && candidate.jobPostingId) {
            await Recruitment.findByIdAndUpdate(candidate.jobPostingId, {
                $inc: { filledPositions: -1 },
            });
        }
    }
    if (notes) {
        candidate.notes.push({
            note: `Joining: ${joiningStatus}${notes ? ` — ${notes}` : ''}`,
            addedBy: req.employee?._id || req.user?._id,
            addedAt: new Date(),
        });
    }
    await candidate.save();
    res.json({ success: true, message: 'Joining status updated', data: candidate });
});

/**
 * Soft-archive candidate
 * @route POST /api/v1/admin/recruitment/candidates/:id/archive
 */
export const archiveCandidate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOneAndUpdate(
        { _id: req.params.id, organizationId },
        { archivedAt: req.body.restore ? null : new Date() },
        { new: true }
    );
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    res.json({
        success: true,
        message: req.body.restore ? 'Candidate restored' : 'Candidate archived',
        data: candidate,
    });
});

/**
 * Blacklist / unblacklist (non-destructive)
 * @route POST /api/v1/admin/recruitment/candidates/:id/blacklist
 */
export const blacklistCandidate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (req.body.clear) {
        candidate.blacklist = {
            isBlacklisted: false,
            reason: undefined,
            blacklistedBy: undefined,
            blacklistedAt: undefined,
            expiryDate: undefined,
        };
    } else {
        candidate.blacklist = {
            isBlacklisted: true,
            reason: req.body.reason || 'Blacklisted by HR',
            blacklistedBy: req.employee?._id || req.user?._id,
            blacklistedAt: new Date(),
            expiryDate: req.body.expiryDate ? new Date(req.body.expiryDate) : undefined,
        };
    }
    await candidate.save();
    res.json({ success: true, message: 'Blacklist updated', data: candidate });
});

/**
 * Candidate withdraw
 * @route POST /api/v1/admin/recruitment/candidates/:id/withdraw
 */
export const withdrawCandidate = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    candidate.status = 'Withdrawn';
    candidate.stage = 'Rejected';
    candidate.withdrawnReason = req.body.reason || 'Withdrawn';
    candidate.notes.push({
        note: `Withdrawn: ${candidate.withdrawnReason}`,
        addedBy: req.employee?._id || req.user?._id,
        addedAt: new Date(),
    });
    await candidate.save();
    res.json({ success: true, message: 'Candidate withdrawn', data: candidate });
});

/**
 * Log communication against candidate (HR-internal history only).
 * Does NOT send email/SMS/WhatsApp — use POST .../send-email for real outbound mail.
 * @route POST /api/v1/admin/recruitment/candidates/:id/communication
 */
export const logCandidateCommunication = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }
    const channel = req.body.channel || 'note';
    candidate.communications.push({
        channel,
        // Manual logs are HR records; direction stays inbound/outbound for timeline filters.
        direction: req.body.direction || 'outbound',
        subject: req.body.subject,
        body: req.body.body || req.body.notes,
        participants: req.body.participants || (candidate.email ? [candidate.email] : []),
        createdBy: req.employee?._id || req.user?._id,
        createdAt: new Date(),
        autoLogged: false,
    });
    await candidate.save();
    res.json({
        success: true,
        message: 'Communication logged (HR-only — nothing was sent to the candidate)',
        data: candidate,
    });
});

/**
 * Bulk update candidates (status/stage/tags/recruiter)
 * @route POST /api/v1/admin/recruitment/candidates/bulk
 */
export const bulkUpdateCandidates = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const { ids, status, stage, tags, primaryRecruiterId, notes } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ success: false, message: 'ids array is required' });
    }

    const candidates = await Candidate.find({ _id: { $in: ids }, organizationId });
    const actorId = req.employee?._id || req.user?._id;
    const results = [];
    const skipped = [];

    for (const candidate of candidates) {
        if (candidate.resumeScreening?.status === 'failed' || candidate.resumeScreening?.decision === 'rejected') {
            skipped.push({ id: candidate._id, reason: 'SCREENING_FAILED_READONLY' });
            continue;
        }
        if (status) {
            candidate.status = status;
            const mapped = mapStatusToStage(status);
            if (mapped && !stage) candidate.stage = mapped;
        }
        if (stage) candidate.stage = stage;
        if (tags) candidate.tags = tags;
        if (primaryRecruiterId !== undefined) {
            candidate.assignmentHistory.push({
                field: 'primary',
                from: candidate.primaryRecruiterId,
                to: primaryRecruiterId || null,
                reason: 'Bulk reassignment',
                changedBy: actorId,
                changedAt: new Date(),
            });
            candidate.primaryRecruiterId = primaryRecruiterId || null;
        }
        if (notes) {
            candidate.notes.push({ note: notes, addedBy: actorId, addedAt: new Date() });
        }
        await candidate.save();
        results.push({ id: candidate._id, status: candidate.status, stage: candidate.stage });
    }

    res.json({
        success: true,
        message: `Updated ${results.length} candidate(s)${skipped.length ? `, skipped ${skipped.length} (failed screening)` : ''}`,
        data: results,
        skipped,
    });
});

/**
 * Update interview status and/or submit interview feedback (HR/Admin/Executive).
 * Feedback is stored on the specific interviewSchedule entry.
 * Feedback submission requires interview status Completed (or status Completed in the same request).
 * @route PUT /api/v1/admin/recruitment/candidates/:id/interview/:interviewId
 */
export const updateInterviewFeedback = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    const interview = candidate.interviewSchedule.id(req.params.interviewId);
    if (!interview) {
        return res.status(404).json({ success: false, message: 'Interview not found' });
    }

    const {
        canAcceptFeedbackSubmission,
    } = await import('../../helpers/interviewFeedbackAccess.js');

    // Status-only update (e.g. Mark Completed) — no feedback payload
    if (req.body.status && req.body.feedback == null
        && req.body.interviewType == null
        && req.body.scheduledDate == null
        && req.body.scheduledTime == null
        && req.body.location == null
        && req.body.meetingLink == null
        && req.body.interviewer == null) {
        const allowed = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];
        if (!allowed.includes(req.body.status)) {
            return res.status(400).json({ success: false, message: 'Invalid interview status' });
        }
        interview.status = req.body.status;
        await candidate.save();
        return res.json({ success: true, message: 'Interview status updated', data: candidate });
    }

    // Allow completing / editing interview details (used by Communication email prep modal)
    const detailKeys = ['interviewType', 'scheduledDate', 'scheduledTime', 'location', 'meetingLink', 'interviewer'];
    const hasDetailPatch = detailKeys.some((k) => req.body[k] !== undefined);
    if (hasDetailPatch && req.body.feedback == null) {
        if (req.body.interviewType !== undefined) interview.interviewType = req.body.interviewType;
        if (req.body.scheduledDate !== undefined) {
            interview.scheduledDate = req.body.scheduledDate ? new Date(req.body.scheduledDate) : interview.scheduledDate;
        }
        if (req.body.scheduledTime !== undefined) interview.scheduledTime = req.body.scheduledTime;
        if (req.body.location !== undefined) interview.location = req.body.location;
        if (req.body.meetingLink !== undefined) interview.meetingLink = req.body.meetingLink;
        if (req.body.interviewer !== undefined && req.body.interviewer) {
            interview.interviewer = req.body.interviewer;
        }
        if (req.body.status) {
            const allowed = ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'];
            if (!allowed.includes(req.body.status)) {
                return res.status(400).json({ success: false, message: 'Invalid interview status' });
            }
            interview.status = req.body.status;
        } else if (interview.status === 'Cancelled') {
            interview.status = 'Scheduled';
        }
        await candidate.save();
        return res.json({ success: true, message: 'Interview details updated', data: candidate });
    }

    if (req.body.feedback) {
        if (!canAcceptFeedbackSubmission(interview, { nextStatus: req.body.status })) {
            return res.status(400).json({
                success: false,
                code: 'INTERVIEW_NOT_COMPLETED',
                message: 'Feedback can only be submitted after the interview is marked Completed',
            });
        }
        if (req.body.status) interview.status = req.body.status;
        else interview.status = 'Completed';

        interview.feedback = {
            ...(interview.feedback?.toObject?.() || interview.feedback || {}),
            ...req.body.feedback,
            submittedAt: new Date(),
        };
    } else if (req.body.status) {
        interview.status = req.body.status;
    }

    await candidate.save();
    res.json({ success: true, message: 'Interview updated', data: candidate });
});

/**
 * Public: list open external jobs for an organization
 * @route GET /api/v1/public/recruitment/:organizationId/jobs
 */
export const listPublicJobs = asyncHandler(async (req, res) => {
    const { organizationId } = req.params;
    const jobs = await Recruitment.find({
        organizationId,
        status: 'Open',
        isActive: true,
        externalVisible: { $ne: false },
    })
        .select('jobTitle department position location employmentType salaryRange postedDate closingDate jobDescription requirements responsibilities priority')
        .sort({ postedDate: -1 })
        .lean();

    res.json({ success: true, data: jobs });
});

/**
 * Public: get one open job
 * @route GET /api/v1/public/recruitment/:organizationId/jobs/:id
 */
export const getPublicJobById = asyncHandler(async (req, res) => {
    const { organizationId, id } = req.params;
    const job = await Recruitment.findOne({
        _id: id,
        organizationId,
        status: 'Open',
        isActive: true,
        externalVisible: { $ne: false },
    })
        .select('-createdBy -recruiter -hiringManager -primaryRecruiterId -backupRecruiterId -coordinatorId')
        .lean();

    if (!job) {
        return res.status(404).json({ success: false, message: 'Job not found' });
    }
    res.json({ success: true, data: job });
});

/**
 * Public: apply to a job (no auth)
 * @route POST /api/v1/public/recruitment/:organizationId/jobs/:id/apply
 */
export const publicApplyForJob = asyncHandler(async (req, res) => {
    const { organizationId, id: jobPostingId } = req.params;
    const { firstName, lastName, email, phone, coverLetter, coverLetterAttachment, resume, consentAccepted } = req.body;

    if (!firstName || !email) {
        return res.status(400).json({ success: false, message: 'firstName and email are required' });
    }
    if (!consentAccepted) {
        return res.status(400).json({ success: false, message: 'Consent is required to submit an application' });
    }

    const jobPosting = await Recruitment.findOne({
        _id: jobPostingId,
        organizationId,
        status: 'Open',
        isActive: true,
        externalVisible: { $ne: false },
    });
    if (!jobPosting) {
        return res.status(404).json({ success: false, message: 'Job posting not found or not accepting applications' });
    }

    const existingBlacklist = await Candidate.findOne({
        organizationId,
        email: String(email).toLowerCase().trim(),
        'blacklist.isBlacklisted': true,
        $or: [
            { 'blacklist.expiryDate': null },
            { 'blacklist.expiryDate': { $exists: false } },
            { 'blacklist.expiryDate': { $gt: new Date() } },
        ],
    }).select('_id').lean();

    const screeningDueAt = new Date();
    screeningDueAt.setDate(screeningDueAt.getDate() + 2);

    const candidate = new Candidate({
        organizationId,
        jobPostingId,
        firstName,
        lastName,
        email,
        phone,
        coverLetter,
        coverLetterAttachment: coverLetterAttachment?.url
            ? {
                url: coverLetterAttachment.url,
                fileName: coverLetterAttachment.fileName,
                mimeType: coverLetterAttachment.mimeType,
                uploadedAt: new Date(),
            }
            : undefined,
        resume: resume || undefined,
        source: 'Company Website',
        applicationDate: new Date(),
        screeningDueAt,
        primaryRecruiterId: jobPosting.primaryRecruiterId || jobPosting.recruiter,
        consent: {
            accepted: true,
            acceptedAt: new Date(),
            policyVersion: req.body.policyVersion || 'v1',
            ipAddress: req.ip,
        },
        notes: existingBlacklist
            ? [{ note: 'Auto-flagged: applicant matches an active blacklist record', addedAt: new Date() }]
            : [],
        tags: existingBlacklist ? ['Blacklist Flag'] : [],
    });

    const { issueSelfServiceToken, frontendBase } = await import('../../services/internalJobsService.js');
    const token = issueSelfServiceToken(candidate);
    await candidate.save();
    jobPosting.currentApplications = (jobPosting.currentApplications || 0) + 1;
    await jobPosting.save();

    const trackUrl = `${frontendBase()}/application/${token}`;

    res.status(201).json({
        success: true,
        message: existingBlacklist
            ? 'Application submitted and flagged for HR review'
            : 'Application submitted successfully',
        data: { id: candidate._id, flagged: !!existingBlacklist, trackUrl, selfServiceToken: token },
    });
});

