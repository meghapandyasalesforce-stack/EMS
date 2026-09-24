import { DateTime } from 'luxon';
import { getDateKeyInTimezone, normalizeTimezone } from './timezoneHelper.js';

/**
 * Extract month/day from a stored date using org timezone.
 * Birth/join dates are calendar dates — interpret in org TZ to avoid UTC drift.
 */
export function getMonthDayInTimezone(dateValue, timezone) {
  if (!dateValue) return null;
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(new Date(dateValue), { zone: tz });
  if (!dt.isValid) return null;
  return { month: dt.month, day: dt.day };
}

/**
 * Calendar month/day for date-only fields (DOB, joining date).
 * UTC-midnight values are treated as a calendar date, not a timezone instant.
 */
export function getCalendarMonthDay(dateValue, timezone) {
  if (!dateValue) return null;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return null;

  const isUtcMidnight =
    date.getUTCHours() === 0 &&
    date.getUTCMinutes() === 0 &&
    date.getUTCSeconds() === 0 &&
    date.getUTCMilliseconds() === 0;

  if (isUtcMidnight) {
    return { month: date.getUTCMonth() + 1, day: date.getUTCDate() };
  }

  return getMonthDayInTimezone(dateValue, timezone);
}

/**
 * Whole calendar days until the next month/day occurrence in org timezone.
 * Today returns 0 (not a negative/next-year value after midnight).
 */
export function daysUntilMonthDay(dateValue, timezone, refDate = new Date()) {
  const parts = getCalendarMonthDay(dateValue, timezone);
  if (!parts) return null;

  const tz = normalizeTimezone(timezone);
  const today = DateTime.fromJSDate(refDate, { zone: tz }).startOf('day');

  const occurrenceForYear = (year) => {
    const dt = DateTime.fromObject(
      { year, month: parts.month, day: parts.day },
      { zone: tz }
    );
    if (dt.isValid) return dt.startOf('day');
    return DateTime.fromObject({ year, month: parts.month, day: 28 }, { zone: tz })
      .endOf('month')
      .startOf('day');
  };

  let occurrence = occurrenceForYear(today.year);
  if (occurrence < today) {
    occurrence = occurrenceForYear(today.year + 1);
  }

  return Math.round(occurrence.diff(today, 'days').days);
}

/**
 * Format a month/day as "25 August" in org timezone context.
 */
export function formatCelebrationDateLabel(month, day) {
  const dt = DateTime.fromObject({ month, day });
  return dt.toFormat('d MMMM');
}

/**
 * Check if a stored date's month/day matches target month/day.
 */
export function matchesMonthDay(dateValue, targetMonth, targetDay, timezone) {
  const parts = getMonthDayInTimezone(dateValue, timezone);
  if (!parts) return false;
  return parts.month === targetMonth && parts.day === targetDay;
}

/**
 * Get today's month/day and date key in org timezone.
 */
export function getTodayPartsInTimezone(timezone, refDate = new Date()) {
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(refDate, { zone: tz });
  return {
    dateKey: dt.toFormat('yyyy-MM-dd'),
    month: dt.month,
    day: dt.day,
    year: dt.year,
  };
}

/**
 * Get month/day exactly 7 calendar days from today in org timezone.
 */
export function getDatePartsDaysFromToday(timezone, daysAhead, refDate = new Date()) {
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(refDate, { zone: tz }).plus({ days: daysAhead });
  return {
    dateKey: dt.toFormat('yyyy-MM-dd'),
    month: dt.month,
    day: dt.day,
    year: dt.year,
  };
}

/**
 * Calculate completed work anniversary years (join year excluded from partial year).
 */
export function calculateCompletedYears(joiningDate, currentYear, timezone) {
  const parts = getMonthDayInTimezone(joiningDate, timezone);
  if (!parts) return 0;
  const joinYear = DateTime.fromJSDate(new Date(joiningDate), { zone: normalizeTimezone(timezone) }).year;
  if (joinYear >= currentYear) return 0;
  return currentYear - joinYear;
}

/**
 * Calculate completed marriage anniversary years (marriage year excluded from partial year).
 * Returns 0 if missing, invalid, in future, or completed years < 1.
 */
export function calculateMarriageCompletedYears(marriageDate, currentYear, timezone) {
  if (!marriageDate) return 0;
  const date = new Date(marriageDate);
  if (Number.isNaN(date.getTime())) return 0;

  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(date, { zone: tz });
  if (!dt.isValid) return 0;

  const today = DateTime.now().setZone(tz);
  if (dt > today) return 0;

  const marriageYear = dt.year;
  if (marriageYear >= currentYear) return 0;

  const completedYears = currentYear - marriageYear;
  return completedYears >= 1 ? completedYears : 0;
}

/**
 * Build deterministic idempotency keys for celebration notifications.
 */
export function buildCelebrationEventKey(kind, employeeId, year) {
  return `${kind}:${employeeId}:${year}`;
}

/**
 * True when org local time is exactly 9:00 AM (minute precision).
 */
export function isOrgNineAmWindow(timezone, refDate = new Date()) {
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(refDate, { zone: tz });
  return dt.hour === 9 && dt.minute === 0;
}

/**
 * True once org local time has reached 9:00 AM today.
 * Used so a late-starting server still sends the once-daily celebration notifications.
 */
export function hasReachedOrgNineAm(timezone, refDate = new Date()) {
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(refDate, { zone: tz });
  return dt.hour > 9 || (dt.hour === 9 && dt.minute >= 0);
}

/**
 * True during the morning delivery window: 9:00–9:59 AM in org local time.
 * Holiday / birthday / anniversary / event pushes should only fire in this window
 * (not later in the afternoon if the server restarts after 9 AM).
 */
export function isOrgMorningNotifyWindow(timezone, refDate = new Date()) {
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(refDate, { zone: tz });
  return dt.hour === 9;
}

/**
 * Timezone used for morning lifestyle notifications (holiday/birthday/anniversary).
 * Orgs that still have the UTC default would otherwise fire at 9 AM UTC (~2:30–3:30 PM IST).
 * Override with MORNING_NOTIFY_TIMEZONE if needed; non-UTC org timezones are respected as-is.
 */
export function resolveMorningNotifyTimezone(effectiveTimezone) {
  const tz = normalizeTimezone(effectiveTimezone);
  if (tz === 'UTC') {
    return normalizeTimezone(process.env.MORNING_NOTIFY_TIMEZONE || 'Asia/Kolkata');
  }
  return tz;
}

export { getDateKeyInTimezone };
