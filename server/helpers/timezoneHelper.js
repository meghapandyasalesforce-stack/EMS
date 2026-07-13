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

/**
 * Format a time for notifications in the given IANA timezone (e.g. "07:26 AM").
 */
export function formatTimeInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return DateTime.fromJSDate(value, { zone: tz }).toFormat('hh:mm a');
}

/**
 * Format a date for notifications in the given IANA timezone (e.g. "13/07/2026").
 */
export function formatDateInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  const value = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(value.getTime())) return '';
  return DateTime.fromJSDate(value, { zone: tz }).toFormat('dd/MM/yyyy');
}

/** Start of calendar month and start of next month in the given timezone (UTC instants). */
export function getMonthBoundsInTimezone(date = new Date(), timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  const dt = DateTime.fromJSDate(date, { zone: tz });
  return {
    monthStart: dt.startOf('month').toJSDate(),
    nextMonthStart: dt.plus({ months: 1 }).startOf('month').toJSDate(),
  };
}

/** Whether two dates fall in the same calendar month in the given timezone. */
export function isSameCalendarMonthInTimezone(dateA, dateB, timezone = DEFAULT_TIMEZONE) {
  const tz = normalizeTimezone(timezone);
  const a = DateTime.fromJSDate(dateA, { zone: tz });
  const b = DateTime.fromJSDate(dateB, { zone: tz });
  return a.year === b.year && a.month === b.month;
}
