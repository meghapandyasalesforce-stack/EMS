/**
 * Internal jobs, referrals, employee notifications, candidate self-service.
 */
import crypto from 'crypto';
import { Recruitment, Candidate } from '../models/recruitment.model.js';
import { notify } from '../helpers/notificationManager.js';
import { sendRecruitmentEmail } from './recruitmentEmailService.js';
import logger from '../helpers/logger.js';

function frontendBase() {
    return (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
}

/**
 * In-app notification only when a job becomes Open & internalVisible (no email blast).
 */
export async function notifyEmployeesOfInternalJob(job, { force = false } = {}) {
    if (!job || job.status !== 'Open' || !job.internalVisible) return { skipped: true, reason: 'not_internal_open' };
    if (job.notifyEmployeesOnOpen === false) return { skipped: true, reason: 'notify_disabled' };
    if (job.employeesNotifiedAt && !force) return { skipped: true, reason: 'already_notified' };

    const organizationId = job.organizationId;
    const internalUrl = `${frontendBase()}/employee/internal-jobs/${job._id}`;

    try {
        await notify({
            type: 'internal_job_posted',
            organizationId,
            data: { job, internalUrl },
        });
    } catch (err) {
        logger.warn('internal_job_posted notify failed', { error: err.message, jobId: job._id });
    }

    await Recruitment.findByIdAndUpdate(job._id, { employeesNotifiedAt: new Date() });
    return { notified: true };
}

export async function listInternalJobs(organizationId) {
    return Recruitment.find({
        organizationId,
        status: 'Open',
        isActive: { $ne: false },
        archivedAt: null,
        internalVisible: true,
    })
        .select('jobTitle department position location employmentType salaryRange postedDate closingDate jobDescription priority numberOfPositions filledPositions')
        .sort({ postedDate: -1 })
        .lean();
}

export async function getInternalJob(organizationId, jobId) {
    return Recruitment.findOne({
        _id: jobId,
        organizationId,
        status: 'Open',
        isActive: { $ne: false },
        archivedAt: null,
        internalVisible: true,
    }).lean();
}

function issueSelfServiceToken(candidate) {
    candidate.selfServiceToken = crypto.randomBytes(24).toString('hex');
    candidate.selfServiceTokenExpiresAt = new Date(Date.now() + 90 * 86400000);
    return candidate.selfServiceToken;
}

function normalizeAttachment(file) {
    if (!file?.url) return null;
    return {
        url: file.url,
        fileName: file.fileName || 'cover-letter',
        mimeType: file.mimeType,
        uploadedAt: new Date(),
    };
}

/**
 * Employee applies themselves OR refers someone else.
 */
export async function employeeApplyOrRefer({
    organizationId,
    jobPostingId,
    employee,
    mode = 'apply', // apply | refer
    candidatePayload = {},
}) {
    const job = await getInternalJob(organizationId, jobPostingId);
    if (!job) {
        throw Object.assign(new Error('Internal job not found or not open'), { status: 404 });
    }

    const screeningDueAt = new Date();
    screeningDueAt.setDate(screeningDueAt.getDate() + 2);

    if (mode === 'apply') {
        const email = String(employee.email || '').toLowerCase().trim();
        const existing = await Candidate.findOne({ organizationId, jobPostingId, email }).select('_id').lean();
        if (existing) {
            throw Object.assign(new Error('You have already applied to this job'), { status: 409 });
        }

        const attachment = normalizeAttachment(candidatePayload.coverLetterAttachment);
        const resume = candidatePayload.resume?.url
            ? {
                url: candidatePayload.resume.url,
                fileName: candidatePayload.resume.fileName || 'resume',
                uploadedAt: new Date(),
            }
            : undefined;
        const candidate = new Candidate({
            organizationId,
            jobPostingId,
            firstName: employee.name || candidatePayload.firstName || 'Employee',
            lastName: employee.lastName || candidatePayload.lastName || '',
            email,
            phone: employee.phone1 || candidatePayload.phone,
            coverLetter: attachment
                ? `Uploaded: ${attachment.fileName}`
                : candidatePayload.coverLetter,
            coverLetterAttachment: attachment || undefined,
            resume,
            source: 'Internal',
            applicantEmployeeId: employee._id,
            applicationDate: new Date(),
            screeningDueAt,
            primaryRecruiterId: job.primaryRecruiterId || job.recruiter,
            consent: {
                accepted: true,
                acceptedAt: new Date(),
                policyVersion: 'internal-v1',
            },
            tags: ['Internal'],
        });
        issueSelfServiceToken(candidate);
        await candidate.save();
        await Recruitment.findByIdAndUpdate(jobPostingId, { $inc: { currentApplications: 1 } });
        return { candidate, mode: 'apply' };
    }

    // refer
    const { firstName, lastName, email, phone, coverLetter, coverLetterAttachment } = candidatePayload;
    if (!firstName || !lastName || !email) {
        throw Object.assign(new Error('firstName, lastName and email are required for referral'), { status: 400 });
    }
    const normalizedEmail = String(email).toLowerCase().trim();
    const existing = await Candidate.findOne({ organizationId, jobPostingId, email: normalizedEmail }).select('_id').lean();
    if (existing) {
        throw Object.assign(new Error('This candidate has already applied to this job'), { status: 409 });
    }

    const attachment = normalizeAttachment(coverLetterAttachment);
    const candidate = new Candidate({
        organizationId,
        jobPostingId,
        firstName,
        lastName,
        email: normalizedEmail,
        phone,
        coverLetter: attachment ? `Uploaded: ${attachment.fileName}` : coverLetter,
        coverLetterAttachment: attachment || undefined,
        source: 'Referral',
        referredBy: employee._id,
        referralBonusStatus: 'Pending',
        applicationDate: new Date(),
        screeningDueAt,
        primaryRecruiterId: job.primaryRecruiterId || job.recruiter,
        consent: {
            accepted: true,
            acceptedAt: new Date(),
            policyVersion: 'referral-v1',
        },
        tags: ['Referral'],
        notes: [{
            note: `Referred by employee ${employee.employeeId || employee._id}`,
            addedBy: employee._id,
            addedAt: new Date(),
        }],
    });
    const token = issueSelfServiceToken(candidate);
    await candidate.save();
    await Recruitment.findByIdAndUpdate(jobPostingId, { $inc: { currentApplications: 1 } });

    // Email referred candidate a self-service link
    try {
        const portalUrl = `${frontendBase()}/application/${token}`;
        await sendRecruitmentEmail({
            to: normalizedEmail,
            subject: `You've been referred for ${job.jobTitle}`,
            text: `Hi ${firstName},\n\n${employee.name || 'A colleague'} referred you for ${job.jobTitle}. Track your application: ${portalUrl}`,
            html: `<p>Hi ${firstName},</p><p>You were referred for <strong>${job.jobTitle}</strong>.</p><p><a href="${portalUrl}">Track your application</a></p>`,
            candidateId: candidate._id,
            emailType: 'referral_invite',
            actorId: employee._id,
        });
    } catch (err) {
        logger.warn('Referral invite email failed', { error: err.message });
    }

    return { candidate, mode: 'refer' };
}

export async function listMyReferrals(organizationId, employeeId) {
    return Candidate.find({
        organizationId,
        referredBy: employeeId,
        archivedAt: null,
    })
        .populate('jobPostingId', 'jobTitle department status')
        .sort({ applicationDate: -1 })
        .lean();
}

export async function listMyInternalApplications(organizationId, employeeId, email) {
    return Candidate.find({
        organizationId,
        archivedAt: null,
        $or: [
            { applicantEmployeeId: employeeId },
            ...(email ? [{ email: String(email).toLowerCase().trim(), source: 'Internal' }] : []),
        ],
    })
        .populate('jobPostingId', 'jobTitle department status')
        .sort({ applicationDate: -1 })
        .lean();
}

export async function getApplicationBySelfServiceToken(token) {
    const candidate = await Candidate.findOne({
        selfServiceToken: token,
        selfServiceTokenExpiresAt: { $gt: new Date() },
    })
        .populate('jobPostingId', 'jobTitle department location employmentType status')
        .select('-communications -assignmentHistory')
        .lean();
    return candidate;
}

/**
 * Latest candidate-facing offer (sent or responded) for self-service portal.
 */
export async function getOfferSummaryForCandidate(candidateId) {
    if (!candidateId) return null;
    const { OfferLetter } = await import('../models/lifecycleGap.model.js');
    const offer = await OfferLetter.findOne({
        candidateId,
        status: { $in: ['Sent', 'Viewed', 'Accepted', 'Declined', 'Countered', 'Expired'] },
        portalToken: { $exists: true, $ne: null },
    })
        .sort({ version: -1, updatedAt: -1 })
        .select('status position department salary currency benefits startDate expiryDate sentAt portalToken pdfUrl pdfFileName')
        .lean();

    if (!offer?.portalToken) return null;

    const canRespond = ['Sent', 'Viewed', 'Countered'].includes(offer.status);
    return {
        status: offer.status,
        position: offer.position,
        department: offer.department,
        salary: offer.salary,
        currency: offer.currency || 'INR',
        benefits: offer.benefits || [],
        startDate: offer.startDate,
        expiryDate: offer.expiryDate,
        sentAt: offer.sentAt,
        pdfUrl: offer.pdfUrl || null,
        pdfFileName: offer.pdfFileName || null,
        portalUrl: `${frontendBase()}/offer/${offer.portalToken}`,
        canRespond,
    };
}

export async function updateSelfServiceApplication(token, payload) {
    const candidate = await Candidate.findOne({
        selfServiceToken: token,
        selfServiceTokenExpiresAt: { $gt: new Date() },
    });
    if (!candidate) {
        throw Object.assign(new Error('Invalid or expired application link'), { status: 404 });
    }

    if (payload.action === 'withdraw') {
        candidate.status = 'Withdrawn';
        candidate.stage = 'Rejected';
        candidate.withdrawnReason = payload.reason || 'Withdrawn via self-service';
        candidate.notes.push({ note: `Self-service withdraw: ${candidate.withdrawnReason}`, addedAt: new Date() });
        await candidate.save();
        return candidate;
    }

    if (payload.phone) candidate.phone = payload.phone;
    if (payload.coverLetter != null) candidate.coverLetter = payload.coverLetter;
    if (payload.coverLetterAttachment?.url) {
        candidate.coverLetterAttachment = {
            url: payload.coverLetterAttachment.url,
            fileName: payload.coverLetterAttachment.fileName,
            mimeType: payload.coverLetterAttachment.mimeType,
            uploadedAt: new Date(),
        };
        candidate.coverLetter = payload.coverLetterAttachment.fileName
            ? `Uploaded: ${payload.coverLetterAttachment.fileName}`
            : candidate.coverLetter;
    }
    if (payload.resume) {
        candidate.resume = {
            url: payload.resume.url,
            fileName: payload.resume.fileName,
            uploadedAt: new Date(),
        };
    }
    await candidate.save();
    return candidate;
}

/**
 * Status-change emails to candidate (best-effort).
 */
export async function sendCandidateStatusEmail(candidate, previousStatus) {
    if (!candidate?.email || !previousStatus || previousStatus === candidate.status) return;
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    const map = {
        Screening: 'Your application is under screening',
        'Phone Interview': 'You have been shortlisted for a phone interview',
        'Technical Interview': 'You have been invited for a technical interview',
        'Final Interview': 'You have been invited for a final interview',
        'Offer Extended': 'Congratulations — an offer has been extended',
        Rejected: 'Update on your application',
        Withdrawn: 'Your withdrawal has been recorded',
    };
    const subject = map[candidate.status];
    if (!subject) return;

    const text = `Hi ${name},\n\n${subject}.\nCurrent status: ${candidate.status}.\n\nRegards,\nRecruitment Team`;
    try {
        await sendRecruitmentEmail({
            to: candidate.email,
            subject,
            text,
            html: `<p>Hi ${name},</p><p>${subject}.</p><p>Current status: <strong>${candidate.status}</strong></p>`,
            candidateId: candidate._id,
            emailType: 'status_update',
        });
    } catch (err) {
        logger.warn('Status email failed', { error: err.message });
    }
}

export { issueSelfServiceToken, frontendBase };
