/**
 * P1 recruitment extras: requisitions, calendar, assessments, email actions.
 * Kept separate so core recruitmentController stays smaller.
 */
import { Recruitment, Candidate, JobRequisition } from '../../models/recruitment.model.js';
import { OfferLetter } from '../../models/lifecycleGap.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    sendInterviewInvite,
    sendInterviewReminder,
    sendOfferReminder,
    sendJoiningReminder,
    isValidEmailAddress,
    pickInterviewForEmail,
    validateInterviewForInvite,
    validateInterviewForReminder,
    validateOfferForReminder,
    validateJoiningForReminder,
    validateRealJobForEmail,
    findRecentCommunication,
} from '../../services/recruitmentEmailService.js';

export const createRequisition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const reqn = await JobRequisition.create({
        ...req.body,
        organizationId,
        requestedBy: req.employee?._id || req.body.requestedBy,
        status: 'Draft',
    });
    res.status(201).json({ success: true, message: 'Requisition created', data: reqn });
});

export const listRequisitions = asyncHandler(async (req, res) => {
    const query = addOrganizationFilter(req, {});
    if (req.query.status) query.status = req.query.status;
    const items = await JobRequisition.find(query)
        .populate('hiringManager', 'name lastName email')
        .populate('requestedBy', 'name lastName email')
        .populate('approvedBy', 'name lastName email')
        .populate('jobPostingId', 'jobTitle status')
        .sort({ createdAt: -1 })
        .lean();
    res.json({ success: true, data: items });
});

export const getRequisitionById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({ _id: req.params.id, organizationId })
        .populate('hiringManager', 'name lastName email')
        .populate('requestedBy', 'name lastName email')
        .populate('approvedBy', 'name lastName email')
        .populate('jobPostingId');
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    res.json({ success: true, data: item });
});

export const updateRequisition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({ _id: req.params.id, organizationId });
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    if (!['Draft', 'Rejected'].includes(item.status)) {
        return res.status(400).json({ success: false, message: 'Only Draft/Rejected requisitions can be edited' });
    }
    Object.assign(item, req.body, { status: item.status === 'Rejected' ? 'Draft' : item.status });
    await item.save();
    res.json({ success: true, data: item });
});

export const submitRequisition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({ _id: req.params.id, organizationId });
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    if (!['Draft', 'Rejected'].includes(item.status)) {
        return res.status(400).json({ success: false, message: 'Cannot submit in current status' });
    }
    item.status = 'PendingApproval';
    item.notes.push({
        note: 'Submitted for approval',
        addedBy: req.employee?._id,
        addedAt: new Date(),
    });
    await item.save();
    res.json({ success: true, message: 'Submitted for approval', data: item });
});

export const approveRequisition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({ _id: req.params.id, organizationId });
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    if (item.status !== 'PendingApproval') {
        return res.status(400).json({ success: false, message: 'Requisition is not pending approval' });
    }
    item.status = 'Approved';
    item.approvedBy = req.employee?._id;
    item.approvedAt = new Date();
    item.notes.push({ note: req.body.notes || 'Approved', addedBy: req.employee?._id, addedAt: new Date() });
    await item.save();
    res.json({ success: true, message: 'Requisition approved', data: item });
});

export const rejectRequisition = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({ _id: req.params.id, organizationId });
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    if (item.status !== 'PendingApproval') {
        return res.status(400).json({ success: false, message: 'Requisition is not pending approval' });
    }
    item.status = 'Rejected';
    item.rejectionReason = req.body.reason || 'Rejected';
    item.notes.push({ note: `Rejected: ${item.rejectionReason}`, addedBy: req.employee?._id, addedAt: new Date() });
    await item.save();
    res.json({ success: true, message: 'Requisition rejected', data: item });
});

export const convertRequisitionToJob = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({ _id: req.params.id, organizationId });
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    if (item.status !== 'Approved') {
        return res.status(400).json({ success: false, message: 'Only approved requisitions can be converted' });
    }
    if (item.jobPostingId) {
        return res.status(400).json({ success: false, message: 'Already converted to a job posting' });
    }

    const job = await Recruitment.create({
        organizationId,
        jobTitle: item.title,
        department: item.department,
        position: item.position,
        jobDescription: item.jobDescription,
        location: item.location,
        employmentType: item.employmentType,
        numberOfPositions: item.numberOfPositions,
        priority: item.priority,
        salaryRange: item.salaryRange,
        hiringManager: item.hiringManager,
        status: req.body.status || 'Draft',
        externalVisible: true,
        createdBy: req.user?._id || req.employee?._id,
    });

    item.status = 'Converted';
    item.jobPostingId = job._id;
    item.notes.push({ note: `Converted to job ${job._id}`, addedBy: req.employee?._id, addedAt: new Date() });
    await item.save();

    res.status(201).json({
        success: true,
        message: 'Job posting created from requisition',
        data: { requisition: item, job },
    });
});

export const getRecruitmentCalendar = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const from = req.query.from ? new Date(req.query.from) : new Date(new Date().setDate(1));
    const to = req.query.to ? new Date(req.query.to) : new Date(new Date().setMonth(new Date().getMonth() + 2));

    const candidates = await Candidate.find({
        organizationId,
        archivedAt: null,
        $or: [
            { 'interviewSchedule.scheduledDate': { $gte: from, $lte: to } },
            { expectedJoiningDate: { $gte: from, $lte: to } },
        ],
    })
        .select('firstName lastName email interviewSchedule expectedJoiningDate jobPostingId joiningStatus')
        .populate('jobPostingId', 'jobTitle')
        .lean();

    const events = [];
    for (const c of candidates) {
        const name = `${c.firstName || ''} ${c.lastName || ''}`.trim();
        for (const iv of c.interviewSchedule || []) {
            if (!iv.scheduledDate) continue;
            const d = new Date(iv.scheduledDate);
            if (d < from || d > to) continue;
            events.push({
                id: `iv-${c._id}-${iv._id}`,
                type: 'interview',
                title: `${iv.interviewType || 'Interview'} — ${name}`,
                date: iv.scheduledDate,
                time: iv.scheduledTime,
                status: iv.status,
                candidateId: c._id,
                jobTitle: c.jobPostingId?.jobTitle,
                meetingLink: iv.meetingLink,
            });
        }
        if (c.expectedJoiningDate) {
            const d = new Date(c.expectedJoiningDate);
            if (d >= from && d <= to) {
                events.push({
                    id: `join-${c._id}`,
                    type: 'joining',
                    title: `Joining — ${name}`,
                    date: c.expectedJoiningDate,
                    status: c.joiningStatus,
                    candidateId: c._id,
                    jobTitle: c.jobPostingId?.jobTitle,
                });
            }
        }
    }

    const offers = await OfferLetter.find({
        organizationId,
        expiryDate: { $gte: from, $lte: to },
        status: { $in: ['Sent', 'Viewed', 'Approved', 'Draft', 'Countered'] },
    })
        .select('position expiryDate status candidateId')
        .populate('candidateId', 'firstName lastName')
        .lean();

    for (const o of offers) {
        const cname = o.candidateId
            ? `${o.candidateId.firstName || ''} ${o.candidateId.lastName || ''}`.trim()
            : 'Candidate';
        events.push({
            id: `offer-${o._id}`,
            type: 'offer_expiry',
            title: `Offer expires — ${o.position || ''} (${cname})`,
            date: o.expiryDate,
            status: o.status,
            candidateId: o.candidateId?._id || o.candidateId,
        });
    }

    events.sort((a, b) => new Date(a.date) - new Date(b.date));
    res.json({
        success: true,
        data: {
            from,
            to,
            events,
            integrations: {
                googleCalendar: { connected: false, note: 'Connect in Settings (Phase P1+)' },
                outlook: { connected: false, note: 'Connect in Settings (Phase P1+)' },
                teams: { connected: false, note: 'Connect in Settings (Phase P1+)' },
            },
        },
    });
});

export const assignAssessment = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const assessment = {
        type: req.body.type || 'MCQ',
        title: req.body.title || `${req.body.type || 'MCQ'} Assessment`,
        status: 'Assigned',
        maxScore: req.body.maxScore || 100,
        dueAt: req.body.dueAt ? new Date(req.body.dueAt) : undefined,
        notes: req.body.notes,
        assignedBy: req.employee?._id,
        createdAt: new Date(),
    };
    candidate.assessments.push(assessment);
    await candidate.save();
    res.status(201).json({ success: true, message: 'Assessment assigned', data: candidate.assessments });
});

export const updateAssessment = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });
    const assessment = candidate.assessments.id(req.params.assessmentId);
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });

    if (req.body.status) assessment.status = req.body.status;
    if (req.body.score != null) assessment.score = Number(req.body.score);
    if (req.body.resultUrl) assessment.resultUrl = req.body.resultUrl;
    if (req.body.notes) assessment.notes = req.body.notes;
    if (req.body.status === 'Completed') assessment.completedAt = new Date();
    await candidate.save();
    res.json({ success: true, data: assessment });
});

/**
 * Explicit HR-triggered recruitment emails only.
 * Creating interviews / offers / joining records must NOT call this.
 */
export const sendCandidateEmail = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const candidate = await Candidate.findOne({ _id: req.params.id, organizationId })
        .populate('jobPostingId', 'jobTitle location tags');
    if (!candidate) {
        return res.status(404).json({ success: false, message: 'Candidate not found' });
    }

    if (!isValidEmailAddress(candidate.email)) {
        return res.status(400).json({
            success: false,
            message: 'Candidate has no valid email address. Add an email before sending.',
        });
    }

    const type = req.body.type || 'custom';
    const actorId = req.employee?._id;
    const confirmResend = Boolean(req.body.confirmResend);

    const EMAIL_TYPE_LABELS = {
        interview_invite: 'Interview Invite',
        interview_reminder: 'Interview Reminder',
        offer_reminder: 'Offer Reminder',
        joining_reminder: 'Joining Reminder',
    };

    if (!EMAIL_TYPE_LABELS[type]) {
        return res.status(400).json({ success: false, message: 'Unknown email type' });
    }

    // Holding job "Unassigned (Resume Inbox)" must never appear in candidate-facing emails.
    const jobCheck = validateRealJobForEmail(candidate);
    if (!jobCheck.ok) {
        return res.status(400).json({ success: false, message: jobCheck.message });
    }
    const jobTitle = jobCheck.jobTitle;

    const recent = findRecentCommunication(candidate, type);
    if (recent && !confirmResend) {
        const when = recent.createdAt
            ? new Date(recent.createdAt).toLocaleString('en-IN')
            : 'recently';
        return res.status(409).json({
            success: false,
            needsConfirmation: true,
            message: `A ${EMAIL_TYPE_LABELS[type]} was already sent ${when}. Send again?`,
            data: { type, lastSentAt: recent.createdAt },
        });
    }

    try {
        if (type === 'interview_invite') {
            const interview = pickInterviewForEmail(candidate, req.body.interviewId);
            const check = validateInterviewForInvite(interview, { meetingLinkOverride: req.body.meetingLink });
            if (!check.ok) {
                return res.status(400).json({ success: false, message: check.message });
            }
            await sendInterviewInvite({
                candidate,
                interview,
                meetingLink: req.body.meetingLink,
                actorId,
                jobTitle,
            });
        } else if (type === 'interview_reminder') {
            const interview = pickInterviewForEmail(candidate, req.body.interviewId);
            const check = validateInterviewForReminder(interview);
            if (!check.ok) {
                return res.status(400).json({ success: false, message: check.message });
            }
            await sendInterviewReminder({ candidate, interview, actorId, jobTitle });
        } else if (type === 'offer_reminder') {
            const offer = await OfferLetter.findOne({
                organizationId,
                candidateId: candidate._id,
                status: { $in: ['Sent', 'Viewed'] },
            }).sort({ sentAt: -1 });
            const check = validateOfferForReminder(offer);
            if (!check.ok) {
                return res.status(400).json({ success: false, message: check.message });
            }
            const base = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
            await sendOfferReminder({
                candidate,
                offer,
                portalUrl: `${base.replace(/\/$/, '')}/offer/${offer.portalToken}`,
                actorId,
                jobTitle,
            });
        } else if (type === 'joining_reminder') {
            const check = validateJoiningForReminder(candidate);
            if (!check.ok) {
                return res.status(400).json({ success: false, message: check.message });
            }
            await sendJoiningReminder({
                candidate,
                joiningDate: candidate.expectedJoiningDate,
                actorId,
                jobTitle,
                reportingLocation: candidate.jobPostingId?.location || undefined,
                reportingTime: req.body.reportingTime || undefined,
            });
        }
    } catch (err) {
        return res.status(err.status || 500).json({
            success: false,
            message: err.message || 'Failed to send email',
        });
    }

    // One real email to candidate.email + one auto-logged timeline record (inside send helpers).
    res.json({
        success: true,
        message: `Email sent to ${candidate.email} and logged to the HR communication timeline`,
        data: { to: candidate.email, type, jobTitle },
    });
});
