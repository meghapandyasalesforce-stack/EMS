/**
 * Authenticated employee / manager recruitment endpoints.
 */
import asyncHandler from '../../middlewares/asyncHandler.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import {
    listInternalJobs,
    getInternalJob,
    employeeApplyOrRefer,
    listMyReferrals,
    listMyInternalApplications,
} from '../../services/internalJobsService.js';
import {
    createRequisition,
} from './recruitmentP1Controller.js';
import { JobRequisition, Candidate } from '../../models/recruitment.model.js';
import { isOrgAdminRequest, isHrStaffEmployee } from '../../helpers/functionalRolesHelper.js';

function requireEmployee(req, res) {
    if (!req.employee?._id) {
        res.status(403).json({ success: false, message: 'Employee profile required' });
        return null;
    }
    return req.employee;
}

function canViewAllRequisitions(req) {
    const sessionRole = String(req.user?.role || req.decoded?.role || '').toLowerCase();
    if (isOrgAdminRequest(req) || sessionRole === 'admin' || sessionRole === 'hr') {
        return true;
    }
    if (req.authContext?.isHrManager || req.authContext?.isHrExecutive) {
        return true;
    }
    if (req.employee && isHrStaffEmployee(req.employee)) {
        return true;
    }
    return false;
}

export const getInternalJobs = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const jobs = await listInternalJobs(organizationId);
    res.json({ success: true, data: jobs });
});

export const getInternalJobById = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const job = await getInternalJob(organizationId, req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job not found' });
    res.json({ success: true, data: job });
});

export const postInternalApply = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    try {
        const result = await employeeApplyOrRefer({
            organizationId,
            jobPostingId: req.params.id,
            employee,
            mode: 'apply',
            candidatePayload: req.body,
        });
        const already = !!result.alreadyApplied;
        res.status(already ? 200 : 201).json({
            success: true,
            alreadyApplied: already,
            message: already
                ? 'You already applied to this job — it is now linked to My Applications'
                : 'Application submitted',
            data: result.candidate,
        });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, message: err.message });
    }
});

export const postInternalRefer = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    try {
        const result = await employeeApplyOrRefer({
            organizationId,
            jobPostingId: req.params.id,
            employee,
            mode: 'refer',
            candidatePayload: req.body,
        });
        res.status(201).json({
            success: true,
            message: 'Referral submitted — candidate invited by email',
            data: result.candidate,
        });
    } catch (err) {
        res.status(err.status || 500).json({ success: false, message: err.message });
    }
});

export const getMyReferrals = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    const data = await listMyReferrals(organizationId, employee._id);
    res.json({ success: true, data });
});

export const getMyApplications = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    const data = await listMyInternalApplications(organizationId, employee._id, employee.email);
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.json({ success: true, data });
});

/** Interviews assigned to the logged-in employee as interviewer */
export const getMyAssignedInterviews = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);

    const candidates = await Candidate.find({
        organizationId,
        archivedAt: null,
        'interviewSchedule.interviewer': employee._id,
    })
        .populate('jobPostingId', 'jobTitle department location')
        .select('firstName lastName email phone status stage interviewSchedule jobPostingId')
        .sort({ updatedAt: -1 })
        .lean();

    const interviews = [];
    for (const c of candidates) {
        for (const iv of c.interviewSchedule || []) {
            if (String(iv.interviewer) !== String(employee._id)) continue;
            interviews.push({
                interviewId: iv._id,
                interviewType: iv.interviewType,
                scheduledDate: iv.scheduledDate,
                scheduledTime: iv.scheduledTime,
                location: iv.location,
                meetingLink: iv.meetingLink,
                status: iv.status,
                feedback: iv.feedback,
                candidate: {
                    id: c._id,
                    name: [c.firstName, c.lastName].filter(Boolean).join(' '),
                    email: c.email,
                    phone: c.phone,
                    status: c.status,
                    stage: c.stage,
                },
                job: c.jobPostingId
                    ? {
                        id: c.jobPostingId._id,
                        jobTitle: c.jobPostingId.jobTitle,
                        department: c.jobPostingId.department,
                        location: c.jobPostingId.location,
                    }
                    : null,
            });
        }
    }

    interviews.sort((a, b) => {
        const da = a.scheduledDate ? new Date(a.scheduledDate).getTime() : 0;
        const db = b.scheduledDate ? new Date(b.scheduledDate).getTime() : 0;
        return db - da;
    });

    res.json({ success: true, data: interviews });
});

/**
 * Assigned interviewer marks their interview Completed.
 * Feedback form becomes available only after this (or HR marks Completed).
 */
export const markMyInterviewCompleted = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    const { id, interviewId } = req.params;

    const {
        isAssignedInterviewer,
        isInterviewCompleted,
    } = await import('../../helpers/interviewFeedbackAccess.js');

    const candidate = await Candidate.findOne({ _id: id, organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const interview = candidate.interviewSchedule.id(interviewId);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    if (!isAssignedInterviewer(interview, employee._id)) {
        return res.status(403).json({
            success: false,
            code: 'NOT_ASSIGNED_INTERVIEWER',
            message: 'Only the assigned interviewer can mark this interview completed',
        });
    }

    if (isInterviewCompleted(interview)) {
        return res.json({ success: true, message: 'Interview already completed', data: { status: interview.status } });
    }

    if (interview.status === 'Cancelled') {
        return res.status(400).json({ success: false, message: 'Cancelled interviews cannot be completed' });
    }

    interview.status = 'Completed';
    await candidate.save();
    res.json({ success: true, message: 'Interview marked Completed', data: { status: 'Completed' } });
});

/**
 * Assigned interviewer submits feedback for a Completed interview only.
 */
export const submitMyInterviewFeedback = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    const { id, interviewId } = req.params;

    const {
        isAssignedInterviewer,
        isInterviewCompleted,
        hasSubmittedFeedback,
    } = await import('../../helpers/interviewFeedbackAccess.js');

    const candidate = await Candidate.findOne({ _id: id, organizationId });
    if (!candidate) return res.status(404).json({ success: false, message: 'Candidate not found' });

    const interview = candidate.interviewSchedule.id(interviewId);
    if (!interview) return res.status(404).json({ success: false, message: 'Interview not found' });

    if (!isAssignedInterviewer(interview, employee._id)) {
        return res.status(403).json({
            success: false,
            code: 'NOT_ASSIGNED_INTERVIEWER',
            message: 'Only the assigned interviewer can submit feedback for this interview',
        });
    }

    if (!isInterviewCompleted(interview)) {
        return res.status(400).json({
            success: false,
            code: 'INTERVIEW_NOT_COMPLETED',
            message: 'Feedback can only be submitted after the interview is marked Completed',
        });
    }

    if (hasSubmittedFeedback(interview) && !req.body.forceEdit) {
        return res.status(409).json({
            success: false,
            code: 'FEEDBACK_ALREADY_SUBMITTED',
            message: 'Feedback already submitted for this interview',
        });
    }

    const fb = req.body.feedback || req.body;
    interview.feedback = {
        rating: Number(fb.rating) || 0,
        technical: Number(fb.technical) || 0,
        communication: Number(fb.communication) || 0,
        behaviour: Number(fb.behaviour) || 0,
        recommendation: fb.recommendation || 'Hire',
        comments: fb.comments || '',
        strengths: Array.isArray(fb.strengths) ? fb.strengths : (interview.feedback?.strengths || []),
        weaknesses: Array.isArray(fb.weaknesses) ? fb.weaknesses : (interview.feedback?.weaknesses || []),
        submittedAt: new Date(),
    };
    await candidate.save();

    res.json({
        success: true,
        message: 'Feedback submitted',
        data: {
            interviewId: interview._id,
            status: interview.status,
            feedback: interview.feedback,
        },
    });
});

/** Managers create hiring need (requisition) — same model as HR */
export const managerCreateRequisition = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    // Reuse create by setting body requestedBy
    req.body.requestedBy = employee._id;
    req.body.hiringManager = req.body.hiringManager || employee._id;
    return createRequisition(req, res);
});

export const managerListMyRequisitions = asyncHandler(async (req, res) => {
    const organizationId = getOrganizationId(req);
    const viewAll = canViewAllRequisitions(req);
    const employee = req.employee;

    if (!viewAll && !employee?._id) {
        res.status(403).json({ success: false, message: 'Employee profile required' });
        return;
    }

    const query = { organizationId };
    if (!viewAll) {
        query.requestedBy = employee._id;
    }

    const items = await JobRequisition.find(query)
        .populate('requestedBy', 'name lastName email')
        .populate('hiringManager', 'name lastName email')
        .populate('jobPostingId', 'jobTitle status')
        .sort({ createdAt: -1 })
        .lean();
    res.json({ success: true, data: items });
});

export const managerSubmitRequisition = asyncHandler(async (req, res) => {
    const employee = requireEmployee(req, res);
    if (!employee) return;
    const organizationId = getOrganizationId(req);
    const item = await JobRequisition.findOne({
        _id: req.params.id,
        organizationId,
        requestedBy: employee._id,
    });
    if (!item) return res.status(404).json({ success: false, message: 'Requisition not found' });
    if (!['Draft', 'Rejected'].includes(item.status)) {
        return res.status(400).json({ success: false, message: 'Cannot submit in current status' });
    }
    item.status = 'PendingApproval';
    if (!Array.isArray(item.notes)) item.notes = [];
    item.notes.push({ note: 'Submitted by manager', addedBy: employee._id, addedAt: new Date() });
    await item.save();
    res.json({ success: true, message: 'Submitted for HR approval', data: item });
});
