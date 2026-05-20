import { DateTime } from 'luxon';
import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';

export function normalizeTimezone(timezone) {
  if (!timezone || typeof timezone !== 'string') return DEFAULT_TIMEZONE;
  return timezone.trim() || DEFAULT_TIMEZONE;
}

/**
 * Start of calendar day in the given IANA timezone, as a JS Date (UTC instant).
 */
export function getStartOfDayInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  return DateTime.fromJSDate(date, { zone: tz }).startOf('day').toJSDate();
}

/**
 * End of calendar day in the given IANA timezone (inclusive), as a JS Date.
 */
export function getEndOfDayInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  return DateTime.fromJSDate(date, { zone: tz }).endOf('day').toJSDate();
}

/** yyyy-MM-dd in the given timezone */
export function getDateKeyInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  return DateTime.fromJSDate(date, { zone: tz }).toFormat('yyyy-MM-dd');
}

/**
 * Build a Date from calendar day + HH:mm in the given timezone.
 */
export function combineDateAndTimeInTimezone(date, timeStr, timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  const base = DateTime.fromJSDate(date, { zone: tz }).startOf('day');
  const parts = String(timeStr || '00:00').split(':');
  const hour = parseInt(parts[0], 10) || 0;
  const minute = parseInt(parts[1], 10) || 0;
  return base.set({ hour, minute, second: 0, millisecond: 0 }).toJSDate();
}

export function nowInTimezone(timezone = DEFAULT_TIMEZONE) {
  return DateTime.now().setZone(normalizeTimezone(timezone));
}
