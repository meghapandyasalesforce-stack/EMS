import React from 'react';
import { FiBriefcase, FiEdit, FiUserCheck } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import EmployeeFieldGrid from '../EmployeeFieldGrid';
import { formatDate, formatDateTime, formatSalary, getStatusLabel } from '../utils';

const JobDetailsTab = ({
  employee,
  isManagerReadOnly,
  onEditWork,
  canPromoteToHr = false,
  onPromoteToHr,
  promotingToHr = false,
  isHrManagerProfile = false,
  hidePayrollFields = false,
}) => {
  const workFields = [
    { label: 'Job Title', value: employee.jobTitle },
    { label: 'Department', value: employee.department },
    { label: 'Position', value: employee.position },
    {
      label: 'Manager',
      value:
        !employee.managerId &&
        (!employee.manager || ['Admin', 'CEO'].includes(String(employee.manager).trim()))
          ? 'Organization root (no manager)'
          : employee.manager,
    },
    {
      label: 'Shift',
      value: employee.shiftName || employee.shiftId || 'No Shift',
    },
    ...(hidePayrollFields ? [] : [{ label: 'Salary', value: formatSalary(employee.salary) }]),
    { label: 'Joining Date', value: formatDate(employee.joiningDate) },
    {
      label: 'Probation',
      value: employee.probation?.status && employee.probation.status !== 'None'
        ? `${employee.probation.status}${
            employee.probation.confirmedAt
              ? ` (confirmed ${formatDate(employee.probation.confirmedAt)})`
              : employee.probation.endDate
                ? ` (ends ${formatDate(employee.probation.endDate)})`
                : ''
          }`
        : '—',
    },
    { label: 'Created At', value: formatDateTime(employee.createdAt) },
    { label: 'Status', value: getStatusLabel(employee) },
    { label: 'Employee ID', value: employee.employeeId },
  ];

  const financialFields = employee.financialDetails
    ? [
        { label: 'Bank Name', value: employee.financialDetails.bankName },
        { label: 'Account Name', value: employee.financialDetails.accountName },
        { label: 'Account Number', value: employee.financialDetails.accountNo },
        { label: 'IFSC Code', value: employee.financialDetails.ifsc },
        { label: 'PAN Number', value: employee.financialDetails.panNumber },
        { label: 'EPF UAN', value: employee.financialDetails.epfUan },
        {
          label: 'Tax Regime',
          value: employee.financialDetails.taxRegime || employee.financialDetails.taxId,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <SectionCard
        title="Work Information"
        icon={FiBriefcase}
        action={
          !isManagerReadOnly ? (
            <div className="flex flex-wrap items-center gap-2">
              {canPromoteToHr && !isHrManagerProfile && onPromoteToHr ? (
                <button
                  type="button"
                  onClick={onPromoteToHr}
                  disabled={promotingToHr}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:opacity-60"
                >
                  <FiUserCheck className="h-4 w-4" />
                  {promotingToHr ? 'Updating…' : 'Make HR Manager'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onEditWork}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
              >
                <FiEdit className="h-4 w-4" />
                Edit
              </button>
            </div>
          ) : null
        }
      >
        <EmployeeFieldGrid fields={workFields} />
      </SectionCard>

      {financialFields.length > 0 && !hidePayrollFields && (
        <SectionCard title="Financial Details (Payroll)">
          <EmployeeFieldGrid fields={financialFields} />
        </SectionCard>
      )}
    </div>
  );
};

export default JobDetailsTab;
