import React, { useMemo } from 'react';
import { buildCareerProgressionEvents } from '../utils';

const CareerTimelineWidget = ({ employee, managerPreview = null }) => {
  const events = useMemo(
    () => buildCareerProgressionEvents(employee, managerPreview).slice(0, 5),
    [employee, managerPreview]
  );

  return (
    <div className="ed-rail-card rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="ed-rail-card__label text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
        Career timeline
      </p>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No timeline events yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {events.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  ev.active ? 'bg-[#0E9370]' : 'bg-slate-300'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                <p className="text-xs text-slate-500">{ev.dateLabel}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CareerTimelineWidget;
