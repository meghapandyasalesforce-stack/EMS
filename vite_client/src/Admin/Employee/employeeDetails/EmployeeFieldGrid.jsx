import React from 'react';

const EmployeeFieldGrid = ({ fields }) => (
  <dl className="grid grid-cols-1 gap-x-8 gap-y-4 sm:grid-cols-2">
    {fields.map(({ label, value, highlight }) => (
      <div key={label} className="border-b border-slate-50 pb-3 last:border-0">
        <dt className="text-xs font-semibold uppercase tracking-wide text-slate-400">{label}</dt>
        <dd
          className={`mt-1 text-sm ${
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
