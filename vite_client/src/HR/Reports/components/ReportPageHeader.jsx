import React from 'react';
import { FaSearch } from 'react-icons/fa';

const ReportPageHeader = ({ title, subtitle, searchPlaceholder = 'Search...', searchValue, onSearchChange }) => (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#1E293B]">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-[#666666]">{subtitle}</p>}
        </div>
        {onSearchChange && (
            <div className="relative w-full max-w-md">
                <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="search"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="h-10 w-full rounded-lg border border-[#CBD5E1] bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-[0_4px_20px_-2px_rgba(14,43,61,0.06)] focus:border-[#0E9370] focus:outline-none focus:ring-[3px] focus:ring-[rgba(14,147,112,0.15)]"
                />
            </div>
        )}
    </div>
);

export default ReportPageHeader;
