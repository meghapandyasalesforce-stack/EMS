import React from 'react';
import { MINT_GRADIENT } from '../constants';
import { formatSalary } from '../utils';

const PayrollHighlightWidget = ({ employee }) => (
  <div
    className="rounded-2xl p-5 text-white shadow-md"
    style={{ background: MINT_GRADIENT }}
  >
    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/80">Compensation</p>
    <p className="mt-2 text-2xl font-bold">{formatSalary(employee?.salary)}</p>
    <p className="mt-1 text-sm text-white/90">Annual salary on record</p>
    {employee?.financialDetails?.bankName ? (
      <p className="mt-3 text-xs text-white/75">
        Paid via {employee.financialDetails.bankName}
      </p>
    ) : null}
  </div>
);

export default PayrollHighlightWidget;
