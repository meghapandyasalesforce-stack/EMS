import React from 'react';
import { FaSpinner, FaTimes } from 'react-icons/fa';

export const wfStatusClass = (status) => {
    switch (status) {
        case 'Approved':
        case 'Filled':
        case 'Balanced':
        case 'High':
            return 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100';
        case 'In Progress':
        case 'Planned':
            return 'bg-teal-50 text-teal-700 ring-1 ring-teal-100';
        case 'Completed':
            return 'bg-violet-50 text-violet-700 ring-1 ring-violet-100';
        case 'Draft':
            return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
        case 'Shortage':
        case 'Critical':
        case 'Cancelled':
            return 'bg-rose-50 text-rose-700 ring-1 ring-rose-100';
        case 'Surplus':
        case 'Medium':
            return 'bg-amber-50 text-amber-700 ring-1 ring-amber-100';
        case 'Low':
            return 'bg-sky-50 text-sky-700 ring-1 ring-sky-100';
        default:
            return 'bg-slate-100 text-slate-600 ring-1 ring-slate-200';
    }
};

export const WfBadge = ({ children, status, className = '' }) => (
    <span
        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
            status ? wfStatusClass(status) : 'bg-slate-100 text-slate-600'
        } ${className}`}
    >
        {children}
    </span>
);

export const WfKpiCard = ({
    title,
    value,
    subtitle,
    icon: Icon,
    tone = 'teal',
    valueClass = '',
}) => {
    const tones = {
        teal: { bg: 'bg-teal-50', icon: 'text-teal-600', ring: 'ring-teal-100' },
        emerald: { bg: 'bg-emerald-50', icon: 'text-emerald-600', ring: 'ring-emerald-100' },
        amber: { bg: 'bg-amber-50', icon: 'text-amber-600', ring: 'ring-amber-100' },
        rose: { bg: 'bg-rose-50', icon: 'text-rose-600', ring: 'ring-rose-100' },
        violet: { bg: 'bg-violet-50', icon: 'text-violet-600', ring: 'ring-violet-100' },
        sky: { bg: 'bg-sky-50', icon: 'text-sky-600', ring: 'ring-sky-100' },
        slate: { bg: 'bg-slate-100', icon: 'text-slate-600', ring: 'ring-slate-200' },
    };
    const t = tones[tone] || tones.teal;

    return (
        <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:shadow-md">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{title}</p>
                    <p className={`mt-2 text-3xl font-bold tracking-tight text-slate-900 ${valueClass}`}>{value}</p>
                    {subtitle != null && subtitle !== '' && (
                        <p className="mt-1.5 text-xs text-slate-500">{subtitle}</p>
                    )}
                </div>
                {Icon && (
                    <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${t.bg} ring-1 ${t.ring}`}>
                        <Icon className={`h-5 w-5 ${t.icon}`} />
                    </div>
                )}
            </div>
        </div>
    );
};

export const WfPanel = ({ title, subtitle, action, children, className = '', bodyClassName = 'p-5 sm:p-6' }) => (
    <section className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`}>
        {(title || action) && (
            <div className="flex flex-col gap-3 border-b border-slate-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 md:px-7">
                <div className="min-w-0">
                    {title && <h2 className="text-base font-semibold text-slate-900 sm:text-lg">{title}</h2>}
                    {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
                </div>
                {action && <div className="shrink-0">{action}</div>}
            </div>
        )}
        <div className={bodyClassName}>{children}</div>
    </section>
);

export const WfPageHeader = ({ title, subtitle, actions, eyebrow }) => (
    <div className="relative overflow-hidden rounded-2xl border border-teal-100/80 bg-gradient-to-br from-teal-50 via-white to-slate-50 p-5 sm:p-6 shadow-sm">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-teal-200/30 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-emerald-200/20 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
                {eyebrow && (
                    <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-teal-700">
                        {eyebrow}
                    </p>
                )}
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
                {subtitle && <p className="mt-1 max-w-2xl text-sm text-slate-600 sm:text-base">{subtitle}</p>}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
    </div>
);

export const WfButton = ({
    children,
    variant = 'primary',
    size = 'md',
    className = '',
    loading = false,
    disabled,
    type = 'button',
    ...props
}) => {
    const sizes = {
        sm: 'px-3 py-1.5 text-xs',
        md: 'px-4 py-2.5 text-sm',
        lg: 'px-5 py-3 text-sm',
    };
    const variants = {
        primary:
            'bg-gradient-to-r from-teal-600 to-teal-500 text-white shadow-sm shadow-teal-600/20 hover:from-teal-700 hover:to-teal-600',
        secondary:
            'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 hover:border-slate-300',
        soft: 'bg-teal-50 text-teal-700 ring-1 ring-teal-100 hover:bg-teal-100',
        danger: 'bg-rose-500 text-white hover:bg-rose-600',
        ghost: 'text-slate-600 hover:bg-slate-100',
        amber: 'bg-amber-500 text-white hover:bg-amber-600',
    };

    return (
        <button
            type={type}
            disabled={disabled || loading}
            className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition disabled:cursor-not-allowed disabled:opacity-50 ${sizes[size]} ${variants[variant]} ${className}`}
            {...props}
        >
            {loading && <FaSpinner className="animate-spin" />}
            {children}
        </button>
    );
};

export const WfTabs = ({ tabs, activeId, onChange }) => (
    <div className="rounded-2xl border border-slate-100 bg-white p-1.5 shadow-sm">
        <div className="hrms-tabs-scroll flex gap-1">
            {tabs.map((tab) => {
                const active = activeId === tab.id;
                const Icon = tab.icon;
                return (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => onChange(tab.id)}
                        className={`flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                            active
                                ? 'bg-teal-600 text-white shadow-sm shadow-teal-600/25'
                                : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                        }`}
                    >
                        {Icon && <Icon className={`h-3.5 w-3.5 ${active ? 'opacity-95' : 'opacity-70'}`} />}
                        <span className="whitespace-nowrap">{tab.label}</span>
                        {tab.count != null && (
                            <span
                                className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                                }`}
                            >
                                {tab.count}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    </div>
);

export const WfTable = ({ columns, rows, empty, footer, minWidth = '640px' }) => (
    <div className="w-full overflow-x-auto">
        <table className="w-full divide-y divide-slate-100" style={{ minWidth }}>
            <thead>
                <tr className="bg-slate-50/80">
                    {columns.map((col) => (
                        <th
                            key={col.key}
                            className="px-6 py-3.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 sm:px-7"
                        >
                            {col.label}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
                {rows.length === 0 ? (
                    <tr>
                        <td colSpan={columns.length} className="px-6 py-12 text-center text-sm text-slate-500 sm:px-7">
                            {empty || 'No data available'}
                        </td>
                    </tr>
                ) : (
                    rows.map((row, idx) => (
                        <tr key={row._key || row.id || idx} className="transition hover:bg-slate-50/70">
                            {columns.map((col) => (
                                <td
                                    key={col.key}
                                    className="px-6 py-3.5 text-sm text-slate-700 sm:px-7"
                                >
                                    {col.render ? col.render(row, idx) : row[col.key]}
                                </td>
                            ))}
                        </tr>
                    ))
                )}
            </tbody>
        </table>
        {footer && (
            <div className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500 sm:px-7">{footer}</div>
        )}
    </div>
);

export const WfEmpty = ({ icon: Icon, title, description, action }) => (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
        {Icon && (
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-teal-50 text-teal-600 ring-1 ring-teal-100">
                <Icon className="h-6 w-6" />
            </div>
        )}
        <p className="text-base font-semibold text-slate-800">{title}</p>
        {description && <p className="mt-1 max-w-sm text-sm text-slate-500">{description}</p>}
        {action && <div className="mt-5">{action}</div>}
    </div>
);

export const WfModal = ({ title, subtitle, onClose, children, maxWidth = 'max-w-3xl' }) => (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 backdrop-blur-[2px] sm:items-center sm:p-4">
        <div
            className={`max-h-[92vh] w-full overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl ${maxWidth}`}
            role="dialog"
            aria-modal="true"
        >
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4 sm:px-6">
                <div>
                    <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
                    {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
                </div>
                <button
                    type="button"
                    onClick={onClose}
                    className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    aria-label="Close"
                >
                    <FaTimes />
                </button>
            </div>
            <div className="max-h-[calc(92vh-4.5rem)] overflow-y-auto px-5 py-5 sm:px-6">{children}</div>
        </div>
    </div>
);

export const WfField = ({ label, required, hint, children }) => (
    <div>
        {label && (
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
                {label}
                {required && <span className="ml-0.5 text-rose-500">*</span>}
            </label>
        )}
        {children}
        {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
);

export const wfInputClass =
    'w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20';

export const wfInputReadonlyClass =
    'w-full rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-sm text-slate-700 outline-none';

export const gapTone = (gap) => {
    if (gap > 0) return 'text-rose-600';
    if (gap < 0) return 'text-amber-600';
    return 'text-emerald-600';
};
