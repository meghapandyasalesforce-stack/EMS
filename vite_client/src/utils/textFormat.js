/**
 * Display-only text formatting for HRMS UI.
 * Does not mutate API values, database fields, or internal enum keys.
 */

const LOWERCASE_WORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'of', 'by', 'for', 'in', 'on', 'at', 'to', 'from', 'with', 'as'
]);

const KNOWN_ACRONYMS = new Set([
    'hr', 'it', 'wfh', 'id', 'pan', 'aadhaar', 'lop', 'ceo', 'cto', 'cfo', 'vp', 'ats', 'sla', 'pdf', 'api'
]);

const OBJECT_ID_RE = /^[a-f0-9]{24}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^https?:\/\//i;
const TICKET_ID_RE = /^TKT-/i;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Skip values that should never be auto-formatted for display. */
export function shouldSkipTextFormatting(value) {
    if (value == null) return true;
    const text = String(value).trim();
    if (!text) return true;
    if (OBJECT_ID_RE.test(text)) return true;
    if (UUID_RE.test(text)) return true;
    if (EMAIL_RE.test(text)) return true;
    if (URL_RE.test(text)) return true;
    if (TICKET_ID_RE.test(text)) return true;
    if (/^[A-Z0-9._-]{12,}$/.test(text) && /\d/.test(text)) return true;
    return false;
}

const formatWord = (word, index) => {
    if (!word) return '';
    const lower = word.toLowerCase();
    if (KNOWN_ACRONYMS.has(lower)) return lower.toUpperCase();
    if (index > 0 && LOWERCASE_WORDS.has(lower)) return lower;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
};

/** Normal professional sentence case for UI labels and statuses. */
export function toSentenceCase(value) {
    if (shouldSkipTextFormatting(value)) return value == null ? '' : String(value);
    const normalized = String(value)
        .replace(/_/g, ' ')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    if (!normalized) return '';

    return normalized
        .split(' ')
        .map((word, index) =>
            word
                .split('/')
                .map((part, partIndex) => formatWord(part, index + partIndex))
                .join('/')
        )
        .join(' ');
}

/** Person names — title-case each name part without changing stored values elsewhere. */
export function formatPersonName(value) {
    if (shouldSkipTextFormatting(value)) return value == null ? '' : String(value);
    return String(value)
        .trim()
        .split(/\s+/)
        .filter(Boolean)
        .map((part) =>
            part
                .split('-')
                .map((piece) => {
                    const lower = piece.toLowerCase();
                    return lower.charAt(0).toUpperCase() + lower.slice(1);
                })
                .join('-')
        )
        .join(' ');
}

const ATTENDANCE_STATUS_LABELS = {
    present: 'Present',
    absent: 'Absent',
    late: 'Late arrival',
    wfh: 'Work from home',
    leave: 'On leave',
    'work from home': 'Work from home',
    'on leave': 'On leave',
    'late arrival': 'Late arrival',
};

const GENERIC_STATUS_LABELS = {
    pending: 'Pending',
    approved: 'Approved',
    rejected: 'Rejected',
    cancelled: 'Cancelled',
    canceled: 'Cancelled',
    active: 'Active',
    inactive: 'Inactive',
    open: 'Open',
    closed: 'Closed',
    resolved: 'Resolved',
    assigned: 'Assigned',
    draft: 'Draft',
    published: 'Published',
    archived: 'Archived',
    completed: 'Completed',
    'in progress': 'In progress',
    enrolled: 'Enrolled',
    dropped: 'Dropped',
    failed: 'Failed',
    'not started': 'Not started',
    urgent: 'Urgent',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
    'logged out': 'Logged out',
    'logged in': 'Logged in',
};

/** Display label for attendance-like statuses. */
export function formatAttendanceStatusLabel(status) {
    if (status == null || status === '') return '—';
    const key = String(status).trim().toLowerCase().replace(/_/g, ' ');
    return ATTENDANCE_STATUS_LABELS[key] || formatStatusLabel(status);
}

/** Display label for generic workflow / record statuses. */
export function formatStatusLabel(status, labelMap = {}) {
    if (status == null || status === '') return '—';
    const raw = String(status).trim();
    const key = raw.toLowerCase().replace(/_/g, ' ');
    if (labelMap[key]) return labelMap[key];
    if (labelMap[raw]) return labelMap[raw];
    if (GENERIC_STATUS_LABELS[key]) return GENERIC_STATUS_LABELS[key];
    return toSentenceCase(raw);
}

/** UI labels such as form fields, nav items, and section headings. */
export function formatUiLabel(label) {
    if (label == null || label === '') return '';
    return toSentenceCase(String(label));
}

/** Permission / role display labels — keeps common acronyms uppercase. */
export function formatPermissionDisplayLabel(value) {
    if (shouldSkipTextFormatting(value)) return value == null ? '' : String(value);
    return toSentenceCase(String(value).replace(/_/g, ' '));
}

/** Shared badge class without forced uppercase styling. */
export const UI_BADGE_TEXT_CLASS =
    'text-[11px] font-semibold tracking-wide px-2.5 py-1 rounded-full';

export const UI_TABLE_HEADING_CLASS =
    'text-xs font-semibold tracking-wide text-slate-500';

export const UI_FORM_LABEL_CLASS =
    'text-xs font-semibold tracking-wide text-slate-500';
