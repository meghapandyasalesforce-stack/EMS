import React from 'react';
import { FiBriefcase, FiEdit } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import EmployeeFieldGrid from '../EmployeeFieldGrid';
import { formatDate, formatDateTime, formatSalary, getStatusLabel } from '../utils';

const JobDetailsTab = ({ employee, isManagerReadOnly, onEditWork }) => {
  const workFields = [
    { label: 'Job Title', value: employee.jobTitle },
    { label: 'Department', value: employee.department },
    { label: 'Position', value: employee.position },
    { label: 'Manager', value: employee.manager },
    { label: 'Salary', value: formatSalary(employee.salary) },
    { label: 'Joining Date', value: formatDate(employee.joiningDate) },
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
            <button
              type="button"
              onClick={onEditWork}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FiEdit className="h-4 w-4" />
              Edit
            </button>
          ) : null
        }
      >
        <EmployeeFieldGrid fields={workFields} />
      </SectionCard>

      {financialFields.length > 0 && (
        <SectionCard title="Financial Details (Payroll)">
          <EmployeeFieldGrid fields={financialFields} />
        </SectionCard>
      )}
    </div>
  );
};

export default JobDetailsTab;
