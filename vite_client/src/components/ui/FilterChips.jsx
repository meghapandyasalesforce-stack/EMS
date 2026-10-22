import React from 'react';

/**
 * Presentational filter chips. Caller owns selectedId/selectedIds and onChange.
 * items: [{ id, label }]
 */
export function FilterChips({
  items = [],
  selectedId,
  selectedIds,
  onChange,
  className = '',
  ...props
}) {
  const multi = Array.isArray(selectedIds);
  const isSelected = (id) => (multi ? selectedIds.includes(id) : id === selectedId);

  return (
    <div className={`ui-filter-chips ${className}`.trim()} role="group" {...props}>
      {items.map((item) => {
        const active = isSelected(item.id);
        return (
          <button
            key={item.id}
            type="button"
            className={`ui-filter-chip ${active ? 'is-active' : ''}`}
            aria-pressed={active}
            onClick={() => onChange?.(item.id)}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export default FilterChips;
