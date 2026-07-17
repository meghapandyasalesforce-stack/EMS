import React from 'react';

const EmployeeFieldGrid = ({ fields }) => (
  <dl className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 lg:gap-x-8">
    {fields.map(({ label, value, highlight }) => (
      <div key={label} className="min-w-0 border-b border-slate-50 pb-3 last:border-0 sm:last:border-b">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd
          className={`mt-1 break-words text-sm ${
            highlight ? 'font-medium text-[#0d9488]' : 'text-slate-800'
          }`}
        >
          {value ?? 'N/A'}
        </dd>
      </div>
    ))}
  </dl>
);

export default EmployeeFieldGrid;
