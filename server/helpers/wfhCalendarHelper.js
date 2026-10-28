import Calendar from '../models/calendar.model.js';

/**
 * Parse a calendar date as local midnight (avoids UTC date-string drift).
 * - "YYYY-MM-DD" (date-only) → that local calendar day
 * - ISO datetimes / Date → the viewer's local calendar day
 */
export function parseLocalDate(value) {
  if (value == null || value === '') return null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    // Date-only (no time) — treat as local civil date, never UTC midnight
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      const [y, m, d] = trimmed.split('-').map(Number);
      if (!y || !m || !d) return null;
      return new Date(y, m - 1, d, 0, 0, 0, 0);
    }
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

export function toDateKey(value) {
  const d = parseLocalDate(value);
  if (!d) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Inclusive list of local midnights from start through end.
 */
export function expandDateRange(fromValue, toValue) {
  const from = parseLocalDate(fromValue);
  const to = parseLocalDate(toValue || fromValue);
  if (!from || !to || to < from) return [];
  const days = [];
  const cursor = new Date(from);
  while (cursor <= to) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function dateKeyMatchesEntry(entry, dateKey) {
  return toDateKey(entry?.date) === dateKey;
}

/**
 * Load WFH entries covering [fromDate, toDate] across calendar years for an org.
 * @returns {Map<string, { date: Date, excludedEmployeeIds: any[] }>}
 */
export async function loadWfhEntriesByDateKey(organizationId, fromDate, toDate) {
  const days = expandDateRange(fromDate, toDate);
  const map = new Map();
  if (!organizationId || !days.length) return map;

  const years = [...new Set(days.map((d) => d.getFullYear()))];
  const calendars = await Calendar.find({
    organizationId,
    year: { $in: years },
  })
    .select('year wfhDates')
    .lean();

  for (const cal of calendars || []) {
    for (const entry of cal.wfhDates || []) {
      const key = toDateKey(entry.date);
      if (!key) continue;
      map.set(key, {
        date: entry.date,
        employeeAccess: entry.employeeAccess === 'only_these' ? 'only_these' : 'all_except',
        excludedEmployeeIds: (entry.excludedEmployeeIds || []).map((id) => String(id)),
        note: entry.note || '',
        _id: entry._id,
      });
    }
  }
  return map;
}

/** True when this employee cannot apply for WFH on the given calendar entry. */
export function isEmployeeBlockedFromWfhEntry(entry, employeeId) {
  if (!entry) return true;
  const employeeKey = String(employeeId);
  const selected = (entry.excludedEmployeeIds || []).map(String);
  const inList = selected.includes(employeeKey);
  if (entry.employeeAccess === 'only_these') {
    // Allowlist: blocked when not on the list (empty list → nobody can apply)
    return !inList;
  }
  // Default blacklist
  return inList;
}

/**
 * Validate that every day in [fromDate, toDate] is HR-enabled for WFH and
 * the employee is allowed by employeeAccess / selected list.
 * Does not change attendance/punch behavior (punch uses approved WFH requests).
 *
 * @returns {{ ok: true } | { ok: false, message: string, code: string, details?: object }}
 */
export async function validateEmployeeWfhEligibility({
  organizationId,
  employeeId,
  fromDate,
  toDate,
}) {
  const days = expandDateRange(fromDate, toDate);
  if (!days.length) {
    return {
      ok: false,
      message: 'A valid WFH date range is required',
      code: 'INVALID_WFH_DATE_RANGE',
    };
  }

  const entries = await loadWfhEntriesByDateKey(organizationId, days[0], days[days.length - 1]);
  const notEnabled = [];
  const excluded = [];

  for (const day of days) {
    const key = toDateKey(day);
    const entry = entries.get(key);
    if (!entry) {
      notEnabled.push(key);
      continue;
    }
    if (isEmployeeBlockedFromWfhEntry(entry, employeeId)) {
      excluded.push(key);
    }
  }

  if (notEnabled.length) {
    return {
      ok: false,
      message:
        notEnabled.length === 1
          ? `Work From Home is not enabled by HR for ${notEnabled[0]}. Please choose an HR-enabled WFH date.`
          : `Work From Home is not enabled by HR for these dates: ${notEnabled.join(', ')}.`,
      code: 'WFH_DATE_NOT_ENABLED',
      details: { dates: notEnabled },
    };
  }

  if (excluded.length) {
    return {
      ok: false,
      message:
        excluded.length === 1
          ? `You are not eligible for Work From Home on ${excluded[0]}. Please contact HR.`
          : `You are not eligible for Work From Home on these dates: ${excluded.join(', ')}.`,
      code: 'WFH_EMPLOYEE_EXCLUDED',
      details: { dates: excluded },
    };
  }

  return { ok: true };
}

/**
 * Find a wfhDates subdocument matching a local date key on a calendar doc.
 */
export function findWfhEntryOnCalendar(calendar, dateValue) {
  const key = toDateKey(dateValue);
  if (!calendar?.wfhDates || !key) return null;
  return calendar.wfhDates.find((entry) => dateKeyMatchesEntry(entry, key)) || null;
}
