/**
 * Single display mapping for resume screening across Recruitment UI.
 * Source of truth is candidate.resumeScreening from applyPassFail / markNotScreened.
 * Frontend must NOT recalculate Approved/Rejected — only display this mapping.
 */

/**
 * Parse job/template minimum match % for save payloads.
 * Preserves low valid values like 2%. Only falls back when empty/invalid.
 */
export function parseMinimumMatchPercent(value, fallback = 70) {
    if (value == null || value === '') return fallback;
    const n = Number(String(value).trim().replace(/%/g, ''));
    if (!Number.isFinite(n)) return fallback;
    if (n < 0) return 0;
    if (n > 100) return 100;
    return n;
}

/**
 * Normalize HR keyword input (comma / newline / semicolon / array CSV) into
 * individual keywords. Mirrors server normalizeKeywordList.
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

export function normalizeResumeScreening(raw = {}) {
    const statusRaw = raw?.status || 'pending';
    // Legacy "skipped" = not screened (never treat as Approved/Rejected)
    const status = statusRaw === 'skipped' ? 'pending' : statusRaw;
    const normalizedStatus = ['passed', 'failed', 'pending'].includes(status) ? status : 'pending';

    const decision = normalizedStatus === 'passed'
        ? 'approved'
        : normalizedStatus === 'failed'
            ? 'rejected'
            : 'pending';

    const score = raw?.requiredMatchPercent != null
        ? Number(raw.requiredMatchPercent)
        : (raw?.matchScore != null ? Number(raw.matchScore) : null);

    let label;
    if (normalizedStatus === 'passed') {
        label = score != null ? `Approved · ${score}%` : 'Approved';
    } else if (normalizedStatus === 'failed') {
        label = score != null ? `Rejected · ${score}%` : 'Rejected';
    } else {
        label = 'Pending - Not Screened';
    }

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
        isApproved: decision === 'approved',
        isRejected: decision === 'rejected',
        isPending: decision === 'pending',
        isFailed: normalizedStatus === 'failed',
        isPassed: normalizedStatus === 'passed',
    };
}

export function getScreeningBadgeClasses(screening) {
    const s = normalizeResumeScreening(screening);
    if (s.isApproved) return 'bg-emerald-100 text-emerald-800';
    if (s.isRejected) return 'bg-red-100 text-red-800';
    return 'bg-amber-100 text-amber-800';
}

/**
 * Display screening decision; duplicate is an additive flag, not the decision.
 * e.g. "Duplicate · Approved · 66.7%"
 */
export function formatScreeningDisplayLabel(screening, { isDuplicate = false } = {}) {
    const s = normalizeResumeScreening(screening);
    if (isDuplicate) return `Duplicate · ${s.label}`;
    return s.label;
}
