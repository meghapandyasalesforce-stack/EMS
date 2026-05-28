import React from 'react';

const SectionCard = ({ title, icon: Icon, action, children, className = '' }) => (
  <section className={`rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`}>
    <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
      <div className="flex items-center gap-2">
        {Icon ? <Icon className="h-5 w-5 text-[#20C997]" /> : null}
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
      </div>
      {action || null}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

export default SectionCard;
