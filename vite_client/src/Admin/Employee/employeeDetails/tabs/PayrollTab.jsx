import React from 'react';
import { FiDollarSign } from 'react-icons/fi';
import SectionCard from '../SectionCard';
import EmployeeFieldGrid from '../EmployeeFieldGrid';
import { formatSalary } from '../utils';

const PayrollTab = ({ employee }) => {
  const payrollFields = [
    { label: 'Annual Salary', value: formatSalary(employee.salary) },
    { label: 'Job Title', value: employee.jobTitle },
    { label: 'Department', value: employee.department },
    { label: 'Position', value: employee.position },
  ];

  const financialFields = employee.financialDetails
    ? [
        { label: 'Bank Name', value: employee.financialDetails.bankName },
        { label: 'Account Name', value: employee.financialDetails.accountName },
        { label: 'Account Number', value: employee.financialDetails.accountNo },
        { label: 'IFSC', value: employee.financialDetails.ifsc },
        { label: 'PAN', value: employee.financialDetails.panNumber },
        { label: 'EPF UAN', value: employee.financialDetails.epfUan },
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
      {financialFields.length > 0 && (
        <SectionCard title="Bank & tax details">
          <EmployeeFieldGrid fields={financialFields} />
        </SectionCard>
      )}
    </div>
  );
};

export default PayrollTab;
