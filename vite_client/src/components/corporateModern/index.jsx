import React from 'react';

/** Corporate-Modern shared primitives — Admin/HR onboarding only. */

export function cmInitials(name = '', lastName = '') {
  const a = String(name || '').trim();
  const b = String(lastName || '').trim();
  if (a && b) return `${a[0]}${b[0]}`.toUpperCase();
  const parts = a.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return (a.slice(0, 2) || '?').toUpperCase();
}

export function CmBadge({ tone = 'neutral', children, dot = true, className = '' }) {
  const map = {
    done: 'cm-badge--done',
    progress: 'cm-badge--progress',
    attention: 'cm-badge--attention',
    neutral: 'cm-badge--neutral',
  };
  return (
    <span className={`cm-badge ${map[tone] || map.neutral} ${className}`}>
      {dot && <span className="cm-badge__dot" aria-hidden />}
      {children}
    </span>
  );
}

export function CmButton({ variant = 'primary', size, className = '', children, ...props }) {
  const v = {
    primary: 'cm-btn--primary',
    inverted: 'cm-btn--inverted',
    secondary: 'cm-btn--secondary',
    outline: 'cm-btn--outline',
    tertiary: 'cm-btn--tertiary',
    ghost: 'cm-btn--ghost',
  }[variant] || 'cm-btn--primary';
  const s = size === 'sm' ? 'cm-btn--sm' : size === 'icon' ? 'cm-btn--icon' : '';
  return (
    <button type="button" className={`cm-btn ${v} ${s} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function CmSearch({ value, onChange, placeholder = 'Search...', onKeyDown, className = '' }) {
  return (
    <div className={`cm-search ${className}`}>
      <svg className="cm-search__icon" width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
        <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        className="cm-input"
        value={value}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
      />
    </div>
  );
}

export function CmStat({ label, value, meta, metaTone, attention, icon, iconAttention, className = '' }) {
  return (
    <div className={`cm-stat ${icon ? 'cm-stat--row' : ''} ${className}`}>
      <div className="min-w-0">
        <p className="cm-stat__label">{label}</p>
        <p className={`cm-stat__value ${attention ? 'cm-stat__value--attention' : ''}`}>{value}</p>
        {meta ? <p className={`cm-stat__meta ${metaTone ? `cm-stat__meta--${metaTone}` : ''}`}>{meta}</p> : null}
      </div>
      {icon ? (
        <div className={`cm-stat__icon ${iconAttention ? 'cm-stat__icon--attention' : ''}`}>{icon}</div>
      ) : null}
    </div>
  );
}

export function CmPerson({ name, meta, photo, initials }) {
  return (
    <div className="cm-person">
      <div className="cm-avatar">
        {photo ? <img src={photo} alt="" /> : (initials || cmInitials(name))}
      </div>
      <div className="min-w-0">
        <p className="cm-person__name truncate">{name}</p>
        {meta ? <p className="cm-person__meta truncate">{meta}</p> : null}
      </div>
    </div>
  );
}

export function CmProgress({ value = 0, attention = false }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className="cm-progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
      <div
        className={`cm-progress__bar ${attention ? 'cm-progress__bar--attention' : ''}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export function CmRing({
  value = 0,
  size = 40,
  attention = false,
  strokeColor,
  label,
  labelBelow = false,
  className = '',
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = 15.9;
  const c = 2 * Math.PI * r;
  const color = strokeColor || (attention ? 'var(--cm-tertiary)' : 'var(--cm-primary)');
  const ring = (
    <div className="cm-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 36 36" aria-hidden>
        <circle cx="18" cy="18" r={r} fill="none" stroke="rgba(113,121,116,0.15)" strokeWidth="3.5" />
        <circle
          cx="18"
          cy="18"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3.5"
          strokeDasharray={`${(pct / 100) * c} ${c}`}
          strokeLinecap="round"
        />
      </svg>
      <span className="cm-ring__label">{Math.round(pct)}%</span>
    </div>
  );

  if (labelBelow && label) {
    return (
      <div className={`cm-ring-block ${className}`}>
        {ring}
        <p className="cm-ring-block__caption">{label}</p>
      </div>
    );
  }

  return ring;
}

export function CmEmpty({ icon, title, children }) {
  return (
    <div className="cm-empty">
      {icon ? <div className="cm-empty__icon">{icon}</div> : null}
      {title ? <p className="font-semibold text-[var(--cm-on-surface)] mb-1">{title}</p> : null}
      <div className="text-sm">{children}</div>
    </div>
  );
}

/** Map common status strings to Corporate-Modern badge tones */
export function statusTone(status = '') {
  const s = String(status).toLowerCase();
  if (/complet|clear|accept|approv|done|confirm|active|verified|certif|provision/.test(s)) return 'done';
  if (/progress|sent|schedul|initiated|connected|viewed|pending approval/.test(s)) return 'progress';
  if (/overdue|flag|fail|reject|delay|alert|critical|expir|discrepan/.test(s)) return 'attention';
  if (/pending|not started|draft|manual|stub|offer sent|waiting/.test(s)) return 'attention';
  return 'neutral';
}

export default {
  CmBadge,
  CmButton,
  CmSearch,
  CmStat,
  CmPerson,
  CmProgress,
  CmRing,
  CmEmpty,
  statusTone,
  cmInitials,
};
