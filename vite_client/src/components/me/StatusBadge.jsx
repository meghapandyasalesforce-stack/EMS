import React from 'react';

const TONE_CLASS = {
  success: 'me-status-badge--success',
  pending: 'me-status-badge--pending',
  rejected: 'me-status-badge--rejected',
  destructive: 'me-status-badge--destructive',
  info: 'me-status-badge--info',
  neutral: 'me-status-badge--neutral',
};

/** Map common status strings → Me badge tone (presentational only). */
export function meStatusTone(status = '') {
  const s = String(status).toLowerCase();
  if (/complet|approv|paid|active|success|present|done|confirm|verified/.test(s)) return 'success';
  if (/pending|await|process|submitted|review|draft|scheduled/.test(s)) return 'pending';
  if (/reject|cancel|fail|deny|absent|error|destruct/.test(s)) return 'rejected';
  if (/info|open|new|info/.test(s)) return 'info';
  return 'neutral';
}

/**
 * Pill status badge — presentational only.
 */
const StatusBadge = ({ tone, status, children, dot = true, className = '' }) => {
  const resolved = tone || meStatusTone(status || children);
  return (
    <span className={`me-status-badge ${TONE_CLASS[resolved] || TONE_CLASS.neutral} ${className}`.trim()}>
      {dot ? <span className="me-status-badge__dot" aria-hidden /> : null}
      {children ?? status}
    </span>
  );
};

export default StatusBadge;
