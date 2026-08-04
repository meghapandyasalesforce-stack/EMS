/**
 * Recruitment service — additive ATS helpers.
 * Isolated from other modules (no employee create / onboarding side-effects).
 */
import { Recruitment, Candidate } from '../models/recruitment.model.js';
import mongoose from 'mongoose';

const STAGE_ORDER = ['Application', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'];

export function mapStatusToStage(status) {
    const map = {
        Applied: 'Application',
        Screening: 'Screening',
        'Phone Interview': 'Interview',
        'Technical Interview': 'Interview',
        'Final Interview': 'Interview',
        'Offer Extended': 'Offer',
        'Offer Accepted': 'Offer',
        'Offer Declined': 'Rejected',
        Rejected: 'Rejected',
        Withdrawn: 'Rejected',
        'On Hold': 'Screening',
    };
    return map[status] || null;
}

export async function getWorkspaceSummary(organizationId, recruiterEmployeeId) {
    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const base = { organizationId: orgOid, archivedAt: null };
    const owned = recruiterEmployeeId
        ? {
            ...base,
            $or: [
                { primaryRecruiterId: recruiterEmployeeId },
                { backupRecruiterId: recruiterEmployeeId },
                { coordinatorId: recruiterEmployeeId },
            ],
        }
        : base;

    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);
    const weekEnd = new Date(now);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const [
        pendingScreening,
        interviewsToday,
        pendingFeedback,
        offerAccepted,
        joiningThisWeek,
        overdueScreening,
        openJobs,
        totalCandidates,
    ] = await Promise.all([
        Candidate.find({ ...owned, stage: { $in: ['Application', 'Screening'] }, status: { $nin: ['Rejected', 'Withdrawn'] } })
            .select('firstName lastName status stage applicationDate jobPostingId')
            .populate('jobPostingId', 'jobTitle')
            .sort({ applicationDate: 1 })
            .limit(20)
            .lean(),
        Candidate.find({
            ...owned,
            'interviewSchedule.scheduledDate': { $gte: startOfDay, $lte: endOfDay },
            'interviewSchedule.status': 'Scheduled',
        })
            .select('firstName lastName interviewSchedule jobPostingId')
            .populate('jobPostingId', 'jobTitle')
            .limit(20)
            .lean(),
        Candidate.find({
            ...owned,
            interviewSchedule: {
                $elemMatch: {
                    status: 'Completed',
                    'feedback.submittedAt': { $exists: false },
                },
            },
        })
            .select('firstName lastName interviewSchedule jobPostingId')
            .populate('jobPostingId', 'jobTitle')
            .limit(20)
            .lean(),
        Candidate.find({ ...owned, status: 'Offer Accepted', joiningStatus: { $in: ['None', null] } })
            .select('firstName lastName status expectedJoiningDate jobPostingId')
            .populate('jobPostingId', 'jobTitle')
            .limit(20)
            .lean(),
        Candidate.find({
            ...owned,
            expectedJoiningDate: { $gte: startOfDay, $lte: weekEnd },
            joiningStatus: { $ne: 'Declined' },
        })
            .select('firstName lastName expectedJoiningDate joiningStatus jobPostingId')
            .populate('jobPostingId', 'jobTitle')
            .limit(20)
            .lean(),
        Candidate.countDocuments({
            ...owned,
            screeningDueAt: { $lt: now },
            stage: { $in: ['Application', 'Screening'] },
            status: { $nin: ['Rejected', 'Withdrawn'] },
        }),
        Recruitment.countDocuments({ organizationId: orgOid, status: 'Open', isActive: true }),
        Candidate.countDocuments({ ...base, status: { $nin: ['Rejected', 'Withdrawn'] } }),
    ]);

    return {
        counts: {
            pendingScreening: pendingScreening.length,
            interviewsToday: interviewsToday.length,
            pendingFeedback: pendingFeedback.length,
            awaitingJoiningConfirm: offerAccepted.length,
            joiningThisWeek: joiningThisWeek.length,
            overdueScreening,
            openJobs,
            totalCandidates,
        },
        widgets: {
            pendingScreening,
            interviewsToday,
            pendingFeedback,
            awaitingJoiningConfirm: offerAccepted,
            joiningThisWeek,
        },
    };
}

export async function getFullPipeline(organizationId, jobPostingId) {
    const matchQuery = {
        organizationId: new mongoose.Types.ObjectId(organizationId),
        archivedAt: null,
    };
    if (jobPostingId) {
        matchQuery.jobPostingId = new mongoose.Types.ObjectId(jobPostingId);
    }

    const grouped = await Candidate.aggregate([
        { $match: matchQuery },
        {
            $lookup: {
                from: 'recruitments',
                localField: 'jobPostingId',
                foreignField: '_id',
                as: 'job',
            },
        },
        {
            $group: {
                _id: '$stage',
                count: { $sum: 1 },
                candidates: {
                    $push: {
                        id: '$_id',
                        firstName: '$firstName',
                        lastName: '$lastName',
                        name: { $concat: ['$firstName', ' ', '$lastName'] },
                        email: '$email',
                        status: '$status',
                        stage: '$stage',
                        source: '$source',
                        overallScore: '$scores.overallScore',
                        applicationDate: '$applicationDate',
                        jobTitle: { $arrayElemAt: ['$job.jobTitle', 0] },
                        jobPostingId: '$jobPostingId',
                        tags: '$tags',
                        hasResume: {
                            $cond: [{ $gt: [{ $strLenCP: { $ifNull: ['$resume.url', ''] } }, 0] }, true, false],
                        },
                        hasCoverLetter: {
                            $or: [
                                { $gt: [{ $strLenCP: { $ifNull: ['$coverLetterAttachment.url', ''] } }, 0] },
                                { $gt: [{ $strLenCP: { $ifNull: ['$coverLetter', ''] } }, 0] },
                            ],
                        },
                    },
                },
            },
        },
    ]);

    const byStage = Object.fromEntries(grouped.map((g) => [g._id, g]));
    return STAGE_ORDER.map((stage) => ({
        stage,
        count: byStage[stage]?.count || 0,
        candidates: (byStage[stage]?.candidates || []).sort((a, b) => {
            const scoreDiff = (b.overallScore || 0) - (a.overallScore || 0);
            if (scoreDiff !== 0) return scoreDiff;
            return new Date(b.applicationDate) - new Date(a.applicationDate);
        }),
    }));
}

export async function markHired(candidate, actorId) {
    candidate.stage = 'Hired';
    if (candidate.status !== 'Offer Accepted') {
        candidate.status = 'Offer Accepted';
    }
    if (candidate.joiningStatus === 'None') {
        candidate.joiningStatus = 'Confirmed';
    }
    candidate.notes.push({
        note: 'Marked as Hired',
        addedBy: actorId,
        addedAt: new Date(),
    });
    await candidate.save();

    if (candidate.jobPostingId) {
        await Recruitment.findByIdAndUpdate(candidate.jobPostingId, {
            $inc: { filledPositions: 1 },
        });
    }
    return candidate;
}

export { STAGE_ORDER };
