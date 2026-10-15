import React from 'react';
import { FaGraduationCap, FaArrowLeft } from 'react-icons/fa';

/** Shared header wrapper for Create/Edit course forms */
const CourseFormShell = ({ title, subtitle, onBack, children }) => (
    <div className="page-shell bg-[#F3F7F5]">
        <div className="page-shell-inner space-y-5">
            <header className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start justify-between gap-3 p-4 sm:items-center sm:p-6">
                    <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-theme-primary/10 text-theme-primary sm:h-12 sm:w-12 sm:rounded-2xl sm:text-xl">
                            <FaGraduationCap />
                        </div>
                        <div className="min-w-0">
                            <h1 className="text-lg font-bold text-slate-900 sm:text-2xl">{title}</h1>
                            {subtitle ? <p className="mt-0.5 text-xs text-slate-500 sm:text-sm">{subtitle}</p> : null}
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onBack}
                        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 sm:px-3 sm:py-2 sm:text-sm"
                    >
                        <FaArrowLeft className="h-3 w-3" />
                        <span className="sm:hidden">Back</span>
                        <span className="hidden sm:inline">Back to Learning</span>
                    </button>
                </div>
            </header>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
                {children}
            </section>
        </div>
    </div>
);

export default CourseFormShell;
