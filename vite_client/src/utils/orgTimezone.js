import { format } from 'date-fns';
import { tz } from '@date-fns/tz';
import { DEFAULT_TIMEZONE } from './timezoneOptions';

/**
 * Format a date in the organization's effective IANA timezone.
 */
export function formatInOrgTimezone(date, pattern, timezone = DEFAULT_TIMEZONE) {
  if (!date) return '';
  const tzName = timezone || DEFAULT_TIMEZONE;
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  try {
    return format(value, pattern, { in: tz(tzName) });
  } catch {
    return format(value, pattern, { in: tz(DEFAULT_TIMEZONE) });
  }
}

export function todayDateKeyInTimezone(timezone = DEFAULT_TIMEZONE) {
  return formatInOrgTimezone(new Date(), 'yyyy-MM-dd', timezone);
}

/** Canonical calendar day for an attendance session (prefer server-provided key). */
export function getAttendanceDateKeyFromSession(session, timezone = DEFAULT_TIMEZONE) {
  if (session?.attendanceDateKey) {
    return session.attendanceDateKey;
  }
  if (session?.date) {
    return formatInOrgTimezone(session.date, 'yyyy-MM-dd', timezone);
  }
  return '';
}

export function isSessionForToday(session, timezone = DEFAULT_TIMEZONE) {
  if (!session) return false;
  const today = todayDateKeyInTimezone(timezone);
  return getAttendanceDateKeyFromSession(session, timezone) === today;
}

/** yyyy-MM-dd calendar key from API row (attendanceDateKey preferred). */
export function resolveAttendanceDateKeyFromRow(row, timezone = DEFAULT_TIMEZONE) {
  if (row?.attendanceDateKey) {
    return String(row.attendanceDateKey).slice(0, 10);
  }
  if (row?.dateKey) {
    return String(row.dateKey).slice(0, 10);
  }
  return getAttendanceDateKeyFromSession(row, timezone);
}

/** Format a yyyy-MM-dd attendance day key for display in org timezone. */
export function formatAttendanceDateKey(dateKey, pattern = 'd MMM yyyy', timezone = DEFAULT_TIMEZONE) {
  const key = dateKey ? String(dateKey).slice(0, 10) : '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return '—';
  return formatInOrgTimezone(`${key}T12:00:00`, pattern, timezone);
}
