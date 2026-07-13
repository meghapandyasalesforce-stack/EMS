import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { FaDownload, FaChartBar, FaBars, FaTimes } from 'react-icons/fa';
import { REPORT_NAV, MINT_GRADIENT } from '../constants';

const navLinkClass = ({ isActive }) =>
    `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition whitespace-nowrap ${
        isActive
            ? 'border-l-[3px] border-[#20C997] bg-[#20C997]/10 text-[#0d9488]'
            : 'border-l-[3px] border-transparent text-slate-600 hover:bg-slate-50 hover:text-slate-900'
    }`;

const ReportsSidebar = () => {
    const navigate = useNavigate();
    const [mobileOpen, setMobileOpen] = useState(false);

    return (
        <>
            {/* Mobile / tablet: compact bar + optional panel (same links, no desktop change) */}
            <div className="shrink-0 border-b border-slate-200 bg-white lg:hidden">
                <div className="flex items-center justify-between gap-2 px-3 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                        <div
                            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaChartBar className="h-3.5 w-3.5" />
                        </div>
                        <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-slate-900">HR Reports</p>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                Enterprise Analytics
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        aria-label={mobileOpen ? 'Hide report menu' : 'Show report menu'}
                        onClick={() => setMobileOpen((v) => !v)}
                        className="rounded-lg border border-slate-200 p-2 text-slate-600"
                    >
                        {mobileOpen ? <FaTimes className="h-4 w-4" /> : <FaBars className="h-4 w-4" />}
                    </button>
                </div>

                <div className="overflow-x-auto px-2 pb-2">
                    <nav className="flex min-w-max gap-1">
                        {REPORT_NAV.map(({ path, label, icon: Icon }) => (
                            <NavLink
                                key={path}
                                to={`/admin/reports/${path}`}
                                onClick={() => setMobileOpen(false)}
                                className={({ isActive }) =>
                                    `flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium whitespace-nowrap ${
                                        isActive
                                            ? 'bg-[#20C997]/10 text-[#0d9488]'
                                            : 'text-slate-600 hover:bg-slate-50'
                                    }`
                                }
                            >
                                <Icon className="h-3.5 w-3.5 shrink-0" />
                                {label}
                            </NavLink>
                        ))}
                    </nav>
                </div>

                {mobileOpen && (
                    <div className="border-t border-slate-100 px-3 py-3">
                        <button
                            type="button"
                            onClick={() => {
                                setMobileOpen(false);
                                navigate('/hr/analytics');
                            }}
                            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaDownload className="h-3.5 w-3.5" />
                            Advanced Analytics
                        </button>
                    </div>
                )}
            </div>

            {/* Desktop sidebar — unchanged */}
            <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white lg:flex">
                <div className="border-b border-slate-100 px-4 py-5">
                    <div className="flex items-center gap-2">
                        <div
                            className="flex h-9 w-9 items-center justify-center rounded-lg text-white"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaChartBar className="h-4 w-4" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">HR Reports</p>
                            <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">
                                Enterprise Analytics
                            </p>
                        </div>
                    </div>
                </div>

                <nav className="flex-1 space-y-0.5 px-2 py-4">
                    {REPORT_NAV.map(({ path, label, icon: Icon }) => (
                        <NavLink key={path} to={`/admin/reports/${path}`} className={navLinkClass}>
                            <Icon className="h-4 w-4 shrink-0" />
                            {label}
                        </NavLink>
                    ))}
                </nav>

                <div className="border-t border-slate-100 p-3">
                    <button
                        type="button"
                        onClick={() => navigate('/hr/analytics')}
                        className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:opacity-90"
                        style={{ background: MINT_GRADIENT }}
                    >
                        <FaDownload className="h-3.5 w-3.5" />
                        Advanced Analytics
                    </button>
                </div>
            </aside>
        </>
    );
};

export default ReportsSidebar;
