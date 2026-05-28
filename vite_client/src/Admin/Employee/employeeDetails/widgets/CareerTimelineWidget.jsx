import React, { useMemo } from 'react';
import { formatDate } from '../utils';

const CareerTimelineWidget = ({ employee }) => {
  const events = useMemo(() => {
    const list = [];
    if (employee?.joiningDate) {
      list.push({
        id: 'joined',
        title: 'Joined organization',
        date: employee.joiningDate,
        tone: 'mint',
      });
    }
    (employee?.workHistory || []).forEach((w, i) => {
      list.push({
        id: `work-${i}`,
        title: w.position ? `${w.position} at ${w.company || 'Company'}` : w.company || 'Work history',
        date: w.startDate || w.endDate,
        tone: 'slate',
      });
    });
    if (employee?.status === 'terminated') {
      list.push({
        id: 'terminated',
        title: 'Employment terminated',
        date: employee.terminationDate || employee.updatedAt,
        tone: 'amber',
      });
    }
    return list
      .filter((e) => e.date)
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 5);
  }, [employee]);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Career timeline</p>
      {events.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No timeline events yet.</p>
      ) : (
        <ul className="mt-4 space-y-4">
          {events.map((ev) => (
            <li key={ev.id} className="flex gap-3">
              <span
                className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${
                  ev.tone === 'mint' ? 'bg-[#20C997]' : ev.tone === 'amber' ? 'bg-amber-500' : 'bg-slate-300'
                }`}
              />
              <div>
                <p className="text-sm font-medium text-slate-800">{ev.title}</p>
                <p className="text-xs text-slate-500">{formatDate(ev.date)}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default CareerTimelineWidget;
