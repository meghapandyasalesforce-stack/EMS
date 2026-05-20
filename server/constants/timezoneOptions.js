/** IANA timezone identifiers supported in admin settings */
export const TIMEZONE_OPTIONS = [
  { value: 'UTC', label: 'UTC' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
];

export const DEFAULT_TIMEZONE = 'UTC';

export const VALID_TIMEZONE_VALUES = new Set(TIMEZONE_OPTIONS.map((o) => o.value));

export function isValidTimezone(tz) {
  return typeof tz === 'string' && VALID_TIMEZONE_VALUES.has(tz.trim());
}
