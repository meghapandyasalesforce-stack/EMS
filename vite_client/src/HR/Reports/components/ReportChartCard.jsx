import React from 'react';

const ReportChartCard = ({ title, subtitle, children, action }) => (
    <div className="rounded-xl border border-slate-100 bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-start justify-between gap-3">
            <div>
                <h3 className="text-base font-semibold text-slate-900">{title}</h3>
                {subtitle && <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>}
            </div>
            {action}
        </div>
        <div className="h-64">{children}</div>
    </div>
);

export default ReportChartCard;
