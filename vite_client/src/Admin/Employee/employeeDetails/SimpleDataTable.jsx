import React from 'react';

const SimpleDataTable = ({ columns, rows, emptyMessage = 'No records found.' }) => {
  if (!rows?.length) {
    return <p className="text-sm text-slate-500">{emptyMessage}</p>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-100">
      <table className="min-w-full divide-y divide-slate-100 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50 bg-white">
          {rows.map((row, idx) => (
            <tr key={row._id || row.id || idx} className="hover:bg-slate-50/80">
              {columns.map((col) => (
                <td key={col.key} className="px-3 py-3 text-slate-700 sm:whitespace-nowrap sm:px-4">
                  {col.render ? col.render(row) : row[col.key] ?? '—'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default SimpleDataTable;
