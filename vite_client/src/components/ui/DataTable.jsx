import React from 'react';

/**
 * Presentational table shell.
 * - columns: [{ key, header, render?, className? }]
 * - rows: data objects
 * - selectable + onToggleRow / onToggleAll / selectedKeys for checkbox column slot (caller owns state)
 * - pagination: React node rendered in the pagination slot
 */
export function DataTable({
  columns = [],
  rows = [],
  rowKey = 'id',
  selectable = false,
  selectedKeys,
  onToggleRow,
  onToggleAll,
  pagination = null,
  empty = null,
  className = '',
  ...props
}) {
  const selected = selectedKeys instanceof Set ? selectedKeys : new Set(selectedKeys || []);
  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r[rowKey]));

  return (
    <div className={`ui-data-table-wrap ${className}`.trim()} {...props}>
      <table className="ui-data-table">
        <thead>
          <tr>
            {selectable ? (
              <th className="ui-data-table__check" scope="col">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={(e) => onToggleAll?.(e.target.checked)}
                  aria-label="Select all rows"
                />
              </th>
            ) : null}
            {columns.map((col) => (
              <th key={col.key} scope="col" className={col.className || ''}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length + (selectable ? 1 : 0)}>
                {empty || <span className="text-[var(--ui-muted)] text-sm">No data</span>}
              </td>
            </tr>
          ) : (
            rows.map((row) => {
              const key = row[rowKey];
              return (
                <tr key={key}>
                  {selectable ? (
                    <td className="ui-data-table__check">
                      <input
                        type="checkbox"
                        checked={selected.has(key)}
                        onChange={() => onToggleRow?.(key)}
                        aria-label={`Select row ${key}`}
                      />
                    </td>
                  ) : null}
                  {columns.map((col) => (
                    <td key={col.key} className={col.className || ''}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
      {pagination ? <div className="ui-data-table__pagination">{pagination}</div> : null}
    </div>
  );
}

export default DataTable;
