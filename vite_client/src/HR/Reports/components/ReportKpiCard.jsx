import React from 'react';

const ReportKpiCard = ({ title, value, subtitle, trend, trendUp, icon: Icon, iconBg = 'bg-[#20C997]/10', iconColor = 'text-[#20C997]', highlight }) => (
    <div
        className={`rounded-xl border bg-white p-5 shadow-sm ${
            highlight ? 'border-[#20C997] ring-1 ring-[#20C997]/20' : 'border-slate-100'
        }`}
    >
        <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</p>
                <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
                {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
                {trend && (
                    <p className={`mt-1 text-xs font-medium ${trendUp === false ? 'text-red-500' : 'text-[#20C997]'}`}>
                        {trend}
                    </p>
                )}
            </div>
            {Icon && (
                <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
                    <Icon className={`h-5 w-5 ${iconColor}`} />
                </div>
            )}
        </div>
    </div>
);

export default ReportKpiCard;
