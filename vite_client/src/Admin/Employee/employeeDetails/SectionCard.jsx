import React from 'react';

const SectionCard = ({ title, icon: Icon, iconClassName = '', action, children, className = '' }) => (
  <section className={`ed-section rounded-2xl border border-slate-100 bg-white shadow-sm ${className}`}>
    <div className="ed-section__head flex flex-col gap-3 border-b border-slate-100 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 sm:py-4">
      <div className="flex min-w-0 items-center gap-2">
        {Icon ? (
          <Icon
            className={`ed-section__icon h-5 w-5 shrink-0 ${iconClassName || 'text-[#0E9370]'}`.trim()}
          />
        ) : null}
        <h3 className="ed-section__title text-base font-semibold text-slate-900">{title}</h3>
      </div>
      {action ? <div className="w-full shrink-0 sm:w-auto">{action}</div> : null}
    </div>
    <div className="ed-section__body p-4 sm:p-5">{children}</div>
  </section>
);

export default SectionCard;
