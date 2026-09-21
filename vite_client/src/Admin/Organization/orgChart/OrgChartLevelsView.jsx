import React, { useMemo } from 'react';
import { FiInfo, FiLayers } from 'react-icons/fi';
import { ORG_POSITION_LEVELS } from '../../../constants/orgPositionLevels';

const STANDARD_LEVELS = ORG_POSITION_LEVELS;

export default function OrgChartLevelsView({ employees, positionLevelsFromApi = [] }) {
  const counts = useMemo(() => {
    const map = new Map();
    for (const e of employees) {
      const level = e.position || 'Unassigned';
      map.set(level, (map.get(level) || 0) + 1);
    }
    return map;
  }, [employees]);

  const displayLevels = useMemo(() => {
    const seen = new Set(STANDARD_LEVELS);
    const custom = [...counts.keys()].filter((l) => !seen.has(l)).sort();
    return [...STANDARD_LEVELS, ...custom];
  }, [counts]);

  const apiExtras = positionLevelsFromApi.filter(
    (l) => !STANDARD_LEVELS.includes(l) && !counts.has(l)
  );

  return (
    <div className="levels-view space-y-3">
      <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">Position levels</h2>
          <p className="truncate text-xs text-slate-500">
            Levels describe roles · managers define reporting connections
          </p>
        </div>
        <FiLayers className="hidden h-7 w-7 shrink-0 text-emerald-300 sm:block" aria-hidden="true" />
      </div>

      <div className="level-grid grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayLevels.map((level) => {
          const count = counts.get(level) || 0;
          const isStandard = STANDARD_LEVELS.includes(level);
          return (
            <div
              key={level}
              className="level-card rounded-lg border border-slate-200 bg-white px-3 py-2.5 shadow-sm"
            >
              <strong className="block text-sm font-semibold text-slate-900">{level}</strong>
              <small className="mt-0.5 block text-xs text-slate-500">
                {count} {count === 1 ? 'person' : 'people'}
                {!isStandard ? ' · custom' : ''}
              </small>
            </div>
          );
        })}
        {apiExtras.map((level) => (
          <div
            key={`api-${level}`}
            className="level-card rounded-lg border border-dashed border-slate-200 bg-slate-50 px-3 py-2.5"
          >
            <strong className="block text-sm font-semibold text-slate-700">{level}</strong>
            <small className="mt-0.5 block text-xs text-slate-500">0 people · catalog</small>
          </div>
        ))}
      </div>

      <div className="flex gap-2 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-950 sm:text-sm">
        <FiInfo className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <div>
          <strong className="font-semibold">Levels are flexible; reporting lines are explicit.</strong>
          <p className="mt-0.5">
            A Senior can report to a Lead or a Manager. Department managers report to the
            organization Admin root. CTO and CFO can both report under Admin (or CEO-level
            leadership) via managerId position levels do not create the tree by themselves.
            Custom designations such as Trainee or Senior Manager are preserved from your existing
            records and org structure catalog.
          </p>
        </div>
      </div>
    </div>
  );
}
