import React from 'react';

export function ProgressBar({ value = 0, urgent = false, danger = false, className = '', ...props }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const barMod = danger ? 'ui-progress__bar--danger' : urgent ? 'ui-progress__bar--urgent' : '';
  return (
    <div
      className={`ui-progress ${className}`.trim()}
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      {...props}
    >
      <div className={`ui-progress__bar ${barMod}`.trim()} style={{ width: `${pct}%` }} />
    </div>
  );
}

export default ProgressBar;
