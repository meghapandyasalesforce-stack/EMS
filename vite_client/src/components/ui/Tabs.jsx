import React from 'react';

/**
 * Presentational tabs. Caller owns activeId and onChange.
 * items: [{ id, label, disabled? }]
 */
export function Tabs({ items = [], activeId, onChange, className = '', ...props }) {
  return (
    <div className={`ui-tabs ${className}`.trim()} role="tablist" {...props}>
      {items.map((item) => {
        const active = item.id === activeId;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={item.disabled}
            className={`ui-tabs__tab ${active ? 'is-active' : ''}`}
            onClick={() => onChange?.(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default Tabs;
