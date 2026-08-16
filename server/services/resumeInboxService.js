/**
 * Resume Inbox import service.
 * Creates/updates Candidates from inbound recruitment mailbox emails.
 * Does not modify Career Portal / public apply / outbound email senders.
 */
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import Organization from '../models/organization.model.js';
import { Recruitment, Candidate } from '../models/recruitment.model.js';
import ResumeInboxImport from '../models/resumeInboxImport.model.js';
import { encryptSecret, decryptSecret, normalizeMailboxPassword } from '../helpers/resumeInboxCrypto.js';
import {
    resolveResumeInboxImapSettings,
    fetchUnreadResumeEmails,
    markMessageSeen,
    testImapConnection,
    MAX_ATTACHMENT_BYTES,
} from '../helpers/resumeInboxImapHelper.js';
import { logCommunication } from './recruitmentEmailService.js';
import { notify } from '../helpers/notificationManager.js';
import logger from '../helpers/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const HOLDING_JOB_TAG = '__resume_inbox_holding__';
export const UNASSIGNED_TAG = 'Unassigned';
export const EMAIL_SOURCE = 'Email';

const RESUMES_DIR = path.join(__dirname, '../public/uploads/resumes');

function ensureResumesDir() {
    if (!fs.existsSync(RESUMES_DIR)) {
        fs.mkdirSync(RESUMES_DIR, { recursive: true });
    }
}

function sanitizeFileName(name) {
    return String(name || 'resume')
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9._-]/g, '')
        .slice(0, 80) || 'resume';
}

export function saveResumeAttachment(buffer, originalName) {
    ensureResumesDir();
    const ext = path.extname(originalName || '').toLowerCase() || '.pdf';
    const base = sanitizeFileName(path.basename(originalName || 'resume', ext));
    const fileName = `${base}-${Date.now()}-${crypto.randomBytes(4).toString('hex')}${ext}`;
    const fullPath = path.join(RESUMES_DIR, fileName);
    fs.writeFileSync(fullPath, buffer);
    return {
        url: `/uploads/resumes/${fileName}`,
        fileName: originalName || fileName,
        size: buffer.length,
    };
}

/**
 * Ensure a hidden holding job exists so Candidates can satisfy required jobPostingId
 * without appearing on the Career Portal (externalVisible: false).
 */
export async function ensureHoldingJob(organizationId) {
    let job = await Recruitment.findOne({
        organizationId,
        tags: HOLDING_JOB_TAG,
        isActive: true,
    });
    if (job) {
        // Never expose a fake HR department for unassigned inbox candidates
        if (job.department === 'Human Resources' || !job.department) {
            job.department = 'Unassigned';
            await job.save();
        }
        return job;
    }

    job = await Recruitment.create({
        organizationId,
        jobTitle: 'Unassigned (Resume Inbox)',
        department: 'Unassigned',
        position: 'Unassigned',
        jobDescription: 'System holding job for candidates imported via Resume Inbox without a matched posting. Not visible on the Career Portal.',
        location: 'N/A',
        employmentType: 'Full-time',
        status: 'Open',
        postedDate: new Date(),
        externalVisible: false,
        internalVisible: false,
        notifyEmployeesOnOpen: false,
        isActive: true,
        tags: [HOLDING_JOB_TAG],
        numberOfPositions: 999,
    });
    return job;
}

function splitName(displayName = '', email = '') {
    const cleaned = String(displayName || '').trim().replace(/[<>"]/g, '');
    if (cleaned) {
        const parts = cleaned.split(/\s+/).filter(Boolean);
        if (parts.length === 1) return { firstName: parts[0], lastName: 'Candidate' };
        return {
            firstName: parts[0],
            lastName: parts.slice(1).join(' '),
        };
    }
    const local = String(email).split('@')[0] || 'Candidate';
    const bits = local.split(/[._-]/).filter(Boolean);
    if (bits.length >= 2) {
        return {
            firstName: capitalize(bits[0]),
            lastName: capitalize(bits.slice(1).join(' ')),
        };
    }
    return { firstName: capitalize(local), lastName: 'Candidate' };
}

function capitalize(s) {
    const t = String(s || '').trim();
    if (!t) return t;
    return t.charAt(0).toUpperCase() + t.slice(1);
}

const EMAIL_RE = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_RE = /(?:\+?\d{1,3}[\s-]?)?(?:\(?\d{2,4}\)?[\s-]?)?\d{3,5}[\s-]?\d{4,6}/g;

const NAME_LABEL_RE = /^(?:full\s*name|candidate\s*name|name)\s*[:\-–—]\s*(.+)$/i;
const RESUME_SECTION_RE = /^(objective|summary|experience|education|skills|projects|certifications|contact|profile|employment|work\s*history|professional|technical|languages|interests|references|about\s*me|career)\b/i;
const JOB_TITLE_HINT_RE = /\b(developer|engineer|manager|analyst|consultant|specialist|architect|designer|intern|lead|director|officer|executive|administrator|assistant|coordinator|recruiter)\b/i;
const BLOCKED_NAME_WORDS = new Set([
    'resume', 'curriculum', 'vitae', 'cv', 'phone', 'email', 'address', 'mobile',
    'the', 'and', 'for', 'with', 'from', 'application', 'applied', 'position',
]);

/**
 * Parse a person name from a short line. Returns null when unreliable (do not invent).
 */
export function parsePersonName(raw = '') {
    const cleaned = String(raw || '')
        .replace(/[|•·].*$/, '')
        .replace(/,.*$/, '')
        .replace(/[^a-zA-Z\s'.-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!cleaned || cleaned.length > 60) return null;

    const parts = cleaned.split(/\s+/).filter(Boolean);
    if (parts.length < 1 || parts.length > 4) return null;
    if (!parts.every((p) => /^[A-Za-z][A-Za-z'.-]{1,29}$/.test(p))) return null;
    if (BLOCKED_NAME_WORDS.has(parts[0].toLowerCase())) return null;
    if (JOB_TITLE_HINT_RE.test(cleaned)) return null;

    if (parts.length === 1) {
        return { firstName: capitalize(parts[0]), lastName: 'Candidate' };
    }
    return {
        firstName: capitalize(parts[0]),
        lastName: parts.slice(1).map(capitalize).join(' '),
    };
}

/**
 * Prefer a reliable candidate name from resume letterhead / "Name:" lines.
 * Returns null when no confident name is found.
 */
export function extractNameFromResumeText(text = '') {
    const lines = String(text || '')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .slice(0, 25);

    for (const line of lines) {
        const labeled = line.match(NAME_LABEL_RE);
        if (labeled) {
            const parsed = parsePersonName(labeled[1]);
            if (parsed) return parsed;
        }
    }

    for (const line of lines.slice(0, 10)) {
        if (/@/.test(line)) continue;
        if (/https?:|www\.|linkedin\.com|github\.com/i.test(line)) continue;
        if (RESUME_SECTION_RE.test(line)) continue;
        const digitCount = (line.match(/\d/g) || []).length;
        if (digitCount >= 7) continue;

        const parsed = parsePersonName(line);
        if (parsed) return parsed;
    }
    return null;
}

/**
 * Reject random numeric values (IDs, years, sequential junk) that are not phone-like.
 */
export function isLikelyPhoneNumber(raw = '') {
    const trimmed = String(raw || '').trim();
    if (!trimmed) return false;
    const digits = trimmed.replace(/\D/g, '');
    if (digits.length < 10 || digits.length > 15) return false;
    if (/^(\d)\1{9,}$/.test(digits)) return false;
    if (digits === '1234567890' || digits === '0123456789') return false;
    // Bare long digit strings without phone formatting are usually IDs
    const hasSeparator = /[\s\-().+]/.test(trimmed);
    if (!hasSeparator && digits.length > 11) return false;
    // Reject compact year-like 8-digit sequences
    if (digits.length === 8 && /^(19|20)\d{6}$/.test(digits)) return false;
    return true;
}

/**
 * Extract contact fields from resume + email body.
 * Name priority: resume text → sender display name → email local-part fallback.
 */
export function extractContactFromText(text = '', fallbackEmail = '', fallbackName = '') {
    const blob = String(text || '');
    const emails = blob.match(EMAIL_RE) || [];
    const fallbackLc = String(fallbackEmail || '').toLowerCase().trim();
    // Prefer an address found in resume/body that is not the mailbox sender
    const email = (emails.find((e) => e.toLowerCase() !== fallbackLc)
        || fallbackLc
        || (emails[0] || '').toLowerCase()
        || '').trim();

    let phone = '';
    const phones = blob.match(PHONE_RE) || [];
    for (const p of phones) {
        if (isLikelyPhoneNumber(p)) {
            phone = p.trim();
            break;
        }
    }

    const fromResume = extractNameFromResumeText(blob);
    const { firstName, lastName } = fromResume || splitName(fallbackName, email);
    return { firstName, lastName, email, phone };
}

async function extractTextFromResume(buffer, fileName) {
    const ext = path.extname(fileName || '').toLowerCase() || 'unknown';
    const fileSize = buffer?.length || 0;
    try {
        const { extractTextFromBuffer } = await import('./resumeScreeningService.js');
        const text = await extractTextFromBuffer(buffer, fileName);
        const extractedTextLength = String(text || '').length;
        logger.info('Resume Inbox extraction meta', {
            fileType: ext,
            fileSize,
            extractedTextLength,
            extractionSuccess: extractedTextLength > 0,
        });
        return text || '';
    } catch (err) {
        logger.warn('Resume Inbox text extract failed', {
            fileType: ext,
            fileSize,
            extractedTextLength: 0,
            extractionSuccess: false,
            error: err.message,
        });
        return '';
    }
}

function escapeRegexToken(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Score how closely a job title appears in email subject/body.
 * Higher is better. 0 means no usable match.
 */
export function scoreJobTitleMatch(haystack = '', jobTitle = '') {
    const text = String(haystack || '').toLowerCase();
    const title = String(jobTitle || '').trim().toLowerCase();
    if (!text || title.length < 3) return 0;

    if (text.includes(title)) {
        return 1000 + title.length;
    }

    const tokens = title
        .split(/[^a-z0-9.+#]+/i)
        .map((t) => t.trim())
        .filter((t) => t.length >= 3);
    if (!tokens.length) return 0;

    const matched = tokens.filter((token) =>
        new RegExp(`(^|[^a-z0-9.+#])${escapeRegexToken(token)}([^a-z0-9.+#]|$)`, 'i').test(text)
    );
    if (matched.length === tokens.length) {
        return 500 + (matched.join('').length);
    }
    // Single distinctive token titles (e.g. "MERN")
    if (tokens.length === 1 && matched.length === 1 && tokens[0].length >= 4) {
        return 300 + tokens[0].length;
    }
    return 0;
}

/**
 * Match open jobs by ObjectId in subject/body, then title / reference heuristics.
 */
export async function matchJobFromEmail(organizationId, { subject = '', bodyText = '' } = {}) {
    const haystack = `${subject}\n${bodyText}`;

    const objectIdMatch = haystack.match(/\b([a-f0-9]{24})\b/i);
    if (objectIdMatch) {
        const job = await Recruitment.findOne({
            _id: objectIdMatch[1],
            organizationId,
            isActive: true,
            tags: { $ne: HOLDING_JOB_TAG },
        });
        if (job) {
            logger.info('Resume screening debug', {
                stage: 'matchJobFromEmail',
                jobId: job._id,
                jobTitle: job.jobTitle,
                matchMethod: 'objectId',
            });
            return job;
        }
    }

    const refMatch = haystack.match(/(?:job|ref|reference|requisition|req)[#:\s-]*([A-Z0-9-]{4,})/i);
    if (refMatch) {
        const jobs = await Recruitment.find({
            organizationId,
            isActive: true,
            status: { $in: ['Open', 'Draft', 'On Hold'] },
            tags: { $ne: HOLDING_JOB_TAG },
        }).select('jobTitle tags _id').lean();
        const token = refMatch[1].toLowerCase();
        const hit = jobs.find((j) =>
            String(j._id).toLowerCase().includes(token)
            || (j.tags || []).some((t) => String(t).toLowerCase().includes(token))
            || String(j.jobTitle).toLowerCase().includes(token)
        );
        if (hit) {
            logger.info('Resume screening debug', {
                stage: 'matchJobFromEmail',
                jobId: hit._id,
                jobTitle: hit.jobTitle,
                matchMethod: 'reference',
            });
            return Recruitment.findById(hit._id);
        }
    }

    const openJobs = await Recruitment.find({
        organizationId,
        status: 'Open',
        isActive: true,
        tags: { $ne: HOLDING_JOB_TAG },
    }).select('jobTitle').lean();

    // Confident title match only — do not guess from weak/ambiguous token hits.
    const MIN_CONFIDENT_TITLE_SCORE = 300;
    let best = null;
    let second = null;
    for (const j of openJobs) {
        const score = scoreJobTitleMatch(haystack, j.jobTitle);
        if (score < MIN_CONFIDENT_TITLE_SCORE) continue;
        if (!best || score > best.score) {
            second = best;
            best = { id: j._id, title: j.jobTitle, score };
        } else if (!second || score > second.score) {
            second = { id: j._id, title: j.jobTitle, score };
        }
    }

    const ambiguous = !!(best && second && (best.score - second.score) < 50);
    if (best && !ambiguous) {
        logger.info('Resume screening debug', {
            stage: 'matchJobFromEmail',
            jobId: best.id,
            jobTitle: best.title,
            matchMethod: 'title',
            matchScore: best.score,
        });
        return Recruitment.findById(best.id);
    }

    logger.info('Resume screening debug', {
        stage: 'matchJobFromEmail',
        jobId: null,
        jobTitle: null,
        matchMethod: 'none',
    });
    return null;
}

async function findDuplicateCandidate(organizationId, { email, phone }) {
    const or = [];
    if (email) or.push({ email: String(email).toLowerCase().trim() });
    if (phone) {
        const digits = String(phone).replace(/\D/g, '');
        if (digits.length >= 10) {
            or.push({ phone: new RegExp(`${digits.slice(-10)}$`) });
        }
    }
    if (!or.length) return null;
    return Candidate.findOne({
        organizationId,
        archivedAt: null,
        $or: or,
    }).sort({ updatedAt: -1 });
}

function sanitizeConfigForClient(cfg = {}) {
    return {
        enabled: !!cfg.enabled,
        provider: cfg.provider || '',
        host: cfg.host || '',
        port: cfg.port || 993,
        secure: cfg.secure !== false,
        user: cfg.user || '',
        folder: cfg.folder || 'INBOX',
        hasPassword: !!cfg.passwordEncrypted,
        lastPolledAt: cfg.lastPolledAt || null,
        lastPollError: cfg.lastPollError || null,
    };
}

export async function getResumeInboxConfig(organizationId) {
    const org = await Organization.findById(organizationId).select('settings.resumeInbox').lean();
    return sanitizeConfigForClient(org?.settings?.resumeInbox || {});
}

export async function updateResumeInboxConfig(organizationId, payload = {}) {
    const org = await Organization.findById(organizationId);
    if (!org) {
        throw Object.assign(new Error('Organization not found'), { status: 404 });
    }
    if (!org.settings) org.settings = {};
    const current = org.settings.resumeInbox || {};

    const next = {
        enabled: payload.enabled != null ? !!payload.enabled : !!current.enabled,
        provider: payload.provider != null ? String(payload.provider) : (current.provider || ''),
        host: payload.host != null ? String(payload.host).trim() : (current.host || ''),
        port: payload.port != null ? Number(payload.port) : (current.port || 993),
        secure: payload.secure != null ? !!payload.secure : (current.secure !== false),
        user: payload.user != null ? String(payload.user).trim().toLowerCase() : (current.user || ''),
        folder: payload.folder != null ? String(payload.folder).trim() || 'INBOX' : (current.folder || 'INBOX'),
        passwordEncrypted: current.passwordEncrypted || '',
        lastPolledAt: current.lastPolledAt || null,
        lastPollError: current.lastPollError || null,
    };

    if (payload.password && String(payload.password).trim()) {
        next.passwordEncrypted = encryptSecret(String(payload.password).trim());
    }

    // Always auto-fill host for known providers (override stale/wrong host when provider changes)
    if (next.provider === 'gmail') next.host = 'imap.gmail.com';
    if (next.provider === 'outlook' || next.provider === 'office365') {
        next.host = 'outlook.office365.com';
    }

    org.settings.resumeInbox = next;
    org.markModified('settings');
    await org.save();
    return sanitizeConfigForClient(next);
}

async function resolveImapForOrg(organizationId) {
    const org = await Organization.findById(organizationId).select('settings.resumeInbox').lean();
    const cfg = org?.settings?.resumeInbox || {};
    const password = normalizeMailboxPassword(decryptSecret(cfg.passwordEncrypted || ''));

    if (cfg.enabled && cfg.host && cfg.user && !password) {
        throw Object.assign(
            new Error('Mailbox password is missing or could not be read. Re-enter your Gmail App Password in Resume Inbox settings and save again.'),
            { status: 400 }
        );
    }

    const fromOrg = resolveResumeInboxImapSettings(cfg, password);
    if (fromOrg) return fromOrg;

    // Global env fallback (optional single-tenant binding)
    if (process.env.RESUME_INBOX_ENABLED !== 'true') return null;
    const boundOrg = process.env.RESUME_INBOX_ORGANIZATION_ID;
    if (boundOrg && String(boundOrg) !== String(organizationId)) return null;

    return resolveResumeInboxImapSettings({}, '');
}

/**
 * Test IMAP login without importing messages.
 * Optional password in payload tests typed credentials before save.
 */
export async function testResumeInboxConnection(organizationId, payload = {}) {
    const org = await Organization.findById(organizationId).select('settings.resumeInbox').lean();
    const cfg = org?.settings?.resumeInbox || {};

    const merged = {
        enabled: true,
        provider: payload.provider != null ? payload.provider : (cfg.provider || ''),
        host: payload.host != null ? String(payload.host).trim() : (cfg.host || ''),
        port: payload.port != null ? Number(payload.port) : (cfg.port || 993),
        secure: payload.secure != null ? !!payload.secure : (cfg.secure !== false),
        user: payload.user != null ? String(payload.user).trim().toLowerCase() : (cfg.user || ''),
        folder: payload.folder != null ? String(payload.folder).trim() || 'INBOX' : (cfg.folder || 'INBOX'),
    };

    if (!merged.host && merged.provider === 'gmail') merged.host = 'imap.gmail.com';
    if (!merged.host && (merged.provider === 'outlook' || merged.provider === 'office365')) {
        merged.host = 'outlook.office365.com';
    }

    if (!cfg.enabled && !payload.password && !cfg.passwordEncrypted) {
        throw Object.assign(new Error('Resume Inbox is disabled. Enable it in settings first.'), { status: 400 });
    }

    const passwordOverride = payload.password && String(payload.password).trim()
        ? normalizeMailboxPassword(payload.password)
        : '';
    const storedPassword = normalizeMailboxPassword(decryptSecret(cfg.passwordEncrypted || ''));
    const effectivePassword = passwordOverride || storedPassword;

    const imapSettings = resolveResumeInboxImapSettings(merged, effectivePassword);

    if (!imapSettings?.host || !imapSettings?.user || !imapSettings?.password) {
        throw Object.assign(
            new Error('Mailbox is not fully configured. Enter email, host, and App Password, then save or test again.'),
            { status: 400 }
        );
    }

    const result = await testImapConnection(imapSettings);

    await Organization.findByIdAndUpdate(organizationId, {
        $set: {
            'settings.resumeInbox.lastPolledAt': new Date(),
            'settings.resumeInbox.lastPollError': null,
        },
    });

    return {
        ...result,
        user: imapSettings.user,
        host: imapSettings.host,
    };
}

async function notifyImport({ organizationId, candidate, job, wasDuplicate }) {
    try {
        const name = `${candidate.firstName || ''} ${candidate.lastName || ''}`.trim();
        const position = job?.jobTitle || 'Unassigned';
        const recipients = candidate.primaryRecruiterId
            ? [candidate.primaryRecruiterId.toString()]
            : undefined;
        await notify({
            type: 'resume_inbox_imported',
            organizationId,
            recipients,
            data: {
                candidate,
                job,
                wasDuplicate,
                candidateId: candidate._id,
                message: wasDuplicate
                    ? `Duplicate resume received via Email for ${name} (${position}).`
                    : `New resume imported via Email: ${name} — Source: Email — ${position}.`,
            },
            title: wasDuplicate ? 'Duplicate Resume Received' : 'New Resume Imported',
            priority: 'high',
        });
    } catch (err) {
        logger.warn('Resume Inbox notify failed', { error: err.message });
    }
}

/**
 * Process a single fetched email into Candidate + Import record.
 */
export async function processInboxMessage(organizationId, message, imapSettings) {
    const existingImport = await ResumeInboxImport.findOne({
        organizationId,
        messageId: message.messageId,
    });
    if (existingImport && ['imported', 'duplicate'].includes(existingImport.status)) {
        if (imapSettings) await markMessageSeen(imapSettings, message.uid);
        return { skipped: true, reason: 'already_imported', import: existingImport };
    }

    const attachment = message.attachments?.[0];
    if (!attachment?.buffer) {
        return { skipped: true, reason: 'no_attachment' };
    }
    if (attachment.size > MAX_ATTACHMENT_BYTES) {
        const failed = await ResumeInboxImport.findOneAndUpdate(
            { organizationId, messageId: message.messageId },
            {
                organizationId,
                messageId: message.messageId,
                uid: message.uid,
                fromAddress: message.fromAddress,
                fromName: message.fromName,
                subject: message.subject,
                bodyPreview: (message.bodyText || '').slice(0, 500),
                receivedAt: message.date,
                status: 'failed',
                failureReason: 'Attachment exceeds 5MB limit',
                isUnread: true,
            },
            { upsert: true, new: true }
        );
        return { failed: true, import: failed };
    }

    let resumeFile;
    try {
        resumeFile = saveResumeAttachment(attachment.buffer, attachment.fileName);
    } catch (err) {
        const failed = await ResumeInboxImport.findOneAndUpdate(
            { organizationId, messageId: message.messageId },
            {
                organizationId,
                messageId: message.messageId,
                uid: message.uid,
                fromAddress: message.fromAddress,
                fromName: message.fromName,
                subject: message.subject,
                status: 'failed',
                failureReason: `Failed to store resume: ${err.message}`,
                isUnread: true,
                receivedAt: message.date,
            },
            { upsert: true, new: true }
        );
        return { failed: true, import: failed };
    }

    const resumeText = await extractTextFromResume(attachment.buffer, attachment.fileName);
    const combinedText = `${message.bodyText || ''}\n${resumeText}`;
    // Name: resume letterhead first → sender display → email local-part
    // Email/Phone: resume+body, preferring candidate contact over mailbox sender
    const fromCombined = extractContactFromText(combinedText, message.fromAddress, message.fromName);
    const resumeName = extractNameFromResumeText(resumeText);
    const extracted = {
        firstName: resumeName?.firstName || fromCombined.firstName,
        lastName: resumeName?.lastName || fromCombined.lastName,
        email: fromCombined.email,
        phone: fromCombined.phone,
    };

    if (!extracted.email) {
        const failed = await ResumeInboxImport.findOneAndUpdate(
            { organizationId, messageId: message.messageId },
            {
                organizationId,
                messageId: message.messageId,
                uid: message.uid,
                fromAddress: message.fromAddress,
                fromName: message.fromName,
                subject: message.subject,
                bodyPreview: (message.bodyText || '').slice(0, 500),
                receivedAt: message.date,
                status: 'failed',
                failureReason: 'Could not determine candidate email',
                isUnread: true,
                resume: { ...resumeFile, mimeType: attachment.contentType },
                extracted,
            },
            { upsert: true, new: true }
        );
        return { failed: true, import: failed };
    }

    const matchedJob = await matchJobFromEmail(organizationId, {
        subject: message.subject,
        bodyText: combinedText,
    });
    const holdingJob = matchedJob ? null : await ensureHoldingJob(organizationId);
    const job = matchedJob || holdingJob;
    const unassigned = !matchedJob;

    const duplicate = await findDuplicateCandidate(organizationId, {
        email: extracted.email,
        phone: extracted.phone,
    });

    const resumePayload = {
        url: resumeFile.url,
        fileName: resumeFile.fileName,
        uploadedAt: new Date(),
    };

    const communicationEntry = {
        channel: 'email',
        direction: 'inbound',
        subject: message.subject || 'Resume received via Email',
        body: [
            'Resume received via Email',
            `Sender: ${message.fromName || ''} <${message.fromAddress}>`.trim(),
            `Subject: ${message.subject || '(no subject)'}`,
            `Received: ${message.date ? new Date(message.date).toISOString() : new Date().toISOString()}`,
            `Attachment: ${resumeFile.fileName}`,
            'Imported Automatically',
        ].join('\n'),
        participants: [message.fromAddress],
        attachments: [{ fileName: resumeFile.fileName, url: resumeFile.url }],
        autoLogged: true,
        emailType: 'resume_inbox_import',
    };

    let candidate;
    let wasDuplicate = false;

    /**
     * Apply email-matched job onto a candidate.
     * Duplicate detection must NOT block job assignment or screening.
     */
    const applyMatchedJobToCandidate = (cand) => {
        if (matchedJob) {
            cand.jobPostingId = matchedJob._id;
            if (!cand.emailImport) cand.emailImport = {};
            cand.emailImport.unassigned = false;
            cand.tags = (cand.tags || []).filter((t) => t !== UNASSIGNED_TAG);
            if (matchedJob.primaryRecruiterId || matchedJob.recruiter) {
                cand.primaryRecruiterId = matchedJob.primaryRecruiterId || matchedJob.recruiter;
            }
        } else if (holdingJob) {
            cand.jobPostingId = holdingJob._id;
            if (!cand.emailImport) cand.emailImport = {};
            cand.emailImport.unassigned = true;
            if (!cand.tags) cand.tags = [];
            if (!cand.tags.includes(UNASSIGNED_TAG)) cand.tags.push(UNASSIGNED_TAG);
        }
        if (!cand.tags) cand.tags = [];
        if (!cand.tags.includes('Resume Inbox')) cand.tags.push('Resume Inbox');
    };

    if (duplicate) {
        wasDuplicate = true;
        candidate = duplicate;
        candidate.resume = resumePayload;
        if (extracted.phone && !candidate.phone) candidate.phone = extracted.phone;
        if (!candidate.emailImport) candidate.emailImport = {};
        candidate.emailImport.messageId = message.messageId;
        candidate.emailImport.fromAddress = message.fromAddress;
        candidate.emailImport.subject = message.subject;
        candidate.emailImport.receivedAt = message.date;
        applyMatchedJobToCandidate(candidate);
        // Fresh screening for this resume — do not keep a prior Rejected · 0% from an old file/job.
        candidate.resumeScreening = {
            status: 'pending',
            decision: 'pending',
            matchScore: null,
            requiredMatchPercent: null,
            reason: 'Pending re-screen after Resume Inbox import',
            runId: Number(candidate.resumeScreening?.runId || 0),
        };
        candidate.markModified('resumeScreening');
        await candidate.save();
        await logCommunication(candidate._id, communicationEntry);
    } else {
        const screeningDueAt = new Date();
        screeningDueAt.setDate(screeningDueAt.getDate() + 2);

        candidate = new Candidate({
            organizationId,
            jobPostingId: job._id,
            firstName: extracted.firstName,
            lastName: extracted.lastName,
            email: extracted.email,
            phone: extracted.phone || undefined,
            resume: resumePayload,
            source: EMAIL_SOURCE,
            status: 'Applied',
            stage: 'Application',
            applicationDate: message.date || new Date(),
            screeningDueAt,
            primaryRecruiterId: job.primaryRecruiterId || job.recruiter || null,
            tags: unassigned ? ['Resume Inbox', UNASSIGNED_TAG] : ['Resume Inbox'],
            emailImport: {
                messageId: message.messageId,
                fromAddress: message.fromAddress,
                subject: message.subject,
                receivedAt: message.date,
                unassigned,
            },
            notes: [{
                note: `Imported from recruitment mailbox. Subject: ${message.subject || '(none)'}`,
                addedAt: new Date(),
            }],
        });
        await candidate.save();
        await logCommunication(candidate._id, communicationEntry);

        job.currentApplications = (job.currentApplications || 0) + 1;
        await job.save();
    }

    const importDoc = await ResumeInboxImport.findOneAndUpdate(
        { organizationId, messageId: message.messageId },
        {
            organizationId,
            messageId: message.messageId,
            uid: message.uid,
            fromAddress: message.fromAddress,
            fromName: message.fromName,
            subject: message.subject,
            bodyPreview: (message.bodyText || '').slice(0, 500),
            receivedAt: message.date,
            status: wasDuplicate ? 'duplicate' : 'imported',
            wasDuplicate,
            isUnread: true,
            candidateId: candidate._id,
            jobPostingId: candidate.jobPostingId,
            failureReason: null,
            resume: {
                url: resumeFile.url,
                fileName: resumeFile.fileName,
                mimeType: attachment.contentType,
                size: resumeFile.size,
            },
            extracted,
            rawMeta: {
                uid: message.uid,
                attachmentName: attachment.fileName,
            },
        },
        { upsert: true, new: true }
    );

    candidate.emailImport = {
        ...(candidate.emailImport?.toObject?.() || candidate.emailImport || {}),
        importId: importDoc._id,
    };
    await candidate.save();

    // Explicit screening — independent of duplicate flag. Use inbox-extracted text.
    try {
        const { screenCandidateById } = await import('./resumeScreeningService.js');
        logger.info('Resume screening debug', {
            stage: 'resumeInbox:pre-screen',
            candidateId: candidate._id,
            candidateEmail: candidate.email || null,
            matchedJobId: matchedJob?._id || null,
            matchedJobTitle: matchedJob?.jobTitle || null,
            jobPostingId: candidate.jobPostingId,
            isDuplicate: wasDuplicate,
            extractedTextLength: String(resumeText || '').length,
        });
        const screened = await screenCandidateById(candidate._id, {
            force: true,
            // Use attachment text only — do not let email body keywords inflate the score.
            resumeTextOverride: resumeText,
            isDuplicate: wasDuplicate,
            replaceCompleted: true,
        });
        if (screened) candidate = screened;

        // Verify MongoDB persisted the authoritative result
        const persisted = await Candidate.findById(candidate._id)
            .select('email status stage jobPostingId resumeScreening')
            .lean();
        logger.info('Resume screening debug', {
            stage: 'SCREENING_SAVE',
            source: 'resumeInbox:post-screen',
            candidateId: persisted?._id,
            candidateEmail: persisted?.email || null,
            isDuplicate: wasDuplicate,
            matchedJobId: matchedJob?._id || null,
            matchedJobTitle: matchedJob?.jobTitle || null,
            jobPostingId: persisted?.jobPostingId || null,
            extractedTextLength: String(resumeText || '').length,
            statusAfter: persisted?.resumeScreening?.status,
            decisionAfter: persisted?.resumeScreening?.decision,
            matchScore: persisted?.resumeScreening?.matchScore,
            requiredMatchPercent: persisted?.resumeScreening?.requiredMatchPercent,
            minimumMatchPercent: persisted?.resumeScreening?.minimumRequired,
            matchedRequired: persisted?.resumeScreening?.matchedRequired,
            requiredTotal: persisted?.resumeScreening?.requiredTotal,
            candidateStatusAfter: persisted?.status,
            candidateStageAfter: persisted?.stage,
        });

        // Keep import row pointing at the job screening actually used
        if (candidate.jobPostingId
            && String(importDoc.jobPostingId) !== String(candidate.jobPostingId)) {
            importDoc.jobPostingId = candidate.jobPostingId;
            await importDoc.save();
        }
    } catch (screenErr) {
        logger.warn('Resume Inbox post-import screening failed', {
            candidateId: candidate._id,
            error: screenErr.message,
        });
    }

    if (imapSettings) {
        await markMessageSeen(imapSettings, message.uid);
    }

    await notifyImport({ organizationId, candidate, job: matchedJob || job, wasDuplicate });

    return { imported: true, wasDuplicate, candidate, import: importDoc };
}

/**
 * Poll one organization mailbox and import resumes.
 */
export async function pollOrganizationInbox(organizationId) {
    const imapSettings = await resolveImapForOrg(organizationId);
    if (!imapSettings) {
        return { skipped: true, reason: 'not_configured', imported: 0, failed: 0, duplicates: 0 };
    }

    let messages;
    try {
        messages = await fetchUnreadResumeEmails(imapSettings, { limit: 30 });
        await Organization.findByIdAndUpdate(organizationId, {
            $set: {
                'settings.resumeInbox.lastPolledAt': new Date(),
                'settings.resumeInbox.lastPollError': null,
            },
        });
    } catch (err) {
        await Organization.findByIdAndUpdate(organizationId, {
            $set: {
                'settings.resumeInbox.lastPolledAt': new Date(),
                'settings.resumeInbox.lastPollError': err.message,
            },
        });
        throw err;
    }

    let imported = 0;
    let failed = 0;
    let duplicates = 0;

    for (const message of messages) {
        try {
            const result = await processInboxMessage(organizationId, message, imapSettings);
            if (result.imported && result.wasDuplicate) duplicates += 1;
            else if (result.imported) imported += 1;
            else if (result.failed) failed += 1;
        } catch (err) {
            failed += 1;
            logger.error('Resume Inbox message processing error', {
                organizationId,
                messageId: message.messageId,
                error: err.message,
            });
            await ResumeInboxImport.findOneAndUpdate(
                { organizationId, messageId: message.messageId },
                {
                    organizationId,
                    messageId: message.messageId,
                    fromAddress: message.fromAddress || 'unknown',
                    subject: message.subject,
                    status: 'failed',
                    failureReason: err.message,
                    isUnread: true,
                    receivedAt: message.date,
                },
                { upsert: true }
            );
        }
    }

    return {
        skipped: false,
        fetched: messages.length,
        imported,
        duplicates,
        failed,
    };
}

/**
 * Poll all orgs with resume inbox enabled (plus optional env-bound org).
 */
export async function pollAllResumeInboxes() {
    const orgs = await Organization.find({
        'settings.resumeInbox.enabled': true,
        isActive: { $ne: false },
    }).select('_id').lean();

    const orgIds = new Set(orgs.map((o) => String(o._id)));
    if (process.env.RESUME_INBOX_ENABLED === 'true' && process.env.RESUME_INBOX_ORGANIZATION_ID) {
        orgIds.add(String(process.env.RESUME_INBOX_ORGANIZATION_ID));
    }

    const summary = { orgs: 0, imported: 0, duplicates: 0, failed: 0, errors: 0 };

    for (const id of orgIds) {
        summary.orgs += 1;
        try {
            const result = await pollOrganizationInbox(id);
            summary.imported += result.imported || 0;
            summary.duplicates += result.duplicates || 0;
            summary.failed += result.failed || 0;
        } catch (err) {
            summary.errors += 1;
            logger.error('Resume Inbox poll failed for org', { organizationId: id, error: err.message });
        }
    }

    return summary;
}

export async function getInboxStats(organizationId) {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [unread, importedToday, failed, duplicates, recent] = await Promise.all([
        ResumeInboxImport.countDocuments({ organizationId, isUnread: true }),
        ResumeInboxImport.countDocuments({
            organizationId,
            status: { $in: ['imported', 'duplicate'] },
            createdAt: { $gte: startOfDay },
        }),
        ResumeInboxImport.countDocuments({ organizationId, status: 'failed' }),
        ResumeInboxImport.countDocuments({ organizationId, status: 'duplicate' }),
        ResumeInboxImport.find({ organizationId })
            .sort({ createdAt: -1 })
            .limit(10)
            .populate('candidateId', 'firstName lastName email status stage source resumeScreening')
            .populate('jobPostingId', 'jobTitle department tags')
            .lean(),
    ]);

    return { unread, importedToday, failed, duplicates, recent };
}

export async function listImports(organizationId, { status, page = 1, limit = 20 } = {}) {
    const query = { organizationId };
    if (status) query.status = status;
    const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
    const [items, total] = await Promise.all([
        ResumeInboxImport.find(query)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(Number(limit))
            .populate('candidateId', 'firstName lastName email phone status stage source tags resumeScreening jobPostingId')
            .populate('jobPostingId', 'jobTitle department tags screeningCriteria')
            .lean(),
        ResumeInboxImport.countDocuments(query),
    ]);

    // Catch up ONLY true pending screens. Never force-overwrite a completed result —
    // a concurrent inbox import can finish Approved while we waited on the lock;
    // force:true without resumeTextOverride was wiping Approved · 66.7% → Rejected · 0%.
    const { screenCandidateById, attachNormalizedScreening, reconcileScreeningFields } = await import('./resumeScreeningService.js');
    for (const item of items) {
        const sid = item.candidateId?._id || item.candidateId;
        if (!sid || !item.candidateId) continue;

        const raw = item.candidateId.resumeScreening || {};
        const reconciled = reconcileScreeningFields(raw);
        if (raw.status === 'skipped' || raw.decision !== reconciled.decision || raw.status !== reconciled.status) {
            await Candidate.updateOne(
                { _id: sid },
                {
                    $set: {
                        'resumeScreening.status': reconciled.status,
                        'resumeScreening.decision': reconciled.decision,
                        ...(reconciled.status === 'pending' && item.candidateId.status === 'Rejected'
                            ? { status: 'Applied', stage: 'Application' }
                            : {}),
                    },
                }
            );
            item.candidateId.resumeScreening = { ...raw, ...reconciled };
            if (reconciled.status === 'pending' && item.candidateId.status === 'Rejected') {
                item.candidateId.status = 'Applied';
                item.candidateId.stage = 'Application';
            }
        }

        const st = item.candidateId?.resumeScreening?.status;
        const scoreNum = Number(
            item.candidateId?.resumeScreening?.requiredMatchPercent
            ?? item.candidateId?.resumeScreening?.matchScore
        );
        // One-time heal: race used to overwrite Approved with Rejected · 0% via blind force.
        const needsFalseZeroHeal = !!item.wasDuplicate
            && st === 'failed'
            && scoreNum === 0
            && !item.rawMeta?.screeningHealDone;

        if (st && st !== 'pending' && !needsFalseZeroHeal) {
            item.candidateId = attachNormalizedScreening(item.candidateId);
            logger.info('Resume screening debug', {
                stage: 'INBOX_RESPONSE',
                candidateId: sid,
                candidateEmail: item.candidateId?.email || null,
                isDuplicate: !!item.wasDuplicate,
                jobPostingId: item.candidateId?.jobPostingId || item.jobPostingId || null,
                status: item.candidateId?.resumeScreening?.status,
                decision: item.candidateId?.resumeScreening?.decision,
                requiredMatchPercent: item.candidateId?.resumeScreening?.requiredMatchPercent,
                matchScore: item.candidateId?.resumeScreening?.matchScore,
            });
            continue;
        }
        try {
            const screened = await screenCandidateById(sid, {
                force: needsFalseZeroHeal,
                replaceCompleted: needsFalseZeroHeal,
                isDuplicate: !!item.wasDuplicate,
            });
            if (needsFalseZeroHeal) {
                await ResumeInboxImport.updateOne(
                    { _id: item._id },
                    { $set: { 'rawMeta.screeningHealDone': true } }
                );
                item.rawMeta = { ...(item.rawMeta || {}), screeningHealDone: true };
            }
            if (screened) {
                item.candidateId = attachNormalizedScreening(screened);
            } else {
                item.candidateId = attachNormalizedScreening(item.candidateId);
            }
        } catch {
            item.candidateId = attachNormalizedScreening(item.candidateId);
        }

        logger.info('Resume screening debug', {
            stage: 'INBOX_RESPONSE',
            candidateId: sid,
            candidateEmail: item.candidateId?.email || null,
            isDuplicate: !!item.wasDuplicate,
            jobPostingId: item.candidateId?.jobPostingId || item.jobPostingId || null,
            status: item.candidateId?.resumeScreening?.status,
            decision: item.candidateId?.resumeScreening?.decision,
            requiredMatchPercent: item.candidateId?.resumeScreening?.requiredMatchPercent,
            matchScore: item.candidateId?.resumeScreening?.matchScore,
        });
    }

    return { items, total, page: Number(page), limit: Number(limit) };
}

export async function markImportRead(organizationId, importId) {
    return ResumeInboxImport.findOneAndUpdate(
        { _id: importId, organizationId },
        { isUnread: false },
        { new: true }
    );
}

/**
 * Remove an inbox import row. Does not delete the Candidate (ATS record stays).
 */
export async function deleteImport(organizationId, importId) {
    const imp = await ResumeInboxImport.findOneAndDelete({ _id: importId, organizationId });
    if (!imp) throw Object.assign(new Error('Import not found'), { status: 404 });
    return imp;
}

export async function assignImportToJob(organizationId, importId, jobPostingId, actorId) {
    const imp = await ResumeInboxImport.findOne({ _id: importId, organizationId });
    if (!imp) throw Object.assign(new Error('Import not found'), { status: 404 });
    if (!imp.candidateId) throw Object.assign(new Error('Import has no candidate'), { status: 400 });

    const job = await Recruitment.findOne({
        _id: jobPostingId,
        organizationId,
        isActive: true,
        tags: { $ne: HOLDING_JOB_TAG },
    });
    if (!job) throw Object.assign(new Error('Job not found'), { status: 404 });

    const candidate = await Candidate.findOne({ _id: imp.candidateId, organizationId });
    if (!candidate) throw Object.assign(new Error('Candidate not found'), { status: 404 });

    candidate.jobPostingId = job._id;
    if (candidate.emailImport) candidate.emailImport.unassigned = false;
    candidate.tags = (candidate.tags || []).filter((t) => t !== UNASSIGNED_TAG);
    if (job.primaryRecruiterId || job.recruiter) {
        candidate.primaryRecruiterId = job.primaryRecruiterId || job.recruiter;
    }
    candidate.notes = candidate.notes || [];
    candidate.notes.push({
        note: `Assigned to job "${job.jobTitle}" from Resume Inbox`,
        addedBy: actorId,
        addedAt: new Date(),
    });
    await candidate.save();

    // Re-run screening against the assigned job's keywords → Approved / Rejected
    let screened = candidate;
    try {
        const { screenCandidateById } = await import('./resumeScreeningService.js');
        screened = await screenCandidateById(candidate._id, {
            force: true,
            replaceCompleted: true,
        }) || candidate;
    } catch (err) {
        logger.warn('Screening after job assign failed', { candidateId: candidate._id, error: err.message });
    }

    imp.jobPostingId = job._id;
    imp.isUnread = false;
    await imp.save();

    job.currentApplications = (job.currentApplications || 0) + 1;
    await job.save();

    return { candidate: screened, import: imp, job };
}

export async function retryFailedImport(organizationId, importId) {
    const imp = await ResumeInboxImport.findOne({ _id: importId, organizationId });
    if (!imp) throw Object.assign(new Error('Import not found'), { status: 404 });
    if (imp.status !== 'failed') {
        throw Object.assign(new Error('Only failed imports can be retried'), { status: 400 });
    }
    if (!imp.resume?.url) {
        throw Object.assign(new Error('No stored resume to retry with — re-poll mailbox instead'), { status: 400 });
    }

    // Re-run create/update from stored metadata (no IMAP re-download)
    const resumePath = path.join(__dirname, '../public', imp.resume.url.replace(/^\//, ''));
    if (!fs.existsSync(resumePath)) {
        throw Object.assign(new Error('Stored resume file missing'), { status: 400 });
    }
    const buffer = fs.readFileSync(resumePath);
    const fakeMessage = {
        uid: imp.uid,
        messageId: `${imp.messageId}::retry::${Date.now()}`,
        fromAddress: imp.fromAddress,
        fromName: imp.fromName,
        subject: imp.subject,
        date: imp.receivedAt || new Date(),
        bodyText: imp.bodyPreview || '',
        attachments: [{
            fileName: imp.resume.fileName,
            contentType: imp.resume.mimeType,
            size: buffer.length,
            buffer,
        }],
    };

    // Allow re-process by using a new messageId for retry attempt; keep link to original via notes
    const result = await processInboxMessage(organizationId, fakeMessage, null);
    imp.status = result.failed ? 'failed' : (result.wasDuplicate ? 'duplicate' : 'imported');
    imp.failureReason = result.failed ? (result.import?.failureReason || 'Retry failed') : null;
    if (result.candidate) imp.candidateId = result.candidate._id;
    if (result.import?.jobPostingId) imp.jobPostingId = result.import.jobPostingId;
    imp.isUnread = true;
    await imp.save();
    return { original: imp, result };
}
