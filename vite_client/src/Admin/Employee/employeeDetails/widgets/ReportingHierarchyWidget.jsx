import React from 'react';
import ProfilePicture from '../../../../Shared/ProfilePicture';
import { getFullName } from '../utils';

const HierarchyNode = ({ name, subtitle, user, highlighted }) => (
  <div
    className={`flex items-center gap-3 rounded-xl px-3 py-2 ${
      highlighted ? 'border border-[#20C997]/30 bg-[#20C997]/10' : 'bg-slate-50'
    }`}
  >
    <ProfilePicture user={user || { name }} size="sm" />
    <div className="min-w-0">
      <p className="truncate text-sm font-medium text-slate-900">{name}</p>
      {subtitle ? <p className="truncate text-xs text-slate-500">{subtitle}</p> : null}
    </div>
  </div>
);

const ReportingHierarchyWidget = ({ employee, managerPreview }) => {
  const managerName =
    managerPreview?.name
      ? getFullName(managerPreview)
      : typeof employee?.manager === 'string'
        ? employee.manager
        : null;

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Reporting hierarchy</p>
      <div className="mt-4 space-y-2">
        {managerName ? (
          <HierarchyNode
            name={managerName}
            subtitle={managerPreview?.jobTitle || 'Manager'}
            user={managerPreview}
          />
        ) : (
          <p className="text-sm text-slate-500">No manager assigned</p>
        )}
        <div className="flex justify-center py-1">
          <span className="h-4 w-px bg-slate-200" />
        </div>
        <HierarchyNode
          name={getFullName(employee)}
          subtitle={employee?.jobTitle || employee?.position}
          user={employee}
          highlighted
        />
      </div>
    </div>
  );
};

export default ReportingHierarchyWidget;
