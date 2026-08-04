/**
 * Recruitment email + communication auto-log helper.
 * Isolated from other modules; uses sendNotificationEmail.
 */
import { Candidate } from '../models/recruitment.model.js';
import { sendNotificationEmail } from '../helpers/emailSender.js';
import logger from '../helpers/logger.js';

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
    return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111">
      <h2 style="margin:0 0 16px">${title}</h2>
      ${bodyHtml}
      <p style="margin-top:24px;font-size:12px;color:#666">This message was sent by your recruitment team.</p>
    </div>`;
}

export async function sendInterviewInvite({ candidate, interview, meetingLink, actorId }) {
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    const when = interview.scheduledDate
        ? new Date(interview.scheduledDate).toLocaleString('en-IN')
        : 'TBD';
    const subject = `Interview Invitation — ${interview.interviewType || 'Interview'}`;
    const text = `Hi ${name},\n\nYou are invited for a ${interview.interviewType || 'interview'} on ${when}${interview.scheduledTime ? ` at ${interview.scheduledTime}` : ''}.\n${meetingLink || interview.meetingLink ? `Join: ${meetingLink || interview.meetingLink}` : ''}\n\nRegards,\nRecruitment Team`;
    const html = wrapHtml(subject, `<p>Hi ${name},</p>
      <p>You are invited for a <strong>${interview.interviewType || 'interview'}</strong>.</p>
      <p><strong>When:</strong> ${when}${interview.scheduledTime ? ` · ${interview.scheduledTime}` : ''}</p>
      ${(meetingLink || interview.meetingLink) ? `<p><a href="${meetingLink || interview.meetingLink}">Join meeting</a></p>` : ''}
      <p>Please confirm your availability by replying to this email if needed.</p>`);
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

export async function sendInterviewReminder({ candidate, interview, actorId }) {
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    const when = interview.scheduledDate
        ? new Date(interview.scheduledDate).toLocaleString('en-IN')
        : 'soon';
    const subject = `Interview Reminder — ${interview.interviewType || 'Interview'}`;
    const text = `Hi ${name},\n\nReminder: your interview is scheduled for ${when}.\n${interview.meetingLink ? `Join: ${interview.meetingLink}` : ''}`;
    const html = wrapHtml(subject, `<p>Hi ${name},</p><p>This is a reminder for your upcoming interview on <strong>${when}</strong>.</p>${interview.meetingLink ? `<p><a href="${interview.meetingLink}">Join meeting</a></p>` : ''}`);
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
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
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

export async function sendOfferReminder({ candidate, offer, portalUrl, actorId }) {
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    const subject = `Reminder: Please respond to your offer`;
    const text = `Hi ${name},\n\nFriendly reminder to respond to your offer${offer.expiryDate ? ` before ${new Date(offer.expiryDate).toLocaleDateString('en-IN')}` : ''}.\n${portalUrl}`;
    const html = wrapHtml(subject, `<p>Hi ${name},</p><p>Please respond to your pending offer${offer.expiryDate ? ` before <strong>${new Date(offer.expiryDate).toLocaleDateString('en-IN')}</strong>` : ''}.</p><p><a href="${portalUrl}">Open offer portal</a></p>`);
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

export async function sendJoiningReminder({ candidate, joiningDate, actorId }) {
    const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
    const when = joiningDate ? new Date(joiningDate).toLocaleDateString('en-IN') : 'your joining date';
    const subject = `Joining Reminder — ${when}`;
    const text = `Hi ${name},\n\nThis is a reminder that your joining date is ${when}. We look forward to welcoming you.`;
    const html = wrapHtml(subject, `<p>Hi ${name},</p><p>Your joining date is <strong>${when}</strong>. We look forward to welcoming you!</p>`);
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

export { logCommunication };
