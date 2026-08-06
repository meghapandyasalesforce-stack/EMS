/**
 * Automatic Resume Screening — additive layer for all candidate intake sources.
 * Does not modify Career Portal / offer / hire controllers; triggered via Candidate post-save.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Organization from '../models/organization.model.js';
import { Recruitment, Candidate } from '../models/recruitment.model.js';
import ScreeningAudit from '../models/screeningAudit.model.js';
import ResumeScreeningTemplate from '../models/resumeScreeningTemplate.model.js';
import logger from '../helpers/logger.js';

const HOLDING_JOB_TAG = '__resume_inbox_holding__';
const UNASSIGNED_TAG = 'Unassigned';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DEFAULT_SETTINGS = {
    enabled: true,
    defaultMinimumMatchPercent: 70,
    retentionDays: 7,
    requiredKeywordWeight: 1,
    optionalKeywordWeight: 0.5,
    autoDeleteEnabled: true,
    autoDeletedCount: 0,
};

export function sanitizeScreeningSettings(cfg = {}) {
    return {
        enabled: cfg.enabled !== false,
        defaultMinimumMatchPercent: normalizeMinimumMatchPercent(cfg.defaultMinimumMatchPercent, 70),
        retentionDays: Math.max(1, Number(cfg.retentionDays ?? 7)),
        requiredKeywordWeight: Number(cfg.requiredKeywordWeight ?? 1),
        optionalKeywordWeight: Number(cfg.optionalKeywordWeight ?? 0.5),
        autoDeleteEnabled: cfg.autoDeleteEnabled !== false,
        autoDeletedCount: Number(cfg.autoDeletedCount ?? 0),
    };
}

export async function getResumeScreeningSettings(organizationId) {
    const org = await Organization.findById(organizationId).select('settings.resumeScreening').lean();
    return sanitizeScreeningSettings(org?.settings?.resumeScreening || {});
}

export async function updateResumeScreeningSettings(organizationId, payload = {}) {
    const org = await Organization.findById(organizationId);
    if (!org) throw Object.assign(new Error('Organization not found'), { status: 404 });
    if (!org.settings) org.settings = {};
    const current = sanitizeScreeningSettings(org.settings.resumeScreening || {});
    const next = {
        ...current,
        enabled: payload.enabled != null ? !!payload.enabled : current.enabled,
        defaultMinimumMatchPercent: payload.defaultMinimumMatchPercent != null
            ? normalizeMinimumMatchPercent(payload.defaultMinimumMatchPercent, current.defaultMinimumMatchPercent)
            : current.defaultMinimumMatchPercent,
        retentionDays: payload.retentionDays != null
            ? Math.max(1, Number(payload.retentionDays))
            : current.retentionDays,
        requiredKeywordWeight: payload.requiredKeywordWeight != null
            ? Number(payload.requiredKeywordWeight)
            : current.requiredKeywordWeight,
        optionalKeywordWeight: payload.optionalKeywordWeight != null
            ? Number(payload.optionalKeywordWeight)
            : current.optionalKeywordWeight,
        autoDeleteEnabled: payload.autoDeleteEnabled != null
            ? !!payload.autoDeleteEnabled
            : current.autoDeleteEnabled,
        autoDeletedCount: current.autoDeletedCount,
    };
    org.settings.resumeScreening = next;
    org.markModified('settings');
    await org.save();
    return sanitizeScreeningSettings(next);
}

async function writeAudit({ organizationId, candidateId, jobPostingId, event, meta, actorId }) {
    try {
        await ScreeningAudit.create({
            organizationId,
            candidateId,
            jobPostingId,
            event,
            meta: meta || {},
            actorId: actorId || null,
        });
    } catch (err) {
        logger.warn('Screening audit write failed', { event, error: err.message });
    }
}

function normalizeKeyword(kw) {
    return String(kw || '').trim().toLowerCase();
}

/**
 * Shared keyword list normalizer for HR input + legacy DB values.
 * Splits commas / newlines / semicolons / pipes inside strings AND inside array elements.
 * Dedupes case-insensitively while preserving the first-seen casing.
 *
 * Examples:
 *   "React,Node.js,MongoDB" → ["React","Node.js","MongoDB"]
 *   ["React,Node","MongoDB"] → ["React","Node","MongoDB"]
 */
export function normalizeKeywordList(input) {
    const parts = [];
    const collect = (raw) => {
        if (raw == null) return;
        if (Array.isArray(raw)) {
            raw.forEach(collect);
            return;
        }
        String(raw)
            .split(/[\n,;|]+/)
            .forEach((piece) => {
                const trimmed = piece.trim();
                if (trimmed) parts.push(trimmed);
            });
    };
    collect(input);

    const seen = new Set();
    const out = [];
    for (const kw of parts) {
        const key = kw.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(kw);
    }
    return out;
}

/** Lowercased keyword list for matching (uses normalizeKeywordList for splitting). */
export function parseKeywordList(list) {
    return normalizeKeywordList(list).map((k) => k.toLowerCase());
}

/**
 * Parse a minimum-match value from job/settings/UI.
 * Accepts numbers and strings like "2" / "2%".
 * Only falls back when value is missing/invalid — never overrides a valid job-specific % (including 2%).
 */
export function normalizeMinimumMatchPercent(value, fallback = 70) {
    const parse = (v) => {
        if (v == null || v === '') return NaN;
        if (typeof v === 'number') return v;
        const raw = String(v).trim().replace(/%/g, '');
        if (raw === '') return NaN;
        return Number(raw);
    };

    const n = parse(value);
    if (Number.isFinite(n)) {
        if (n < 0) return 0;
        if (n > 100) return 100;
        return n;
    }

    const fb = parse(fallback);
    if (Number.isFinite(fb)) {
        if (fb < 0) return 0;
        if (fb > 100) return 100;
        return fb;
    }
    return 70;
}

/**
 * Prefer job/template screeningCriteria.minimumMatchPercent when present.
 */
export function resolveMinimumMatchPercent(criteria = {}, settings = {}) {
    const fromJob = criteria?.minimumMatchPercent;
    if (fromJob != null && fromJob !== '') {
        return normalizeMinimumMatchPercent(fromJob, settings?.defaultMinimumMatchPercent ?? 70);
    }
    return normalizeMinimumMatchPercent(
        settings?.defaultMinimumMatchPercent,
        70
    );
}

/**
 * Single source of truth for pass/fail before persistence.
 */
export function evaluateScreeningDecision(result = {}, minRequiredInput = 70) {
    // Use the provided threshold as-is when valid (including 2%). Do not force 70.
    const minRequired = normalizeMinimumMatchPercent(minRequiredInput, 70);
    const requiredTotal = Number(result.requiredTotal || 0);
    const requiredMatchPercent = Number(result.requiredMatchPercent);
    const matchScore = Number(result.matchScore);

    let thresholdScore;
    if (requiredTotal > 0) {
        // Required keywords determine eligibility — never fall back to an inflated matchScore.
        thresholdScore = Number.isFinite(requiredMatchPercent) ? requiredMatchPercent : 0;
    } else {
        thresholdScore = Number.isFinite(matchScore) ? matchScore : 0;
    }

    const passed = thresholdScore >= minRequired;
    return {
        passed,
        thresholdScore,
        minRequired,
        requiredTotal,
        requiredMatchPercent: Number.isFinite(requiredMatchPercent) ? requiredMatchPercent : 0,
        matchScore: Number.isFinite(matchScore) ? matchScore : 0,
    };
}

/**
 * Single API/UI source of truth for screening display.
 * Legacy status "skipped" normalizes to pending / not screened.
 */
export function normalizeResumeScreening(raw = {}) {
    const statusRaw = raw?.status || 'pending';
    const status = statusRaw === 'skipped' ? 'pending' : statusRaw;
    const normalizedStatus = ['passed', 'failed', 'pending'].includes(status) ? status : 'pending';

    const decision = normalizedStatus === 'passed'
        ? 'approved'
        : normalizedStatus === 'failed'
            ? 'rejected'
            : 'pending';

    const label = normalizedStatus === 'passed'
        ? (raw?.requiredMatchPercent != null || raw?.matchScore != null
            ? `Approved - ${Number(raw.requiredMatchPercent ?? raw.matchScore)}%`
            : 'Approved')
        : normalizedStatus === 'failed'
            ? (raw?.requiredMatchPercent != null || raw?.matchScore != null
                ? `Rejected - ${Number(raw.requiredMatchPercent ?? raw.matchScore)}%`
                : 'Rejected')
            : 'Pending - Not Screened';

    return {
        status: normalizedStatus,
        decision,
        label,
        displayStatus: label,
        matchScore: raw?.matchScore != null ? Number(raw.matchScore) : null,
        requiredMatchPercent: raw?.requiredMatchPercent != null ? Number(raw.requiredMatchPercent) : null,
        requiredTotal: raw?.requiredTotal != null ? Number(raw.requiredTotal) : null,
        matchedRequired: raw?.matchedRequired != null ? Number(raw.matchedRequired) : null,
        minimumRequired: raw?.minimumRequired != null ? Number(raw.minimumRequired) : null,
        matchedKeywords: Array.isArray(raw?.matchedKeywords) ? raw.matchedKeywords : [],
        missingKeywords: Array.isArray(raw?.missingKeywords) ? raw.missingKeywords : [],
        optionalMatched: Array.isArray(raw?.optionalMatched) ? raw.optionalMatched : [],
        reason: raw?.reason || null,
        screeningDate: raw?.screeningDate || raw?.screenedAt || null,
        screenedAt: raw?.screenedAt || raw?.screeningDate || null,
        rejectedDate: raw?.rejectedDate || null,
        deleteAfterDate: raw?.deleteAfterDate || null,
        parsedTextLength: Number(raw?.parsedTextLength || 0),
        runId: Number(raw?.runId || 0),
        isApproved: decision === 'approved',
        isRejected: decision === 'rejected',
        isPending: decision === 'pending',
        isFailed: normalizedStatus === 'failed',
        isPassed: normalizedStatus === 'passed',
    };
}

export function attachNormalizedScreening(candidate) {
    if (!candidate) return candidate;
    const obj = typeof candidate.toObject === 'function' ? candidate.toObject() : { ...candidate };
    obj.resumeScreening = normalizeResumeScreening(obj.resumeScreening || {});
    return obj;
}

/**
 * Repair conflicting status/decision pairs using status as authority when clear.
 * Does not recompute keyword scores.
 */
export function reconcileScreeningFields(resumeScreening = {}) {
    const rs = { ...(resumeScreening || {}) };
    if (rs.status === 'skipped') {
        rs.status = 'pending';
        rs.decision = 'pending';
    }
    if (rs.status === 'passed') rs.decision = 'approved';
    else if (rs.status === 'failed') rs.decision = 'rejected';
    else if (rs.status === 'pending' || !rs.status) {
        rs.status = 'pending';
        rs.decision = 'pending';
    }
    return rs;
}

/** Serialize screening per candidate to prevent Approved/Rejected race overwrites. */
const screeningLocks = new Map();

async function withScreeningLock(candidateId, fn) {
    const key = String(candidateId);
    while (screeningLocks.has(key)) {
        try {
            await screeningLocks.get(key);
        } catch {
            // previous run failed — continue
        }
    }
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    screeningLocks.set(key, gate);
    try {
        return await fn();
    } finally {
        screeningLocks.delete(key);
        release();
    }
}

function nextScreeningRunId(candidate) {
    const prev = Number(candidate.resumeScreening?.runId || 0);
    return prev + 1;
}

export function normalizeResumeText(text = '') {
    return String(text || '')
        .toLowerCase()
        .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, ' ')
        .replace(/[“”‘’]/g, '\'')
        .replace(/[–—]/g, '-')
        // pdf-parse page markers like "-- 1 of 1 --" must not count as resume content / keyword hits
        .replace(/\s*--\s*\d+\s+of\s+\d+\s*--/g, ' ')
        .replace(/\bpage\s+\d+\s+(?:of|\/)\s+\d+\b/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * True for empty / joke resumes (e.g. only "hello") that must never be Approved.
 */
export function isTrivialResumeText(text = '') {
    const cleaned = normalizeResumeText(text);
    if (!cleaned) return true;
    const words = cleaned.split(/\s+/).filter((w) => /[a-z0-9]/i.test(w));
    const alnumLen = cleaned.replace(/[^a-z0-9+#.]/gi, '').length;
    return words.length < 5 || alnumLen < 20;
}

function normalizeKeywordVariant(value = '') {
    return String(value || '')
        .toLowerCase()
        .replace(/[^a-z0-9+#.]/g, '');
}

function escapeRegExp(value = '') {
    return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function hasWholeWord(normalizedText, word) {
    if (!word) return false;
    return new RegExp(`(^|[^a-z0-9+#])${escapeRegExp(word)}([^a-z0-9+#]|$)`, 'i').test(normalizedText);
}

/** Conservative aliases for common tech keyword spellings. */
function expandKeywordAliases(keyword) {
    const k = normalizeKeyword(keyword);
    if (!k) return [];
    if (k === 'js' || k === 'javascript') return ['javascript', 'js'];
    if (k === 'ts' || k === 'typescript') return ['typescript', 'ts'];
    if (k === 'mongodb' || k === 'mongo db' || k === 'mongo.db') return ['mongodb', 'mongo db'];
    if (k === 'nodejs' || k === 'node.js' || k === 'node js') return ['node.js', 'nodejs', 'node js', 'node'];
    if (k === 'reactjs' || k === 'react.js' || k === 'react js') return ['react.js', 'reactjs', 'react js', 'react'];
    if (k === 'expressjs' || k === 'express.js' || k === 'express js') return ['express.js', 'expressjs', 'express js', 'express'];
    return [k];
}

function keywordPresentOne(normalizedText, normalizedKeyword) {
    if (!normalizedKeyword) return false;
    const escaped = escapeRegExp(normalizedKeyword);

    if (/^[a-z0-9]+$/i.test(normalizedKeyword)) {
        return hasWholeWord(normalizedText, normalizedKeyword);
    }

    const loosePattern = escaped
        .replace(/\\\./g, '[.\\s_-]*')
        .replace(/\\-/g, '[-\\s_]*')
        .replace(/\s+/g, '[.\\s_-]*');
    if (new RegExp(`(^|[^a-z0-9+#])${loosePattern}([^a-z0-9+#]|$)`, 'i').test(normalizedText)) {
        return true;
    }

    if (/^[a-z0-9]+\.js$/i.test(normalizedKeyword)) {
        const base = normalizedKeyword.slice(0, -3);
        if (hasWholeWord(normalizedText, base)) return true;
    }

    const compactKeyword = normalizeKeywordVariant(normalizedKeyword);
    const compactText = normalizeKeywordVariant(normalizedText);
    return compactKeyword.length >= 2 && compactText.includes(compactKeyword);
}

/** Match technical keywords conservatively while supporting common formatting variants. */
export function keywordPresent(textLower, keyword) {
    if (!keyword) return false;
    const normalizedText = normalizeResumeText(textLower);
    const aliases = expandKeywordAliases(keyword);
    return aliases.some((alias) => keywordPresentOne(normalizedText, alias));
}

export function calculateKeywordMatch(resumeText, criteria, weights = {}) {
    const text = normalizeResumeText(resumeText);
    const required = parseKeywordList(criteria?.requiredKeywords);
    const optional = parseKeywordList(criteria?.optionalKeywords);
    const wReq = Number(weights.requiredKeywordWeight ?? 1);
    const wOpt = Number(weights.optionalKeywordWeight ?? 0.5);

    const matchedRequired = required.filter((k) => keywordPresent(text, k));
    const missingRequired = required.filter((k) => !keywordPresent(text, k));
    const matchedOptional = optional.filter((k) => keywordPresent(text, k));

    const requiredMatchPercent = required.length > 0
        ? Math.round((matchedRequired.length / required.length) * 1000) / 10
        : 0;
    const optionalMatchPercent = optional.length > 0
        ? Math.round((matchedOptional.length / optional.length) * 1000) / 10
        : 0;

    let matchScore = requiredMatchPercent;
    if (required.length === 0 && optional.length > 0) {
        matchScore = optionalMatchPercent;
    } else if (required.length === 0 && optional.length === 0) {
        // Do NOT treat missing keyword configuration as a 100% match / auto-approve.
        matchScore = 0;
    }

    const weightedScore = (() => {
        const denom = required.length * wReq + optional.length * wOpt;
        if (denom <= 0) return matchScore;
        const numer = matchedRequired.length * wReq + matchedOptional.length * wOpt;
        return Math.round((numer / denom) * 1000) / 10;
    })();

    // Experience / education / certifications — soft signals (presence boosts optional side only logged)
    const softMatched = [];
    const softChecks = [
        ...(criteria?.experienceRequired ? [criteria.experienceRequired] : []),
        ...(criteria?.education ? [criteria.education] : []),
        ...(Array.isArray(criteria?.certifications) ? criteria.certifications : []),
    ].map(normalizeKeyword).filter(Boolean);
    for (const s of softChecks) {
        if (keywordPresent(text, s)) softMatched.push(s);
    }

    return {
        matchScore,
        weightedScore,
        requiredMatchPercent,
        optionalMatchPercent,
        matchedKeywords: matchedRequired,
        missingKeywords: missingRequired,
        optionalMatched: [...matchedOptional, ...softMatched.filter((s) => !matchedOptional.includes(s))],
        requiredTotal: required.length,
        optionalTotal: optional.length,
    };
}

export async function extractResumeText(resume) {
    if (!resume?.url) return '';
    const url = String(resume.url);

    try {
        if (url.startsWith('data:')) {
            const comma = url.indexOf(',');
            if (comma < 0) return '';
            const meta = url.slice(0, comma);
            const data = url.slice(comma + 1);
            const buffer = Buffer.from(data, meta.includes(';base64') ? 'base64' : 'utf8');
            return extractTextFromBuffer(buffer, resume.fileName || 'resume.pdf');
        }

        // Disk path under /uploads/...
        const relative = url.replace(/^\//, '');
        const fullPath = path.join(__dirname, '../public', relative);
        if (fs.existsSync(fullPath)) {
            const buffer = fs.readFileSync(fullPath);
            return extractTextFromBuffer(buffer, resume.fileName || path.basename(fullPath));
        }

        // Alternate uploads root used by some modules
        const alt = path.join(__dirname, '..', relative);
        if (fs.existsSync(alt)) {
            const buffer = fs.readFileSync(alt);
            return extractTextFromBuffer(buffer, resume.fileName || path.basename(alt));
        }
    } catch (err) {
        logger.debug('Resume text extract failed', { error: err.message });
    }
    return '';
}

export async function extractTextFromBuffer(buffer, fileName) {
    const ext = path.extname(fileName || '').toLowerCase();
    const fileSize = buffer?.length || 0;
    let text = '';
    try {
        if (ext === '.pdf' || !ext) {
            try {
                const { PDFParse } = await import('pdf-parse');
                const parser = new PDFParse({ data: buffer });
                try {
                    const data = await parser.getText();
                    text = normalizeResumeText(String(data?.text || '').slice(0, 50000));
                } finally {
                    await parser.destroy();
                }
            } catch (err) {
                logger.debug('pdf-parse failed', { error: err.message });
                text = '';
            }
        } else if (ext === '.docx') {
            try {
                const mammoth = await import('mammoth');
                const data = await mammoth.extractRawText({ buffer });
                text = normalizeResumeText(String(data?.value || '').slice(0, 50000));
            } catch (err) {
                logger.warn('DOCX extraction failed; using fallback', { fileName, error: err.message });
                text = normalizeResumeText(buffer.toString('utf8').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F]/g, ' ').slice(0, 50000));
            }
        } else if (ext === '.txt') {
            text = normalizeResumeText(buffer.toString('utf8').slice(0, 50000));
        } else if (ext === '.doc') {
            logger.debug('Legacy DOC extraction uses best-effort text fallback', { fileName });
            text = normalizeResumeText(buffer.toString('utf8').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F]/g, ' ').slice(0, 50000));
        } else {
            text = normalizeResumeText(buffer.toString('utf8').replace(/[^\x09\x0A\x0D\x20-\x7E\u00A0-\u024F]/g, ' ').slice(0, 50000));
        }
    } finally {
        logger.info('Resume screening debug', {
            stage: 'extractTextFromBuffer',
            fileType: ext || 'unknown',
            fileSize,
            extractedTextLength: String(text || '').length,
            extractionSuccess: String(text || '').length > 0,
        });
    }
    return text;
}

export function isScreeningFailed(candidate) {
    const normalized = normalizeResumeScreening(candidate?.resumeScreening || {});
    return normalized.status === 'failed' || normalized.decision === 'rejected';
}

export function isRecruitmentActionBlocked(candidate) {
    return isScreeningFailed(candidate);
}

function hasCompletedScreeningResult(resumeScreening = {}) {
    return resumeScreening?.status === 'passed' || resumeScreening?.status === 'failed';
}

/**
 * Apply pass/fail result onto candidate and persist.
 * ONLY place that may set Approved (passed) or Rejected (failed).
 */
async function applyPassFail(candidate, {
    result,
    minRequired,
    settings,
    jobId,
    jobTitle = null,
    requiredKeywords = null,
    optionalKeywords = null,
    runId = null,
    isDuplicate = false,
}) {
    const decision = evaluateScreeningDecision(result, minRequired);
    const {
        passed,
        thresholdScore,
        minRequired: resolvedMin,
        requiredTotal,
        requiredMatchPercent,
        matchScore,
    } = decision;

    const thisRunId = runId != null ? runId : nextScreeningRunId(candidate);

    // Ignore stale concurrent writers
    const latest = await Candidate.findById(candidate._id).select('resumeScreening.runId');
    if (latest?.resumeScreening?.runId != null
        && Number(latest.resumeScreening.runId) > Number(thisRunId)) {
        logScreeningDebug({
            stage: 'applyPassFail:stale-ignored',
            candidateId: candidate._id,
            runId: thisRunId,
            newerRunId: latest.resumeScreening.runId,
        });
        return Candidate.findById(candidate._id);
    }

    const matchedRequiredCount = Array.isArray(result.matchedKeywords)
        ? result.matchedKeywords.length
        : 0;
    const now = new Date();

    candidate.resumeScreening = candidate.resumeScreening || {};
    candidate.resumeScreening.runId = thisRunId;
    candidate.resumeScreening.matchedKeywords = result.matchedKeywords || [];
    candidate.resumeScreening.missingKeywords = result.missingKeywords || [];
    candidate.resumeScreening.optionalMatched = result.optionalMatched || [];
    candidate.resumeScreening.matchScore = matchScore;
    candidate.resumeScreening.requiredMatchPercent = requiredMatchPercent;
    candidate.resumeScreening.requiredTotal = requiredTotal;
    candidate.resumeScreening.matchedRequired = matchedRequiredCount;
    candidate.resumeScreening.minimumRequired = resolvedMin;
    candidate.resumeScreening.screeningDate = now;
    candidate.resumeScreening.screenedAt = now;
    candidate.resumeScreening.parsedTextLength = result.parsedTextLength || 0;

    if (!candidate.scores) candidate.scores = {};
    candidate.scores.resumeScore = matchScore;

    logScreeningDebug({
        stage: 'applyPassFail:final-decision',
        candidateId: candidate._id,
        candidateEmail: candidate.email || null,
        jobId: jobId || candidate.jobPostingId || null,
        jobTitle,
        isDuplicate: !!isDuplicate,
        requiredKeywords: requiredKeywords || [],
        optionalKeywords: optionalKeywords || [],
        minimumMatchPercent: resolvedMin,
        extractedTextLength: result.parsedTextLength || 0,
        matchedRequired: result.matchedKeywords || [],
        missingRequired: result.missingKeywords || [],
        requiredTotal,
        requiredMatchPercent,
        finalDecision: passed ? 'approved' : 'rejected',
        finalStatus: passed ? 'passed' : 'failed',
        thresholdScore,
    });

    if (passed) {
        candidate.resumeScreening.status = 'passed';
        candidate.resumeScreening.decision = 'approved';
        candidate.resumeScreening.reason = null;
        candidate.resumeScreening.rejectedDate = undefined;
        candidate.resumeScreening.deleteAfterDate = undefined;
        if (candidate.status === 'Rejected' && candidate.stage === 'Rejected') {
            candidate.status = 'Applied';
            candidate.stage = 'Application';
        }
        candidate.tags = (candidate.tags || []).filter((t) => t !== 'Screening Failed');
        if (!candidate.tags.includes('Screening Passed')) candidate.tags.push('Screening Passed');
        candidate.markModified('resumeScreening');
        await candidate.save();

        await writeAudit({
            organizationId: candidate.organizationId,
            candidateId: candidate._id,
            jobPostingId: jobId || candidate.jobPostingId,
            event: 'screening_completed',
            meta: {
                status: 'passed',
                decision: 'approved',
                matchScore,
                requiredMatchPercent,
                requiredTotal,
                matchedRequired: matchedRequiredCount,
                minimumRequired: resolvedMin,
                thresholdScore,
                runId: thisRunId,
            },
        });
    } else {
        const deleteAfter = new Date();
        deleteAfter.setDate(deleteAfter.getDate() + (settings?.retentionDays || 7));

        candidate.resumeScreening.status = 'failed';
        candidate.resumeScreening.decision = 'rejected';
        candidate.resumeScreening.reason = 'Failed Screening';
        candidate.resumeScreening.rejectedDate = now;
        candidate.resumeScreening.deleteAfterDate = deleteAfter;
        candidate.status = 'Rejected';
        candidate.stage = 'Rejected';
        candidate.tags = (candidate.tags || []).filter((t) => t !== 'Screening Passed');
        if (!candidate.tags.includes('Screening Failed')) candidate.tags.push('Screening Failed');
        candidate.notes = candidate.notes || [];
        candidate.notes.push({
            note: `Automatic screening failed: required match ${thresholdScore}% < required ${resolvedMin}%. Missing: ${(result.missingKeywords || []).join(', ') || 'n/a'}`,
            addedAt: now,
        });
        candidate.markModified('resumeScreening');
        await candidate.save();

        await writeAudit({
            organizationId: candidate.organizationId,
            candidateId: candidate._id,
            jobPostingId: jobId || candidate.jobPostingId,
            event: 'screening_completed',
            meta: {
                status: 'failed',
                decision: 'rejected',
                matchScore,
                requiredMatchPercent,
                requiredTotal,
                matchedRequired: matchedRequiredCount,
                minimumRequired: resolvedMin,
                thresholdScore,
                runId: thisRunId,
            },
        });
    }
    return candidate;
}

function logScreeningDebug(payload = {}) {
    logger.info('Resume screening debug', payload);
}

/** Pure guard used by screenCandidateById — exported for unit tests. */
export function shouldSkipBlindForceRescreen({
    force = false,
    completed = false,
    hasOverride = false,
    replaceCompleted = false,
} = {}) {
    return !!(force && completed && !hasOverride && !replaceCompleted);
}

export function hasMeaningfulKeywordMatch(result = {}) {
    const matchedRequired = Array.isArray(result.matchedKeywords) ? result.matchedKeywords.length : 0;
    const requiredTotal = Number(result.requiredTotal || 0);
    if (requiredTotal > 0) return matchedRequired > 0;
    const matchedOptional = Array.isArray(result.optionalMatched) ? result.optionalMatched.length : 0;
    return matchedOptional > 0 || Number(result.matchScore || 0) > 0;
}

/**
 * Not screened yet (unassigned / no criteria / disabled).
 * Must NEVER show as Approved or Rejected.
 */
async function markNotScreened(candidate, {
    reason,
    parsedTextLength = 0,
    matchScore = null,
    missingKeywords = [],
    minimumRequired = null,
    runId = null,
} = {}) {
    const thisRunId = runId != null ? runId : nextScreeningRunId(candidate);
    const latest = await Candidate.findById(candidate._id).select('resumeScreening.runId');
    if (latest?.resumeScreening?.runId != null
        && Number(latest.resumeScreening.runId) > Number(thisRunId)) {
        return Candidate.findById(candidate._id);
    }

    candidate.resumeScreening = {
        status: 'pending',
        decision: 'pending',
        matchScore,
        requiredMatchPercent: null,
        requiredTotal: null,
        matchedRequired: null,
        matchedKeywords: [],
        missingKeywords,
        optionalMatched: [],
        minimumRequired,
        screeningDate: new Date(),
        screenedAt: new Date(),
        reason: reason || 'Pending / Not Screened',
        parsedTextLength,
        runId: thisRunId,
    };
    candidate.tags = (candidate.tags || []).filter((t) => t !== 'Screening Passed' && t !== 'Screening Failed');
    if (candidate.status === 'Rejected' || candidate.stage === 'Rejected') {
        candidate.status = 'Applied';
        candidate.stage = 'Application';
    }
    candidate.markModified('resumeScreening');
    await candidate.save();

    logScreeningDebug({
        stage: 'markNotScreened',
        candidateId: candidate._id,
        jobId: candidate.jobPostingId || null,
        finalScreeningStatus: 'pending',
        finalDecision: 'pending',
        reason: candidate.resumeScreening.reason,
        runId: thisRunId,
    });

    return candidate;
}

/** @deprecated alias — legacy callers */
async function markUnassignedScreening(candidate, opts = {}) {
    return markNotScreened(candidate, opts);
}

/**
 * When the linked job has no keywords (e.g. Resume Inbox Unassigned),
 * score against all Open jobs with criteria, then against active templates.
 * Auto-assigns the best matching job when there is a meaningful keyword match.
 */
/**
 * When the linked job has no keywords (e.g. Resume Inbox Unassigned),
 * score against all Open jobs with criteria, then against active templates.
 * Auto-assigns the best matching job when there is a meaningful keyword match.
 */
export async function autoMatchAndScreenCandidate(candidateId, {
    force = false,
    resumeTextOverride = null,
    isDuplicate = false,
    replaceCompleted = false,
} = {}) {
    return withScreeningLock(candidateId, () => autoMatchAndScreenCandidateUnlocked(candidateId, {
        force,
        resumeTextOverride,
        isDuplicate,
        replaceCompleted,
    }));
}

async function autoMatchAndScreenCandidateUnlocked(candidateId, {
    force = false,
    resumeTextOverride = null,
    isDuplicate = false,
    replaceCompleted = false,
} = {}) {
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return null;

    if (!force && hasCompletedScreeningResult(candidate.resumeScreening)) {
        return candidate;
    }

    const runId = nextScreeningRunId(candidate);
    candidate.resumeScreening = candidate.resumeScreening || {};
    candidate.resumeScreening.runId = runId;
    await candidate.save();

    const settings = await getResumeScreeningSettings(candidate.organizationId);
    if (!settings.enabled) {
        return markNotScreened(candidate, {
            reason: 'Screening disabled for organization',
            runId,
        });
    }

    const currentJob = candidate.jobPostingId
        ? await Recruitment.findById(candidate.jobPostingId)
        : null;
    const isHolding = !!(currentJob?.tags || []).includes(HOLDING_JOB_TAG);
    const currentCriteria = currentJob?.screeningCriteria || {};
    const currentHasCriteria = parseKeywordList(currentCriteria.requiredKeywords).length > 0
        || parseKeywordList(currentCriteria.optionalKeywords).length > 0;

    if (currentJob && !isHolding && currentHasCriteria && currentCriteria.enabled !== false) {
        return screenCandidateByIdUnlocked(candidateId, {
            force: true,
            runId,
            resumeTextOverride,
            isDuplicate,
            replaceCompleted,
        });
    }

    await writeAudit({
        organizationId: candidate.organizationId,
        candidateId: candidate._id,
        jobPostingId: candidate.jobPostingId,
        event: 'screening_started',
        meta: { source: candidate.source, mode: 'auto_match', isDuplicate: !!isDuplicate },
    });

    let resumeText = '';
    if (resumeTextOverride != null && String(resumeTextOverride).trim()) {
        resumeText = String(resumeTextOverride);
    } else {
        resumeText = await extractResumeText(candidate.resume);
    }
    const combined = [resumeText, candidate.coverLetter || ''].join('\n');
    const normalizedCombined = normalizeResumeText(combined);
    const extractedTextLength = normalizedCombined.length;

    logScreeningDebug({
        stage: 'autoMatchAndScreenCandidate',
        candidateId: candidate._id,
        candidateEmail: candidate.email || null,
        jobId: currentJob?._id || null,
        jobTitle: currentJob?.jobTitle || null,
        isDuplicate: !!isDuplicate,
        extractedTextLength,
        holdingJob: isHolding,
    });

    if (!normalizedCombined) {
        if (!force && hasCompletedScreeningResult(candidate.resumeScreening)) {
            logScreeningDebug({
                stage: 'autoMatchAndScreenCandidate',
                candidateId: candidate._id,
                extractedTextLength: 0,
                finalDecision: 'keep_existing_valid_result',
                existingStatus: candidate.resumeScreening.status,
            });
            return candidate;
        }
        return markNotScreened(candidate, {
            reason: 'Resume text could not be extracted',
            parsedTextLength: 0,
            matchScore: null,
            runId,
        });
    }

    // Joke / near-empty content while still unassigned → Pending (not false Rejected · 0%)
    if (isTrivialResumeText(normalizedCombined)) {
        if (!force && hasCompletedScreeningResult(candidate.resumeScreening)) {
            return candidate;
        }
        return markNotScreened(candidate, {
            reason: 'Job could not be identified',
            parsedTextLength: combined.length,
            matchScore: null,
            runId,
        });
    }

    const openJobs = await Recruitment.find({
        organizationId: candidate.organizationId,
        status: 'Open',
        isActive: true,
        tags: { $ne: HOLDING_JOB_TAG },
    }).lean();

    const jobsWithCriteria = openJobs.filter((j) => {
        const c = j.screeningCriteria || {};
        if (c.enabled === false) return false;
        return parseKeywordList(c.requiredKeywords).length > 0
            || parseKeywordList(c.optionalKeywords).length > 0;
    });

    let best = null;
    for (const j of jobsWithCriteria) {
        const result = calculateKeywordMatch(combined, j.screeningCriteria, settings);
        result.parsedTextLength = combined.length;
        const minRequired = resolveMinimumMatchPercent(j.screeningCriteria, settings);
        const decisionPreview = evaluateScreeningDecision(result, minRequired);

        logScreeningDebug({
            stage: 'calculateKeywordMatch',
            candidateId: candidate._id,
            candidateEmail: candidate.email || null,
            jobId: j._id,
            jobTitle: j.jobTitle,
            isDuplicate: !!isDuplicate,
            extractedTextLength,
            requiredKeywords: parseKeywordList(j.screeningCriteria?.requiredKeywords),
            optionalKeywords: parseKeywordList(j.screeningCriteria?.optionalKeywords),
            minimumMatchPercent: minRequired,
            matchedRequired: result.matchedKeywords,
            missingRequired: result.missingKeywords,
            requiredTotal: result.requiredTotal,
            requiredMatchPercent: result.requiredMatchPercent,
            matchScore: result.matchScore,
            thresholdScore: decisionPreview.thresholdScore,
            passed: decisionPreview.passed,
        });

        if (!hasMeaningfulKeywordMatch(result) && !decisionPreview.passed) continue;

        const rank = decisionPreview.thresholdScore;
        if (!best || rank > best.rank) {
            best = { type: 'job', job: j, result, minRequired, rank };
        }
    }

    if (!best) {
        const templates = await ResumeScreeningTemplate.find({
            organizationId: candidate.organizationId,
            isActive: true,
        }).lean();
        for (const t of templates) {
            const criteria = {
                requiredKeywords: t.requiredKeywords,
                optionalKeywords: t.optionalKeywords,
            };
            if (parseKeywordList(criteria.requiredKeywords).length === 0
                && parseKeywordList(criteria.optionalKeywords).length === 0) {
                continue;
            }
            const result = calculateKeywordMatch(combined, criteria, settings);
            result.parsedTextLength = combined.length;
            const minRequired = resolveMinimumMatchPercent(
                { minimumMatchPercent: t.minimumMatchPercent },
                settings
            );
            const decisionPreview = evaluateScreeningDecision(result, minRequired);
            if (!hasMeaningfulKeywordMatch(result) && !decisionPreview.passed) continue;
            const rank = decisionPreview.thresholdScore;
            if (!best || rank > best.rank) {
                best = { type: 'template', template: t, result, minRequired, rank };
            }
        }
    }

    if (!best) {
        logScreeningDebug({
            stage: 'autoMatchAndScreenCandidate',
            candidateId: candidate._id,
            candidateEmail: candidate.email || null,
            jobId: null,
            jobTitle: null,
            isDuplicate: !!isDuplicate,
            extractedTextLength,
            finalStatus: 'pending',
            finalDecision: 'pending',
            reason: 'Job could not be identified',
        });
        return markNotScreened(candidate, {
            reason: 'Job could not be identified',
            parsedTextLength: combined.length,
            matchScore: null,
            runId,
        });
    }

    if (best.type === 'job') {
        candidate.jobPostingId = best.job._id;
        candidate.tags = (candidate.tags || []).filter((t) => t !== UNASSIGNED_TAG);
        if (candidate.emailImport) candidate.emailImport.unassigned = false;
        if (best.job.primaryRecruiterId || best.job.recruiter) {
            candidate.primaryRecruiterId = best.job.primaryRecruiterId || best.job.recruiter;
        }
        await candidate.save();

        logScreeningDebug({
            stage: 'autoMatchAndScreenCandidate',
            candidateId: candidate._id,
            candidateEmail: candidate.email || null,
            jobId: best.job._id,
            jobTitle: best.job.jobTitle,
            isDuplicate: !!isDuplicate,
            extractedTextLength,
            requiredKeywords: parseKeywordList(best.job.screeningCriteria?.requiredKeywords),
            matchedRequired: best.result.matchedKeywords,
            missingRequired: best.result.missingKeywords,
            requiredMatchPercent: best.result.requiredMatchPercent,
            matchScore: best.result.matchScore,
            minimumMatchPercent: best.minRequired,
            finalDecision: 'assigned_job_for_normal_screening',
        });

        return screenCandidateByIdUnlocked(candidate._id, {
            force: true,
            runId,
            resumeTextOverride: combined,
            isDuplicate,
            replaceCompleted,
        });
    }

    if (!candidate.notes) candidate.notes = [];
    candidate.notes.push({
        note: `Auto-screened using template "${best.template.name}"`,
        addedAt: new Date(),
    });

    return applyPassFail(candidate, {
        result: best.result,
        minRequired: best.minRequired,
        settings,
        jobId: candidate.jobPostingId,
        jobTitle: currentJob?.jobTitle || best.template?.name || null,
        requiredKeywords: parseKeywordList(best.template.requiredKeywords),
        optionalKeywords: parseKeywordList(best.template.optionalKeywords),
        runId,
        isDuplicate,
    });
}

/**
 * Run screening for a candidate id. Idempotent if already completed (passed/failed).
 * If linked job has no keywords, auto-matches Open jobs / active templates.
 */
export async function screenCandidateById(candidateId, {
    force = false,
    resumeTextOverride = null,
    isDuplicate = false,
    /** Explicit admin/inbox-assign rescreen may replace a completed result without override text. */
    replaceCompleted = false,
} = {}) {
    return withScreeningLock(candidateId, () => screenCandidateByIdUnlocked(candidateId, {
        force,
        resumeTextOverride,
        isDuplicate,
        replaceCompleted,
    }));
}

async function screenCandidateByIdUnlocked(candidateId, {
    force = false,
    runId: existingRunId = null,
    resumeTextOverride = null,
    isDuplicate = false,
    replaceCompleted = false,
} = {}) {
    const candidate = await Candidate.findById(candidateId);
    if (!candidate) return null;

    const statusBefore = candidate.resumeScreening?.status || 'pending';
    const decisionBefore = candidate.resumeScreening?.decision || 'pending';
    const candidateStatusBefore = candidate.status;
    const candidateStageBefore = candidate.stage;
    const jobPostingIdBefore = candidate.jobPostingId;
    const hasOverride = !!(resumeTextOverride != null && String(resumeTextOverride).trim());
    const completed = hasCompletedScreeningResult(candidate.resumeScreening);

    // Non-force: never touch a finished result (also protects listImports race after inbox Approved).
    if (!force && completed) {
        logScreeningDebug({
            stage: 'SCREENING_SKIP_ALREADY_COMPLETE',
            candidateId: candidate._id,
            candidateEmail: candidate.email || null,
            finalStatus: statusBefore,
            finalDecision: decisionBefore,
        });
        return candidate;
    }

    // Blind force without new text must NOT wipe a scored Approved/Rejected (inbox list race).
    if (shouldSkipBlindForceRescreen({
        force,
        completed,
        hasOverride,
        replaceCompleted,
    })) {
        logScreeningDebug({
            stage: 'SCREENING_SKIP_BLIND_FORCE',
            candidateId: candidate._id,
            candidateEmail: candidate.email || null,
            jobPostingId: jobPostingIdBefore,
            finalStatus: statusBefore,
            finalDecision: decisionBefore,
            requiredMatchPercent: candidate.resumeScreening?.requiredMatchPercent,
            reason: 'Refusing force re-screen without resumeTextOverride/replaceCompleted',
        });
        return candidate;
    }

    const runId = existingRunId != null ? existingRunId : nextScreeningRunId(candidate);
    candidate.resumeScreening = candidate.resumeScreening || {};
    candidate.resumeScreening.runId = runId;
    if (force && completed) {
        candidate.resumeScreening.status = 'pending';
        candidate.resumeScreening.decision = 'pending';
        candidate.resumeScreening.reason = 'Re-screening in progress';
    }
    await candidate.save();

    const settings = await getResumeScreeningSettings(candidate.organizationId);
    const job = await Recruitment.findById(candidate.jobPostingId);

    const criteria = job?.screeningCriteria || {};
    const jobEnabled = criteria.enabled !== false;
    const required = parseKeywordList(criteria.requiredKeywords);
    const optional = parseKeywordList(criteria.optionalKeywords);
    const hasCriteria = required.length > 0 || optional.length > 0;
    const isHolding = !!(job?.tags || []).includes(HOLDING_JOB_TAG);
    const minRequired = resolveMinimumMatchPercent(criteria, settings);

    logScreeningDebug({
        stage: 'SCREENING_START',
        candidateId: candidate._id,
        candidateEmail: candidate.email || null,
        jobPostingIdBefore,
        matchedJobId: job?._id || null,
        matchedJobTitle: job?.jobTitle || null,
        isDuplicate: !!isDuplicate,
        resumeFilePath: candidate.resume?.url || null,
        minimumMatchPercent: minRequired,
        requiredKeywords: required,
        optionalKeywords: optional,
        statusBefore,
        decisionBefore,
        candidateStatusBefore,
        candidateStageBefore,
        force: !!force,
        hasOverride,
        holdingJob: isHolding,
        hasCriteria,
    });

    if (!settings.enabled) {
        return markNotScreened(candidate, {
            reason: 'Screening disabled for organization',
            runId,
        });
    }

    // Holding / missing job → try auto-match Open jobs
    if (!job || isHolding) {
        return autoMatchAndScreenCandidateUnlocked(candidateId, {
            force: true,
            resumeTextOverride,
            isDuplicate,
            replaceCompleted,
        });
    }

    // Real job with screening disabled or no keywords → Pending (never auto-approve)
    if (!jobEnabled || !hasCriteria) {
        return markNotScreened(candidate, {
            reason: 'No screening criteria configured',
            runId,
        });
    }

    await writeAudit({
        organizationId: candidate.organizationId,
        candidateId: candidate._id,
        jobPostingId: candidate.jobPostingId,
        event: 'screening_started',
        meta: { source: candidate.source, isDuplicate: !!isDuplicate },
    });

    // Prefer text already extracted during inbox import (same buffer) over a second disk read.
    let resumeText = '';
    if (hasOverride) {
        resumeText = String(resumeTextOverride);
    } else {
        resumeText = await extractResumeText(candidate.resume);
    }
    const combined = [resumeText, candidate.coverLetter || ''].join('\n');
    const normalizedCombined = normalizeResumeText(combined);
    const extractedTextLength = normalizedCombined.length;

    // Extraction failure → Pending. Never fake Rejected · 0%.
    if (!normalizedCombined) {
        if (!force && hasCompletedScreeningResult(candidate.resumeScreening)) {
            logScreeningDebug({
                stage: 'SCREENING_RESULT',
                candidateId: candidate._id,
                extractedTextLength: 0,
                finalDecision: 'keep_existing_valid_result',
                existingStatus: candidate.resumeScreening.status,
            });
            return candidate;
        }
        return markNotScreened(candidate, {
            reason: 'Resume text could not be extracted',
            parsedTextLength: 0,
            matchScore: null,
            missingKeywords: required,
            minimumRequired: minRequired,
            runId,
        });
    }

    const result = calculateKeywordMatch(combined, criteria, settings);
    result.parsedTextLength = combined.length;

    const decisionPreview = evaluateScreeningDecision(result, minRequired);
    logScreeningDebug({
        stage: 'SCREENING_RESULT',
        candidateId: candidate._id,
        candidateEmail: candidate.email || null,
        matchedJobId: job._id,
        matchedJobTitle: job.jobTitle,
        isDuplicate: !!isDuplicate,
        resumeFilePath: candidate.resume?.url || null,
        extractedTextLength,
        minimumMatchPercent: minRequired,
        requiredKeywords: required,
        optionalKeywords: optional,
        matchedRequired: result.matchedKeywords,
        missingRequired: result.missingKeywords,
        requiredTotal: result.requiredTotal,
        requiredMatchPercent: result.requiredMatchPercent,
        matchScore: result.matchScore,
        statusBefore,
        decisionBefore,
        candidateStatusBefore,
        candidateStageBefore,
        finalDecision: decisionPreview.passed ? 'approved' : 'rejected',
        finalStatus: decisionPreview.passed ? 'passed' : 'failed',
    });

    const screened = await applyPassFail(candidate, {
        result,
        minRequired,
        settings,
        jobId: candidate.jobPostingId,
        jobTitle: job.jobTitle,
        requiredKeywords: required,
        optionalKeywords: optional,
        runId,
        isDuplicate,
    });

    // Re-fetch from MongoDB — authoritative persisted values
    const persisted = await Candidate.findById(screened._id)
        .select('email status stage jobPostingId resumeScreening resume')
        .lean();
    logScreeningDebug({
        stage: 'SCREENING_SAVE',
        candidateId: persisted?._id,
        candidateEmail: persisted?.email || null,
        jobPostingId: persisted?.jobPostingId || null,
        isDuplicate: !!isDuplicate,
        statusAfter: persisted?.resumeScreening?.status,
        decisionAfter: persisted?.resumeScreening?.decision,
        matchScore: persisted?.resumeScreening?.matchScore,
        requiredMatchPercent: persisted?.resumeScreening?.requiredMatchPercent,
        minimumMatchPercent: persisted?.resumeScreening?.minimumRequired,
        matchedRequired: persisted?.resumeScreening?.matchedRequired,
        requiredTotal: persisted?.resumeScreening?.requiredTotal,
        candidateStatusAfter: persisted?.status,
        candidateStageAfter: persisted?.stage,
        statusBefore,
        decisionBefore,
        candidateStatusBefore,
        candidateStageBefore,
    });

    return screened;
}


function deleteResumeFile(resume) {
    if (!resume?.url || String(resume.url).startsWith('data:')) return;
    try {
        const relative = String(resume.url).replace(/^\//, '');
        const fullPath = path.join(__dirname, '../public', relative);
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
    } catch (err) {
        logger.debug('Resume file delete failed', { error: err.message });
    }
}

/**
 * Hard-delete a failed-screening candidate (manual or auto retention).
 */
export async function hardDeleteScreenedCandidate(candidateId, { organizationId, actorId, auto = false } = {}) {
    const query = { _id: candidateId };
    if (organizationId) query.organizationId = organizationId;
    const candidate = await Candidate.findOne(query);
    if (!candidate) throw Object.assign(new Error('Candidate not found'), { status: 404 });

    deleteResumeFile(candidate.resume);
    deleteResumeFile(candidate.coverLetterAttachment);

    const orgId = candidate.organizationId;
    const jobId = candidate.jobPostingId;

    await Candidate.deleteOne({ _id: candidate._id });

    await writeAudit({
        organizationId: orgId,
        candidateId: candidate._id,
        jobPostingId: jobId,
        event: auto ? 'auto_deleted' : 'manual_deleted',
        meta: {
            name: `${candidate.firstName} ${candidate.lastName}`,
            email: candidate.email,
            matchScore: candidate.resumeScreening?.matchScore,
        },
        actorId,
    });

    if (auto) {
        await Organization.findByIdAndUpdate(orgId, {
            $inc: { 'settings.resumeScreening.autoDeletedCount': 1 },
        });
    }

    return { deleted: true, candidateId: candidate._id };
}

/**
 * Retention cleanup — delete failed screening candidates past deleteAfterDate.
 */
export async function processScreeningRetention() {
    const now = new Date();
    const due = await Candidate.find({
        'resumeScreening.status': 'failed',
        'resumeScreening.deleteAfterDate': { $lte: now },
    }).select('_id organizationId').lean();

    let deleted = 0;
    let errors = 0;
    for (const c of due) {
        const settings = await getResumeScreeningSettings(c.organizationId);
        if (!settings.autoDeleteEnabled) continue;
        try {
            await hardDeleteScreenedCandidate(c._id, { organizationId: c.organizationId, auto: true });
            deleted += 1;
        } catch (err) {
            errors += 1;
            logger.warn('Screening retention delete failed', { candidateId: c._id, error: err.message });
        }
    }
    return { scanned: due.length, deleted, errors };
}

export async function getJobScreeningStats(organizationId, jobPostingId) {
    const match = {
        organizationId,
        jobPostingId,
        archivedAt: null,
    };
    const [approved, rejected, pending, scored] = await Promise.all([
        Candidate.countDocuments({ ...match, 'resumeScreening.status': 'passed' }),
        Candidate.countDocuments({ ...match, 'resumeScreening.status': 'failed' }),
        Candidate.countDocuments({
            ...match,
            $or: [
                { 'resumeScreening.status': 'pending' },
                { resumeScreening: { $exists: false } },
            ],
        }),
        Candidate.find({
            ...match,
            'resumeScreening.matchScore': { $ne: null },
        })
            .select('firstName lastName email resumeScreening.matchScore resumeScreening.status')
            .sort({ 'resumeScreening.matchScore': -1 })
            .limit(10)
            .lean(),
    ]);

    const avgAgg = await Candidate.aggregate([
        { $match: { ...match, 'resumeScreening.matchScore': { $ne: null } } },
        { $group: { _id: null, avg: { $avg: '$resumeScreening.matchScore' } } },
    ]);

    return {
        approvedCandidates: approved,
        rejectedCandidates: rejected,
        pendingScreening: pending,
        averageMatchScore: avgAgg[0]?.avg != null ? Math.round(avgAgg[0].avg * 10) / 10 : null,
        topMatchingCandidates: scored,
    };
}

export async function getScreeningDashboard(organizationId) {
    const settings = await getResumeScreeningSettings(organizationId);
    const base = { organizationId, archivedAt: null };
    const [approved, rejected, pending, avgAgg] = await Promise.all([
        Candidate.countDocuments({ ...base, 'resumeScreening.status': 'passed' }),
        Candidate.countDocuments({ ...base, 'resumeScreening.status': 'failed' }),
        Candidate.countDocuments({
            ...base,
            $or: [
                { 'resumeScreening.status': 'pending' },
                { resumeScreening: { $exists: false } },
            ],
        }),
        Candidate.aggregate([
            { $match: { ...base, 'resumeScreening.matchScore': { $ne: null } } },
            { $group: { _id: null, avg: { $avg: '$resumeScreening.matchScore' } } },
        ]),
    ]);
    return {
        approvedCandidates: approved,
        rejectedCandidates: rejected,
        pendingScreening: pending,
        averageMatchScore: avgAgg[0]?.avg != null ? Math.round(avgAgg[0].avg * 10) / 10 : null,
        candidatesDeletedAutomatically: settings.autoDeletedCount,
        settings,
    };
}

export { DEFAULT_SETTINGS };
