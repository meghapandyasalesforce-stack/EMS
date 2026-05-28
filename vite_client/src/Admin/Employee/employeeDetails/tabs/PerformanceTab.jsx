import React from 'react';
import { FiEdit, FiTrendingUp } from 'react-icons/fi';
import SectionCard from '../SectionCard';

const StatBox = ({ value, label, hint, colorClass = 'text-[#20C997]' }) => (
  <div className="rounded-2xl border border-slate-100 bg-slate-50/80 p-5 text-center">
    <p className={`text-3xl font-bold ${colorClass}`}>{value}</p>
    <p className="mt-1 text-sm font-medium text-slate-700">{label}</p>
    {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
  </div>
);

const PerformanceTab = ({
  employee,
  isManagerReadOnly,
  onEditPerformance,
  yearsExperience,
  attendanceRate,
}) => (
  <SectionCard
    title="Performance & statistics"
    icon={FiTrendingUp}
    action={
      !isManagerReadOnly ? (
        <button
          type="button"
          onClick={onEditPerformance}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <FiEdit className="h-4 w-4" />
          Edit score
        </button>
      ) : null
    }
  >
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatBox
        value={employee.performanceScore ?? 'N/A'}
        label="Performance score"
        hint="Set by admin/manager"
      />
      <StatBox
        value={typeof attendanceRate === 'number' ? `${attendanceRate}%` : attendanceRate}
        label="Attendance rate"
        hint="Auto-calculated"
        colorClass="text-emerald-600"
      />
      <StatBox
        value={employee.projectsCompleted ?? '0'}
        label="Projects completed"
        hint="Auto-calculated"
        colorClass="text-amber-600"
      />
      <StatBox
        value={yearsExperience}
        label="Years experience"
        hint="From joining date"
        colorClass="text-sky-600"
      />
    </div>
  </SectionCard>
);

export default PerformanceTab;
