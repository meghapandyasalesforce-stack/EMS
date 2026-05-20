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
