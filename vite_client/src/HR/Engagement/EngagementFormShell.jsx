import React from 'react';
import { FaArrowLeft, FaChartLine } from 'react-icons/fa';
import { MINT_GRADIENT } from '../Reports/constants';

const EngagementFormShell = ({
    title,
    subtitle,
    onBack,
    backLabel = 'Back to Engagement',
    children,
}) => (
    <div className="min-h-[calc(100vh-64px)] bg-[#F5F7FB] p-4 sm:p-6 lg:p-8">
        <div className="mx-auto max-w-4xl space-y-6">
            <header className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-4">
                        <div
                            className="flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-md"
                            style={{ background: MINT_GRADIENT }}
                        >
                            <FaChartLine className="h-6 w-6" />
                        </div>
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                                HR Workspace
                            </p>
                            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
                            {subtitle ? <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p> : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                        <FaArrowLeft className="h-3.5 w-3.5" />
                        {backLabel}
                    </button>
                </div>
            </header>
            <section className="rounded-[28px] border border-slate-100 bg-white p-5 shadow-sm md:p-6">
                {children}
            </section>
        </div>
    </div>
);

export default EngagementFormShell;
