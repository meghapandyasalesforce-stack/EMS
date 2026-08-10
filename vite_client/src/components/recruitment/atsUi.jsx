import React from 'react';
import { CmBadge, CmButton, cmInitials } from '../corporateModern';

/** Map recruitment status strings to ATS badge tones (design system). */
export function atsStatusTone(status = '') {
  const s = String(status || '').toLowerCase().replace(/\s+/g, '');
  if (!s || s === 'n/a' || s === 'na' || s === 'none' || s === 'noteligible' || s === 'paid') {
    return 'neutral';
  }
  if (
    /hired|accepted|approved|payable|completed|done|clear|active|offered|offeraccepted/.test(s)
  ) {
    return 'success';
  }
  if (/rejected|withdrawn|declined|cancelled|failed|expired/.test(s)) {
    return 'error';
  }
  if (
    /pending|pendingapproval|screening|interview|scheduled|shortlisted|applied|draft|offerextended/.test(s)
    || s.includes('pending')
  ) {
    return 'pending';
  }
  return 'neutral';
}

const toneClass = {
  success: 'cm-badge--success',
  pending: 'cm-badge--pending',
  error: 'cm-badge--error',
  neutral: 'cm-badge--neutral',
  done: 'cm-badge--done',
  progress: 'cm-badge--progress',
  attention: 'cm-badge--attention',
};

export function AtsBadge({ children, tone, status, className = '' }) {
  const resolved = tone || atsStatusTone(status ?? children);
  return (
    <span className={`cm-badge ${toneClass[resolved] || toneClass.neutral} ${className}`}>
      {children || '—'}
    </span>
  );
}

export function AtsPage({ children, narrow = false, className = '' }) {
  return (
    <div className={`cm-hrms ats-ui ${className}`}>
      <div className="ats-page">
        <div className={`ats-page-inner ${narrow ? 'ats-page-inner--narrow' : ''}`}>
          {children}
        </div>
      </div>
    </div>
  );
}

export function AtsPageHeader({ eyebrow, title, subtitle, actions }) {
  return (
    <div className="ats-page-header">
      <div className="min-w-0">
        {eyebrow ? <p className="ats-eyebrow">{eyebrow}</p> : null}
        <h1 className="ats-page-title">{title}</h1>
        {subtitle ? <p className="ats-page-subtitle">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ats-toolbar shrink-0">{actions}</div> : null}
    </div>
  );
}

export function AtsEmpty({ icon: Icon, title, hint }) {
  return (
    <div className="ats-empty">
      {Icon ? (
        <div className="ats-empty__icon">
          <Icon className="h-5 w-5" />
        </div>
      ) : null}
      <p className="mt-4 text-base font-semibold" style={{ color: 'var(--ats-secondary)' }}>{title}</p>
      {hint ? <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: 'rgba(15,45,38,0.55)' }}>{hint}</p> : null}
    </div>
  );
}

export function AtsAvatar({ name = '' }) {
  return <div className="ats-avatar">{cmInitials(name)}</div>;
}

export { CmBadge, CmButton, cmInitials };
