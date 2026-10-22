import React from 'react';

export function StatCard({ label, value, meta, metaUrgent = false, icon, className = '', ...props }) {
  return (
    <div className={`ui-stat-card ${className}`.trim()} {...props}>
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0">
          {label != null ? <p className="ui-stat-card__label">{label}</p> : null}
          {value != null ? <p className="ui-stat-card__value">{value}</p> : null}
          {meta != null ? (
            <p className={`ui-stat-card__meta ${metaUrgent ? 'ui-stat-card__meta--urgent' : ''}`}>{meta}</p>
          ) : null}
        </div>
        {icon ? <div className="shrink-0 text-[var(--color-primary)]">{icon}</div> : null}
      </div>
    </div>
  );
}

export default StatCard;
