/**
 * Recruitment email + communication auto-log helper.
 * Isolated from other modules; uses sendNotificationEmail.
 *
 * Explicit HR actions only — callers must validate before invoking send helpers.
 */
import { Candidate } from '../models/recruitment.model.js';
import { sendNotificationEmail } from '../helpers/emailSender.js';
import logger from '../helpers/logger.js';

const COMPANY_NAME = 'Paarsiv Technologies Private Limited';
const RECENT_SEND_MS = 24 * 60 * 60 * 1000;

async function logCommunication(candidateId, entry) {
    if (!candidateId) return;
    await Candidate.findByIdAndUpdate(candidateId, {
        $push: {
            communications: {
                ...entry,
                autoLogged: entry.autoLogged !== false,
                createdAt: new Date(),
            },
        },
    });
}

export async function sendRecruitmentEmail({
    to,
    subject,
    text,
    html,
    candidateId,
    emailType,
    actorId,
    attachments = [],
}) {
    if (!to) {
        throw Object.assign(new Error('Recipient email required'), { status: 400 });
    }
    try {
        await sendNotificationEmail(to, subject, text, html);
    } catch (err) {
        logger.warn('Recruitment email send failed', { to, emailType, error: err.message });
        throw err;
    }
    await logCommunication(candidateId, {
        channel: 'email',
        direction: 'outbound',
        subject,
        body: text || subject,
        participants: [to],
        attachments,
        emailType,
        createdBy: actorId,
        autoLogged: true,
    });
    return { sent: true };
}

function wrapHtml(title, bodyHtml) {
    return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;line-height:1.55">
      <h2 style="margin:0 0 16px;font-size:18px;color:#0f172a">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:28px;margin-bottom:4px">Best Regards,</p>
      <p style="margin:0"><strong>${COMPANY_NAME}</strong></p>
      <p style="margin:0 0 16px">Recruitment Team</p>
      <p style="margin-top:24px;font-size:12px;color:#666">This message was sent by your recruitment team.</p>
    </div>`;
}

function candidateDisplayName(candidate) {
    return `${candidate?.firstName || ''} ${candidate?.lastName || ''}`.trim() || 'Candidate';
}

/** Matches resumeInboxService holding job — kept local to avoid circular imports. */
const HOLDING_JOB_TITLE = 'Unassigned (Resume Inbox)';
const HOLDING_JOB_TAG = '__resume_inbox_holding__';

const ASSIGN_JOB_BEFORE_EMAIL_MSG =
    'Please assign this candidate to a job before sending the interview email.';

/**
 * True when the linked posting is the Resume Inbox holding/placeholder job.
 * That title is internal-only and must never appear in candidate-facing emails.
 */
export function isHoldingJobPosting(job) {
    if (!job || typeof job !== 'object') return false;
    const title = String(job.jobTitle || '').trim();
    if (title === HOLDING_JOB_TITLE) return true;
    const tags = Array.isArray(job.tags) ? job.tags : [];
    if (tags.includes(HOLDING_JOB_TAG)) return true;
    return false;
}

/**
 * Resolve a candidate-facing job title from a real job posting only.
 * Never returns the Resume Inbox holding title or invented fallbacks.
 * @returns {string|null}
 */
export function resolveJobTitle(candidate, offer) {
    const job = candidate?.jobPostingId;
    if (job && typeof job === 'object' && job.jobTitle && !isHoldingJobPosting(job)) {
        const title = String(job.jobTitle).trim();
        if (title) return title;
    }
    // Offer position is only usable when candidate already has a real job (validated separately).
    // Do not use offer.position alone to paper over an unassigned/holding job.
    if (offer?.position && job && typeof job === 'object' && !isHoldingJobPosting(job)) {
        const pos = String(offer.position).trim();
        if (pos) return pos;
    }
    return null;
}

/**
 * Require a real (non-holding) job posting before any titled recruitment email.
 */
export function validateRealJobForEmail(candidate) {
    const job = candidate?.jobPostingId;
    if (!job) {
        return { ok: false, message: ASSIGN_JOB_BEFORE_EMAIL_MSG };
    }
    // Unpopulated ObjectId — treat as incomplete for title resolution
    if (typeof job !== 'object' || !job.jobTitle) {
        return { ok: false, message: ASSIGN_JOB_BEFORE_EMAIL_MSG };
    }
    if (isHoldingJobPosting(job)) {
        return { ok: false, message: ASSIGN_JOB_BEFORE_EMAIL_MSG };
    }
    const title = String(job.jobTitle).trim();
    if (!title) {
        return { ok: false, message: ASSIGN_JOB_BEFORE_EMAIL_MSG };
    }
    return { ok: true, jobTitle: title };
}

export function formatInterviewTypeLabel(interviewType) {
    if (!interviewType) return '';
    if (interviewType === 'On-site') return 'In-Person';
    return interviewType;
}

export function formatInterviewDate(scheduledDate) {
    if (!scheduledDate) return '';
    const d = new Date(scheduledDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

export function formatJoiningDate(joiningDate) {
    if (!joiningDate) return '';
    const d = new Date(joiningDate);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

function interviewLocationBlock(interview, meetingLinkOverride) {
    const link = (meetingLinkOverride || interview?.meetingLink || '').trim();
    const location = (interview?.location || '').trim();
    const lines = [];
    if (location) lines.push(`Location: ${location}`);
    if (link) lines.push(`Meeting Link: ${link}`);
    return { link, location, lines };
}

function interviewDetailsHtml(interview, meetingLinkOverride) {
    const typeLabel = formatInterviewTypeLabel(interview.interviewType);
    const dateLabel = formatInterviewDate(interview.scheduledDate);
    const timeLabel = (interview.scheduledTime || '').trim();
    const { link, location } = interviewLocationBlock(interview, meetingLinkOverride);

    let html = `<p style="margin:16px 0 8px"><strong>Interview Details:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li><strong>Interview Type:</strong> ${typeLabel}</li>
        <li><strong>Date:</strong> ${dateLabel}</li>
        <li><strong>Time:</strong> ${timeLabel}</li>`;
    if (location) html += `<li><strong>Location:</strong> ${location}</li>`;
    if (link) {
        html += `<li><strong>Meeting Link:</strong> <a href="${link}">${link}</a></li>`;
    }
    html += '</ul>';
    if (link) {
        html += `<p style="margin:20px 0"><a href="${link}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Join Meeting</a></p>`;
    }
    return html;
}

function interviewDetailsText(interview, meetingLinkOverride) {
    const typeLabel = formatInterviewTypeLabel(interview.interviewType);
    const dateLabel = formatInterviewDate(interview.scheduledDate);
    const timeLabel = (interview.scheduledTime || '').trim();
    const { link, location, lines } = interviewLocationBlock(interview, meetingLinkOverride);
    return [
        'Interview Details:',
        `Interview Type: ${typeLabel}`,
        `Date: ${dateLabel}`,
        `Time: ${timeLabel}`,
        ...lines,
        link ? `\nJoin Meeting: ${link}` : '',
    ].filter(Boolean).join('\n');
}

/**
 * Find latest outbound communication of the given emailType within the recent window.
 */
export function findRecentCommunication(candidate, emailType, withinMs = RECENT_SEND_MS) {
    const list = candidate?.communications || [];
    const cutoff = Date.now() - withinMs;
    let latest = null;
    for (const entry of list) {
        if (entry?.emailType !== emailType) continue;
        if (entry?.channel !== 'email' || entry?.direction !== 'outbound') continue;
        const at = entry.createdAt ? new Date(entry.createdAt).getTime() : 0;
        if (!at || at < cutoff) continue;
        if (!latest || at > new Date(latest.createdAt).getTime()) latest = entry;
    }
    return latest;
}

export function isValidEmailAddress(email) {
    if (!email || typeof email !== 'string') return false;
    const trimmed = email.trim();
    if (!trimmed) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

/**
 * Pick the interview to use for invite/reminder (explicit id or latest non-cancelled).
 */
export function pickInterviewForEmail(candidate, interviewId) {
    const schedule = candidate?.interviewSchedule || [];
    if (!schedule.length) return null;
    if (interviewId) {
        const byId = typeof schedule.id === 'function'
            ? schedule.id(interviewId)
            : schedule.find((i) => String(i._id) === String(interviewId));
        return byId || null;
    }
    // Prefer latest Scheduled / Rescheduled, else latest non-cancelled
    const active = [...schedule].reverse().find((i) =>
        i.status === 'Scheduled' || i.status === 'Rescheduled'
    );
    if (active) return active;
    return [...schedule].reverse().find((i) => i.status !== 'Cancelled') || null;
}

export function validateInterviewForInvite(interview, { meetingLinkOverride } = {}) {
    if (!interview) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please complete the interview details before sending the invitation.',
        };
    }
    if (interview.status === 'Cancelled') {
        return { ok: false, message: 'This interview has been cancelled. Schedule a new interview before sending an invitation.' };
    }
    if (!interview.interviewType) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please complete the interview details before sending the invitation.',
        };
    }
    if (!interview.scheduledDate) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please complete the interview details before sending the invitation.',
        };
    }
    if (!(interview.scheduledTime || '').trim()) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please complete the interview details before sending the invitation.',
        };
    }
    const link = (meetingLinkOverride || interview.meetingLink || '').trim();
    const location = (interview.location || '').trim();
    const type = interview.interviewType;
    if (type === 'Video' && !link) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please add a meeting link before sending the invitation.',
        };
    }
    if (type === 'On-site' && !location) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please add a location before sending the invitation.',
        };
    }
    if (!link && !location) {
        return {
            ok: false,
            message: 'Interview details are incomplete. Please add a meeting link or location before sending the invitation.',
        };
    }
    return { ok: true };
}

export function validateInterviewForReminder(interview) {
    const base = validateInterviewForInvite(interview);
    if (!base.ok) {
        return {
            ok: false,
            message: base.message.replace('invitation', 'reminder').replace('Invitation', 'Reminder'),
        };
    }
    if (interview.status === 'Cancelled') {
        return { ok: false, message: 'This interview has been cancelled. A reminder cannot be sent.' };
    }
    if (interview.status === 'Completed') {
        return { ok: false, message: 'This interview is already completed. A reminder cannot be sent.' };
    }
    const day = new Date(interview.scheduledDate);
    if (!Number.isNaN(day.getTime())) {
        const endOfInterviewDay = new Date(day);
        endOfInterviewDay.setHours(23, 59, 59, 999);
        if (endOfInterviewDay.getTime() < Date.now()) {
            return { ok: false, message: 'This interview date has already passed. A reminder cannot be sent.' };
        }
    }
    return { ok: true };
}

export function validateOfferForReminder(offer) {
    if (!offer) {
        return { ok: false, message: 'No valid offer letter found for this candidate.' };
    }
    if (['Draft', 'PendingApproval', 'Cancelled', 'Expired', 'Declined'].includes(offer.status)) {
        return {
            ok: false,
            message: `Offer is not available for reminder (status: ${offer.status}). Send the offer to the candidate first.`,
        };
    }
    if (!['Sent', 'Viewed'].includes(offer.status)) {
        return {
            ok: false,
            message: 'Offer reminder can only be sent when the offer has been sent and is awaiting a response.',
        };
    }
    if (!offer.portalToken) {
        return { ok: false, message: 'Offer portal link is missing. Send the offer letter before sending a reminder.' };
    }
    if (offer.portalTokenExpiresAt) {
        const exp = new Date(offer.portalTokenExpiresAt);
        if (!Number.isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
            return { ok: false, message: 'Offer portal link has expired. Please resend the offer before sending a reminder.' };
        }
    }
    return { ok: true };
}

export function validateJoiningForReminder(candidate) {
    if (!candidate) {
        return { ok: false, message: 'Candidate not found.' };
    }
    if (candidate.blacklist?.isBlacklisted) {
        const expiry = candidate.blacklist.expiryDate ? new Date(candidate.blacklist.expiryDate) : null;
        const stillActive = !expiry || Number.isNaN(expiry.getTime()) || expiry.getTime() > Date.now();
        if (stillActive) {
            return { ok: false, message: 'Cannot send joining reminder — candidate is blacklisted.' };
        }
    }
    if (['Rejected', 'Withdrawn', 'Offer Declined'].includes(candidate.status)) {
        return {
            ok: false,
            message: `Cannot send joining reminder — candidate status is ${candidate.status}.`,
        };
    }
    if (candidate.joiningStatus === 'Declined') {
        return { ok: false, message: 'Cannot send joining reminder — joining was declined.' };
    }
    if (!candidate.expectedJoiningDate) {
        return {
            ok: false,
            message: 'Joining date is missing. Please set the expected joining date before sending the reminder.',
        };
    }
    const joinDate = new Date(candidate.expectedJoiningDate);
    if (Number.isNaN(joinDate.getTime())) {
        return { ok: false, message: 'Joining date is invalid. Please update the expected joining date.' };
    }
    const hiringStates = ['Offer Extended', 'Offer Accepted'];
    const joiningReady = candidate.joiningStatus === 'Confirmed' || candidate.joiningStatus === 'Delayed';
    if (!hiringStates.includes(candidate.status) && !joiningReady) {
        return {
            ok: false,
            message: 'Candidate has not reached an appropriate hiring/joining state. Confirm offer acceptance or joining status first.',
        };
    }
    return { ok: true };
}

export async function sendInterviewInvite({ candidate, interview, meetingLink, actorId, jobTitle }) {
    const name = candidateDisplayName(candidate);
    const title = jobTitle || resolveJobTitle(candidate);
    if (!title) {
        throw Object.assign(new Error(ASSIGN_JOB_BEFORE_EMAIL_MSG), { status: 400 });
    }
    const subject = `Interview Invitation – ${title}`;
    const detailsText = interviewDetailsText(interview, meetingLink);
    const text = `Hi ${name},

We are pleased to invite you for an interview for the ${title} position.

${detailsText}

Please join the meeting using the link above at the scheduled time. We request you to be available a few minutes before the interview.

If you have any questions or need to reschedule, please reply to this email.

We look forward to speaking with you.

Best Regards,
${COMPANY_NAME}
Recruitment Team`;

    const html = wrapHtml(
        subject,
        `<p>Hi ${name},</p>
      <p>We are pleased to invite you for an interview for the <strong>${title}</strong> position.</p>
      ${interviewDetailsHtml(interview, meetingLink)}
      <p>Please join the meeting using the link above at the scheduled time. We request you to be available a few minutes before the interview.</p>
      <p>If you have any questions or need to reschedule, please reply to this email.</p>
      <p>We look forward to speaking with you.</p>`
    );

    return sendRecruitmentEmail({
        to: candidate.email,
        subject,
        text,
        html,
        candidateId: candidate._id,
        emailType: 'interview_invite',
        actorId,
    });
}

export async function sendInterviewReminder({ candidate, interview, actorId, jobTitle }) {
    const name = candidateDisplayName(candidate);
    const title = jobTitle || resolveJobTitle(candidate);
    if (!title) {
        throw Object.assign(new Error(ASSIGN_JOB_BEFORE_EMAIL_MSG), { status: 400 });
    }
    const subject = `Interview Reminder – ${title}`;
    const detailsText = interviewDetailsText(interview);
    const text = `Hi ${name},

This is a reminder about your upcoming interview for the ${title} position.

${detailsText}

Please be available a few minutes before the scheduled time.

If you have any questions or need to reschedule, please reply to this email.

We look forward to speaking with you.

Best Regards,
${COMPANY_NAME}
Recruitment Team`;

    const html = wrapHtml(
        subject,
        `<p>Hi ${name},</p>
      <p>This is a reminder about your upcoming interview for the <strong>${title}</strong> position.</p>
      ${interviewDetailsHtml(interview)}
      <p>Please be available a few minutes before the scheduled time.</p>
      <p>If you have any questions or need to reschedule, please reply to this email.</p>
      <p>We look forward to speaking with you.</p>`
    );

    return sendRecruitmentEmail({
        to: candidate.email,
        subject,
        text,
        html,
        candidateId: candidate._id,
        emailType: 'interview_reminder',
        actorId,
    });
}

export async function sendOfferLinkEmail({ candidate, offer, portalUrl, actorId }) {
    const name = candidateDisplayName(candidate);
    const subject = `Job Offer — ${offer.position || 'Your Offer'}`;
    const text = `Hi ${name},\n\nWe are pleased to share your offer letter.\nView and respond: ${portalUrl}\n\nRegards,\nHR Team`;
    const html = wrapHtml(subject, `<p>Hi ${name},</p>
      <p>We are pleased to share your offer for <strong>${offer.position || 'the role'}</strong>.</p>
      <p><a href="${portalUrl}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">View Offer</a></p>
      <p>Link: ${portalUrl}</p>`);
    return sendRecruitmentEmail({
        to: candidate.email,
        subject,
        text,
        html,
        candidateId: candidate._id,
        emailType: 'offer_link',
        actorId,
    });
}

export async function sendOfferReminder({ candidate, offer, portalUrl, actorId, jobTitle }) {
    const name = candidateDisplayName(candidate);
    const title = jobTitle || resolveJobTitle(candidate, offer);
    if (!title) {
        throw Object.assign(new Error(ASSIGN_JOB_BEFORE_EMAIL_MSG), { status: 400 });
    }
    const subject = `Reminder – Offer Letter for ${title}`;
    const text = `Hi ${name},

We wanted to remind you that your offer letter for the ${title} position is available for your review.

You can review the offer letter using the link below:
${portalUrl}

Please review the offer and complete the required action within the specified timeline.

If you have any questions regarding the offer, please reply to this email.

We look forward to hearing from you.

Best Regards,
${COMPANY_NAME}
Recruitment Team`;

    const html = wrapHtml(
        subject,
        `<p>Hi ${name},</p>
      <p>We wanted to remind you that your offer letter for the <strong>${title}</strong> position is available for your review.</p>
      <p>You can review the offer letter using the link below:</p>
      <p style="margin:20px 0"><a href="${portalUrl}" style="display:inline-block;padding:10px 16px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">View Offer Letter</a></p>
      <p>Please review the offer and complete the required action within the specified timeline.</p>
      <p>If you have any questions regarding the offer, please reply to this email.</p>
      <p>We look forward to hearing from you.</p>`
    );

    return sendRecruitmentEmail({
        to: candidate.email,
        subject,
        text,
        html,
        candidateId: candidate._id,
        emailType: 'offer_reminder',
        actorId,
    });
}

export async function sendJoiningReminder({ candidate, joiningDate, actorId, jobTitle, reportingLocation, reportingTime }) {
    const name = candidateDisplayName(candidate);
    const title = jobTitle || resolveJobTitle(candidate);
    if (!title) {
        throw Object.assign(new Error(ASSIGN_JOB_BEFORE_EMAIL_MSG), { status: 400 });
    }
    const when = formatJoiningDate(joiningDate);
    const subject = `Joining Reminder – ${title}`;
    const safeLocation = reportingLocation && reportingLocation !== 'N/A' ? reportingLocation : undefined;
    const locationLine = safeLocation ? `Reporting Location: ${safeLocation}` : null;
    const timeLine = reportingTime ? `Reporting Time: ${reportingTime}` : null;

    const detailsLines = [
        `Position: ${title}`,
        `Joining Date: ${when}`,
        locationLine,
        timeLine,
    ].filter(Boolean);

    const text = `Hi ${name},

This is a reminder regarding your upcoming joining with ${COMPANY_NAME}.

Joining Details:

${detailsLines.join('\n')}

Please ensure that you are available on the scheduled joining date and complete any pending requirements before joining.

If you have any questions or need any assistance, please reply to this email.

We look forward to welcoming you to ${COMPANY_NAME}.

Best Regards,
${COMPANY_NAME}
Recruitment Team`;

    let detailsHtml = `<p style="margin:16px 0 8px"><strong>Joining Details:</strong></p>
      <ul style="margin:0;padding-left:18px">
        <li><strong>Position:</strong> ${title}</li>
        <li><strong>Joining Date:</strong> ${when}</li>`;
    if (safeLocation) detailsHtml += `<li><strong>Reporting Location:</strong> ${safeLocation}</li>`;
    if (reportingTime) detailsHtml += `<li><strong>Reporting Time:</strong> ${reportingTime}</li>`;
    detailsHtml += '</ul>';

    const html = wrapHtml(
        subject,
        `<p>Hi ${name},</p>
      <p>This is a reminder regarding your upcoming joining with <strong>${COMPANY_NAME}</strong>.</p>
      ${detailsHtml}
      <p>Please ensure that you are available on the scheduled joining date and complete any pending requirements before joining.</p>
      <p>If you have any questions or need any assistance, please reply to this email.</p>
      <p>We look forward to welcoming you to ${COMPANY_NAME}.</p>`
    );

    return sendRecruitmentEmail({
        to: candidate.email,
        subject,
        text,
        html,
        candidateId: candidate._id,
        emailType: 'joining_reminder',
        actorId,
    });
}

export { logCommunication, COMPANY_NAME, RECENT_SEND_MS };
