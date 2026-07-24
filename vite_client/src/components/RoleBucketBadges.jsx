import React, { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { roleBucketLabel } from '../utils/permissions';

const DISPLAY_ORDER = [
  'org_owner',
  'hr_manager',
  'hr_executive',
  'payroll_admin',
  'executive',
  'line_manager',
  'project_manager',
];

const RoleBucketBadges = ({ className = '', max = 3 }) => {
  const roleBuckets = useSelector((state) => state.auth.roleBuckets) || [];

  const labels = useMemo(() => {
    const sorted = [...roleBuckets].sort(
      (a, b) => DISPLAY_ORDER.indexOf(a) - DISPLAY_ORDER.indexOf(b)
    );
    return sorted
      .filter((b) => b && b !== 'employee')
      .slice(0, max)
      .map((b) => roleBucketLabel(b));
  }, [roleBuckets, max]);

  if (!labels.length) return null;

  return (
    <span className={`inline-flex flex-wrap gap-1 ${className}`}>
      {labels.map((label) => (
        <span
          key={label}
          className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800"
        >
          {label}
        </span>
      ))}
    </span>
  );
};

export default RoleBucketBadges;
