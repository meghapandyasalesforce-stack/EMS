import React from 'react';
import { FiDollarSign, FiEdit, FiShield } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import EmployeeFieldGrid from '../EmployeeFieldGrid';
import { formatSalary } from '../utils';

const PayrollTab = ({ employee, canEditPayrollSettings, onEditPayrollSettings }) => {
  const deductPf = employee.financialDetails?.deductPf !== false;
  const deductEsi = employee.financialDetails?.deductEsi !== false;

  const payrollFields = [
    { label: 'Annual Salary', value: formatSalary(employee.salary) },
    { label: 'Job Title', value: employee.jobTitle },
    { label: 'Department', value: employee.department },
    { label: 'Position', value: employee.position },
  ];

  const statutoryFields = [
    { label: 'Deduct PF', value: deductPf ? 'Yes' : 'No' },
    { label: 'Deduct ESI', value: deductEsi ? 'Yes' : 'No' },
    { label: 'EPF UAN', value: employee.financialDetails?.epfUan || '—' },
  ];

  const financialFields = employee.financialDetails
    ? [
        { label: 'Bank Name', value: employee.financialDetails.bankName },
        { label: 'Account Name', value: employee.financialDetails.accountName },
        { label: 'Account Number', value: employee.financialDetails.accountNo },
        { label: 'IFSC', value: employee.financialDetails.ifsc },
        { label: 'PAN', value: employee.financialDetails.panNumber },
        {
          label: 'Tax Regime',
          value: employee.financialDetails.taxRegime || employee.financialDetails.taxId,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      <SectionCard title="Payroll summary" icon={FiDollarSign}>
        <EmployeeFieldGrid fields={payrollFields} />
        <p className="mt-4 text-xs text-slate-500">
          Detailed payslips are available from the Payroll module for this employee.
        </p>
      </SectionCard>

      <SectionCard
        title="Statutory deductions"
        icon={FiShield}
        action={
          canEditPayrollSettings && onEditPayrollSettings ? (
            <button
              type="button"
              onClick={onEditPayrollSettings}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
            >
              <FiEdit className="h-4 w-4" />
              Edit
            </button>
          ) : null
        }
      >
        <EmployeeFieldGrid fields={statutoryFields} />
        <p className="mt-3 text-xs text-slate-500">
          When disabled, PF and ESI (employee and employer contributions) are not applied in future
          payroll runs for this employee.
        </p>
      </SectionCard>

      {financialFields.length > 0 && (
        <SectionCard title="Bank & tax details">
          <EmployeeFieldGrid fields={financialFields} />
        </SectionCard>
      )}
    </div>
  );
};

export default PayrollTab;
