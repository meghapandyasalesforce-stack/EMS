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

  return (
    <header className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <ProfilePicture user={employee} size="2xl" className="shrink-0" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">{getFullName(employee)}</h1>
            <p className="mt-0.5 text-sm text-slate-600">
              {employee.jobTitle || '—'} · {employee.department || '—'}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${
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
            {employee.manager ? (
              <p className="mt-3 text-sm text-slate-500">
                <span className="font-medium text-slate-700">Reports to:</span> {employee.manager}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 lg:justify-end">
          {canManageEmployeeActions && (
            <>
              <button
                type="button"
                onClick={onStatusClick}
                disabled={updatingStatus || isTerminated}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white shadow-sm transition disabled:opacity-50 ${
                  employee.active ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-slate-600 hover:bg-slate-700'
                }`}
              >
                <FiActivity className="h-4 w-4" />
                {isTerminated ? 'Terminated' : employee.active ? 'Deactivate' : 'Activate'}
              </button>
              {!isTerminated && (
                <button
                  type="button"
                  onClick={onTerminateClick}
                  disabled={terminatingEmployee}
                  className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
                >
                  <FiClock className="h-4 w-4" />
                  Terminate
                </button>
              )}
              <button
                type="button"
                onClick={onDeleteClick}
                className="inline-flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
              >
                <FiTrash2 className="h-4 w-4" />
                Delete
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
};

export default EmployeeDetailsHeader;
