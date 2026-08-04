/**
 * Public candidate self-service (tokenized application portal).
 */
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    getApplicationBySelfServiceToken,
    getOfferSummaryForCandidate,
    updateSelfServiceApplication,
} from '../../services/internalJobsService.js';

export const getSelfServiceApplication = asyncHandler(async (req, res) => {
    const data = await getApplicationBySelfServiceToken(req.params.token);
    if (!data) {
        return res.status(404).json({ success: false, message: 'Application link invalid or expired' });
    }

    let offer = null;
    try {
        offer = await getOfferSummaryForCandidate(data._id);
    } catch {
        offer = null;
    }

    // Minimal safe payload
    res.json({
        success: true,
        data: {
            firstName: data.firstName,
            lastName: data.lastName,
            email: data.email,
            phone: data.phone,
            status: data.status,
            stage: data.stage,
            coverLetter: data.coverLetter,
            coverLetterAttachment: data.coverLetterAttachment
                ? { fileName: data.coverLetterAttachment.fileName, uploadedAt: data.coverLetterAttachment.uploadedAt, url: data.coverLetterAttachment.url }
                : null,
            resume: data.resume,
            applicationDate: data.applicationDate,
            job: data.jobPostingId,
            interviewSchedule: (data.interviewSchedule || []).map((i) => ({
                interviewType: i.interviewType,
                scheduledDate: i.scheduledDate,
                scheduledTime: i.scheduledTime,
                status: i.status,
                meetingLink: i.meetingLink,
            })),
            offer,
        },
    });
});

export const postSelfServiceApplication = asyncHandler(async (req, res) => {
    try {
        const candidate = await updateSelfServiceApplication(req.params.token, req.body);
        res.json({
            success: true,
            message: req.body.action === 'withdraw' ? 'Application withdrawn' : 'Application updated',
            data: { status: candidate.status, stage: candidate.stage },
        });
    } catch (err) {
        res.status(err.status || 400).json({ success: false, message: err.message });
    }
});
