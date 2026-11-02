import Calendar from '../models/calendar.model.js';
import WfhRequest from '../models/wfhRequest.model.js';

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
      const parsed = new Date(y, m - 1, d, 0, 0, 0, 0);
      if (parsed.getFullYear() !== y || parsed.getMonth() !== m - 1 || parsed.getDate() !== d) return null;
      return parsed;
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
  if (!from || !to || to < from || from.getFullYear() < 2020 || to.getFullYear() > 2050) return [];
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

/** Calendar coverage is a direct HR assignment, never a prerequisite to apply. */
export function isEmployeeCoveredByWfhEntry(entry, employeeId) {
  if (!entry || !employeeId) return false;
  const selected = (entry.excludedEmployeeIds || []).map((id) => String(id?._id || id));
  const inList = selected.includes(String(employeeId?._id || employeeId));
  return entry.employeeAccess === 'only_these' ? inList : !inList;
}

/** Keep the existing inverse predicate available to callers. */
export function isEmployeeBlockedFromWfhEntry(entry, employeeId) {
  return !isEmployeeCoveredByWfhEntry(entry, employeeId);
}

export async function validateEmployeeWfhEligibility({ organizationId, employeeId, fromDate, toDate }) {
  const days = expandDateRange(fromDate, toDate);
  if (!days.length) return { ok: false, message: 'A valid WFH date range between 2020 and 2050 is required', code: 'INVALID_WFH_DATE_RANGE' };
  const entries = await loadWfhEntriesByDateKey(organizationId, days[0], days.at(-1));
  const dates = days.map(toDateKey).filter((key) => isEmployeeCoveredByWfhEntry(entries.get(key), employeeId));
  if (dates.length) return {
    ok: false,
    message: `HR has already scheduled Work From Home for you on: ${dates.join(', ')}. The entire request was not submitted.`,
    code: 'WFH_HR_SCHEDULE_CONFLICT',
    details: { dates },
  };
  return { ok: true };
}

/** Pending/legacy-submitted and approved requests reserve their complete dates. */
export async function findWfhRequestConflicts({ organizationId, employeeId, fromDate, toDate, excludeRequestId, entries }) {
  const days = expandDateRange(fromDate, toDate);
  if (!days.length) return [];
  const end = new Date(days.at(-1));
  end.setHours(23, 59, 59, 999);
  const filter = {
    organizationId,
    status: { $in: ['pending', 'submitted', 'approved'] },
    wfhDate: { $lte: end },
    $or: [
      { wfhDateTo: { $gte: days[0] } },
      { wfhDateTo: null, wfhDate: { $gte: days[0] } },
    ],
    ...(employeeId ? { employeeId } : {}),
    ...(excludeRequestId ? { _id: { $ne: excludeRequestId } } : {}),
  };
  const requests = await WfhRequest.find(filter).select('employeeId wfhDate wfhDateTo status').lean();
  const conflicts = [];
  for (const request of requests) {
    const from = toDateKey(request.wfhDate);
    const to = toDateKey(request.wfhDateTo || request.wfhDate);
    const dates = days.map(toDateKey).filter((key) => key >= from && key <= to &&
      (!entries || isEmployeeCoveredByWfhEntry(entries.get(key), request.employeeId)));
    if (dates.length) conflicts.push({ requestId: String(request._id), employeeId: String(request.employeeId), status: request.status, dates });
  }
  return conflicts;
}

export async function validateWfhScheduleConflicts({ organizationId, days, entry }) {
  const entries = new Map(days.map((day) => [toDateKey(day), entry]));
  const conflicts = await findWfhRequestConflicts({ organizationId, fromDate: days[0], toDate: days.at(-1), entries });
  return conflicts;
}

/**
 * Find a wfhDates subdocument matching a local date key on a calendar doc.
 */
export function findWfhEntryOnCalendar(calendar, dateValue) {
  const key = toDateKey(dateValue);
  if (!calendar?.wfhDates || !key) return null;
  return calendar.wfhDates.find((entry) => dateKeyMatchesEntry(entry, key)) || null;
}
