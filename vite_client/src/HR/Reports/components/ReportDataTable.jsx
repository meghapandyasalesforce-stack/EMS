import React from 'react';

const ReportDataTable = ({ title, subtitle, columns, rows, footer, actions }) => (
    <div className="rounded-xl border border-slate-100 bg-white shadow-sm overflow-hidden">
        {(title || actions) && (
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
                <div>
                    {title && <h3 className="text-base font-semibold text-slate-900">{title}</h3>}
                    {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
                </div>
                {actions}
            </div>
        )}
        <div className="overflow-x-auto -mx-1 px-1 sm:mx-0 sm:px-0">
            <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                    <tr className="border-b border-slate-100 bg-slate-50/80">
                        {columns.map((col) => (
                            <th
                                key={col.key}
                                className="px-5 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500"
                            >
                                {col.label}
                            </th>
                        ))}
                    </tr>
                </thead>
                <tbody>
                    {rows.length === 0 ? (
                        <tr>
                            <td colSpan={columns.length} className="px-5 py-10 text-center text-slate-500">
                                No data available
                            </td>
                        </tr>
                    ) : (
                        rows.map((row, idx) => (
                            <tr key={row.id || idx} className="border-b border-slate-50 hover:bg-slate-50/50">
                                {columns.map((col) => (
                                    <td key={col.key} className="px-5 py-3.5 text-slate-700">
                                        {col.render ? col.render(row) : row[col.key]}
                                    </td>
                                ))}
                            </tr>
                        ))
                    )}
                </tbody>
            </table>
        </div>
        {footer && (
            <div className="border-t border-slate-100 px-5 py-3 text-xs text-slate-500">{footer}</div>
        )}
    </div>
);

export default ReportDataTable;
