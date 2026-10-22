import React from 'react';

const TONE_CLASS = {
  success: 'ui-status-pill--success',
  warning: 'ui-status-pill--warning',
  danger: 'ui-status-pill--danger',
  info: 'ui-status-pill--info',
  neutral: 'ui-status-pill--neutral',
  urgent: 'ui-status-pill--urgent',
};

export function StatusPill({ tone = 'neutral', children, className = '', ...props }) {
  const toneClass = TONE_CLASS[tone] || TONE_CLASS.neutral;
  return (
    <span className={`ui-status-pill ${toneClass} ${className}`.trim()} {...props}>
      {children}
    </span>
  );
}

export default StatusPill;
