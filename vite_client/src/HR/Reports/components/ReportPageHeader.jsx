import React from 'react';
import { FaSearch } from 'react-icons/fa';

const ReportPageHeader = ({ title, subtitle, searchPlaceholder = 'Search...', searchValue, onSearchChange }) => (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
            <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
            {subtitle && <p className="mt-0.5 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {onSearchChange && (
            <div className="relative w-full max-w-md">
                <FaSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                    type="search"
                    value={searchValue}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={searchPlaceholder}
                    className="w-full rounded-full border border-slate-200 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-700 shadow-sm focus:border-[#20C997] focus:outline-none focus:ring-2 focus:ring-[#20C997]/20"
                />
            </div>
        )}
    </div>
);

export default ReportPageHeader;
