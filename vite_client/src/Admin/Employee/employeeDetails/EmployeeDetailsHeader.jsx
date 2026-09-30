import React from 'react';
import { FiActivity, FiClock, FiTrash2 } from 'react-icons/fi';
import ProfilePicture from '../../../Shared/ProfilePicture';
import { formatDate, getFullName, getStatusLabel } from './utils';

const EmployeeDetailsHeader = ({
  employee,
  canManageEmployeeActions = false,
  updatingStatus,
  terminatingEmployee,
  onStatusClick,
  onTerminateClick,
  onDeleteClick,
}) => {
  const status = getStatusLabel(employee);
  const isTerminated = employee.status === 'terminated';
  const reportsToLabel = employee.managerId
    ? employee.manager
    : employee.isOrgOwnerRoot ||
        !employee.manager ||
        ['Admin', 'CEO'].includes(String(employee.manager || '').trim())
      ? 'Organization root'
      : employee.manager || '';

  const statusChip = (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
        isTerminated
          ? 'bg-red-50 text-red-700'
          : employee.active
            ? 'bg-[#20C997]/15 text-[#0d9488]'
            : 'bg-slate-100 text-slate-600'
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          isTerminated ? 'bg-red-500' : employee.active ? 'bg-[#20C997]' : 'bg-slate-400'
        }`}
      />
      {status}
    </span>
  );

  return (
    <header className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <ProfilePicture user={employee} size="lg" className="shrink-0 sm:hidden" />
            <ProfilePicture user={employee} size="2xl" className="hidden shrink-0 sm:block" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-bold text-slate-900 sm:text-2xl md:text-3xl">{getFullName(employee)}</h1>
              <p className="mt-0.5 truncate text-sm text-slate-600">
                {employee.jobTitle || '—'} · {employee.department || '—'}
              </p>
              <div className="mt-2 hidden flex-wrap gap-2 sm:flex">
                {statusChip}
                {employee.position ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    {employee.position}
                  </span>
                ) : null}
                {employee.employeeId ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    ID: {employee.employeeId}
                  </span>
                ) : null}
                {employee.joiningDate ? (
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-700">
                    Joined {formatDate(employee.joiningDate)}
                  </span>
                ) : null}
              </div>
              {reportsToLabel ? (
                <p className="mt-2 hidden text-sm text-slate-500 sm:block">
                  <span className="font-medium text-slate-700">Reports to:</span> {reportsToLabel}
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-3 space-y-2.5 sm:hidden">
            <div className="flex flex-wrap gap-1.5">
              {statusChip}
              {employee.position ? (
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                  {employee.position}
                </span>
              ) : null}
            </div>
            <div className="grid grid-cols-2 gap-2 text-left text-xs">
              {employee.employeeId ? (
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Employee ID</p>
                  <p className="mt-0.5 truncate font-medium text-slate-800">{employee.employeeId}</p>
                </div>
              ) : null}
              {employee.joiningDate ? (
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">Joined</p>
                  <p className="mt-0.5 truncate font-medium text-slate-800">{formatDate(employee.joiningDate)}</p>
                </div>
              ) : null}
            </div>
            {reportsToLabel ? (
              <p className="text-left text-sm text-slate-500">
                <span className="font-medium text-slate-700">Reports to</span> {reportsToLabel}
              </p>
            ) : null}
          </div>
        </div>

        {canManageEmployeeActions ? (
          <div className="flex flex-col gap-2 sm:max-w-md sm:flex-row sm:flex-wrap sm:justify-end">
            <button
              type="button"
              onClick={onStatusClick}
              disabled={updatingStatus || isTerminated}
              className={`inline-flex h-10 w-full items-center justify-center gap-2 whitespace-nowrap rounded-full px-4 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 sm:h-auto sm:w-auto sm:py-2.5 ${
                employee.active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'
              }`}
            >
              <FiActivity className="h-4 w-4 shrink-0" />
              {isTerminated ? 'Terminated' : employee.active ? 'Deactivate' : 'Activate'}
            </button>
            <div className="grid grid-cols-2 gap-2 sm:flex">
              {!isTerminated && (
                <button
                  type="button"
                  onClick={onTerminateClick}
                  disabled={terminatingEmployee}
                  className="inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50 sm:h-auto sm:px-4 sm:py-2.5"
                >
                  <FiClock className="h-4 w-4 shrink-0" />
                  Terminate
                </button>
              )}
              <button
                type="button"
                onClick={onDeleteClick}
                className={`inline-flex h-10 items-center justify-center gap-2 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-3 text-sm font-semibold text-red-700 transition hover:bg-red-100 sm:h-auto sm:px-4 sm:py-2.5 ${
                  isTerminated ? 'col-span-2' : ''
                }`}
              >
                <FiTrash2 className="h-4 w-4 shrink-0" />
                Delete
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </header>
  );
};

export default EmployeeDetailsHeader;
