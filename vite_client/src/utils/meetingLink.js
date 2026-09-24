/**
 * Reject auto-generated Jitsi placeholders (legacy). Only real user-provided links are kept.
 */
export function isLegacyAutoMeetingLink(link) {
  const value = String(link || '').trim().toLowerCase();
  if (!value) return false;
  return (
    value.includes('meet.jit.si/ems-1on1-') ||
    value.includes('jit.si/ems-1on1-')
  );
}

/** Returns a usable meeting URL, or empty string if missing/legacy placeholder. */
export function sanitizeMeetingLink(link) {
  const value = String(link || '').trim();
  if (!value) return '';
  if (isLegacyAutoMeetingLink(value)) return '';
  return value;
}
