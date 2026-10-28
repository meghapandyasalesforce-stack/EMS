import React, { useMemo } from 'react';
import {
  FiCreditCard,
  FiDollarSign,
  FiEdit,
  FiFileText,
  FiShield,
} from 'react-icons/fi';
import { formatDate, formatSalary } from '../utils';

const display = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  return value;
};

const maskAccount = (accountNo) => {
  const raw = String(accountNo || '').replace(/\s+/g, '');
  if (!raw) return null;
  if (raw.length <= 4) return `A/c **${raw}`;
  return `A/c **${raw.slice(-4)}`;
};

const inr = (value) => {
  if (value === undefined || value === null || Number.isNaN(Number(value))) return '—';
  return formatSalary(value);
};

const PayTile = ({ label, value, hint, accent }) => (
  <div className={`pay-tab__tile${accent ? ' is-accent' : ''}`}>
    <p className="pay-tab__tile-label">{label}</p>
    <p className="pay-tab__tile-value">{display(value)}</p>
    {hint ? <p className="pay-tab__tile-hint">{hint}</p> : null}
  </div>
);

const PayrollTab = ({ employee, canEditPayrollSettings, onEditPayrollSettings }) => {
  const deductPf = employee.financialDetails?.deductPf !== false;
  const deductEsi = employee.financialDetails?.deductEsi !== false;
  const fd = employee.financialDetails || {};

  const ctc = useMemo(() => {
    const annual = Number(employee.salary);
    const hasSalary = Number.isFinite(annual) && annual > 0;

    const fixedBase = hasSalary ? Math.round(annual * (3600000 / 4250000)) : null;
    const bonus = hasSalary ? Math.round(annual * (450000 / 4250000)) : null;
    const retirals =
      hasSalary && fixedBase != null && bonus != null
        ? Math.max(0, Math.round(annual - fixedBase - bonus))
        : null;
    const monthlyBase = fixedBase != null ? Math.round(fixedBase / 12) : null;

    const revisions = Array.isArray(employee.salaryRevisions) ? employee.salaryRevisions : [];
    const latest = [...revisions].sort(
      (a, b) => new Date(b.effectiveFrom || 0) - new Date(a.effectiveFrom || 0)
    )[0];

    let revisionLine = 'Current contracted compensation';
    if (latest?.effectiveFrom) {
      const when = formatDate(latest.effectiveFrom);
      revisionLine = latest.note
        ? `Revision effective from ${when} (${latest.note})`
        : `Revision effective from ${when}`;
    } else if (employee.joiningDate) {
      revisionLine = `Effective from ${formatDate(employee.joiningDate)}`;
    }

    const bankName = fd.bankName || null;
    const masked = maskAccount(fd.accountNo);
    const bankLine =
      bankName && masked ? `${bankName} • ${masked}` : bankName || masked || '—';

    return {
      hasSalary,
      annual,
      fixedBase,
      bonus,
      retirals,
      monthlyBase,
      revisionLine,
      bankLine,
      ifsc: fd.ifsc || null,
      pan: fd.panNumber || null,
      panVerified: Boolean(fd.panNumber),
    };
  }, [employee, fd.accountNo, fd.bankName, fd.ifsc, fd.panNumber]);

  const bankTaxTiles = [
    { label: 'Bank Name', value: fd.bankName },
    { label: 'Account Name', value: fd.accountName },
    { label: 'Account Number', value: fd.accountNo },
    { label: 'IFSC Code', value: fd.ifsc },
    { label: 'PAN Number', value: fd.panNumber, hint: fd.panNumber ? 'Verified' : null },
    { label: 'EPF UAN', value: fd.epfUan },
    { label: 'Tax Regime', value: fd.taxRegime || fd.taxId },
    {
      label: 'Metro City',
      value: fd.metroCity === true ? 'Yes' : fd.metroCity === false ? 'No' : null,
    },
  ];

  const statutoryTiles = [
    {
      label: 'Deduct PF',
      value: deductPf ? 'Enabled' : 'Disabled',
      hint: deductPf ? 'Employee + employer PF applied' : 'Skipped in payroll runs',
      accent: deductPf,
    },
    {
      label: 'Deduct ESI',
      value: deductEsi ? 'Enabled' : 'Disabled',
      hint: deductEsi ? 'Employee + employer ESI applied' : 'Skipped in payroll runs',
      accent: deductEsi,
    },
    {
      label: 'EPF UAN',
      value: fd.epfUan,
      hint: fd.epfUan ? 'Linked to PF filings' : 'Add UAN for PF compliance',
    },
  ];

  return (
    <div className="pay-tab">
      <section className="pay-ctc">
        <div className="pay-ctc__head">
          <div className="pay-ctc__head-main">
            <div className="pay-ctc__title-row">
              <FiDollarSign className="pay-ctc__title-icon" aria-hidden="true" />
              <h2 className="pay-ctc__title">Annual CTC &amp; Salary Structure</h2>
              <span className="pay-ctc__badge">Manager Confidential</span>
            </div>
            <p className="pay-ctc__sub">{ctc.revisionLine}</p>
          </div>
          <div className="pay-ctc__total">
            <p className="pay-ctc__total-label">Total Cost To Company</p>
            <p className="pay-ctc__total-value">
              {ctc.hasSalary ? inr(ctc.annual) : '—'}
              {ctc.hasSalary ? <span className="pay-ctc__total-unit"> / yr</span> : null}
            </p>
          </div>
        </div>

        <div className="pay-ctc__breakdown">
          <div className="pay-ctc__tile">
            <p className="pay-ctc__tile-label">Fixed Base Salary</p>
            <p className="pay-ctc__tile-value">{ctc.hasSalary ? inr(ctc.fixedBase) : '—'}</p>
            <p className="pay-ctc__tile-meta">
              {ctc.monthlyBase != null ? `${inr(ctc.monthlyBase)} monthly gross base` : '—'}
            </p>
          </div>
          <div className="pay-ctc__tile">
            <p className="pay-ctc__tile-label">Target Performance Bonus</p>
            <p className="pay-ctc__tile-value pay-ctc__tile-value--secondary">
              {ctc.hasSalary ? inr(ctc.bonus) : '—'}
            </p>
            <p className="pay-ctc__tile-meta">Disbursed annually (Based on KPI)</p>
          </div>
          <div className="pay-ctc__tile">
            <p className="pay-ctc__tile-label">Retirals &amp; Statutory PF</p>
            <p className="pay-ctc__tile-value">{ctc.hasSalary ? inr(ctc.retirals) : '—'}</p>
            <p className="pay-ctc__tile-meta">
              {deductPf ? 'Employer PF • Gratuity pool' : 'PF deduction disabled'}
            </p>
          </div>
        </div>

        <div className="pay-ctc__bank-row">
          <div>
            <span className="pay-ctc__bank-label">Disbursement Bank</span>
            <span className="pay-ctc__bank-value">
              <FiCreditCard className="pay-ctc__bank-glyph" aria-hidden="true" />
              {ctc.bankLine}
            </span>
          </div>
          <div>
            <span className="pay-ctc__bank-label">IFSC Code</span>
            <span className="pay-ctc__bank-value">{ctc.ifsc || '—'}</span>
          </div>
          <div>
            <span className="pay-ctc__bank-label">Income Tax PAN</span>
            <span className="pay-ctc__bank-value">
              {ctc.pan ? `${ctc.pan}${ctc.panVerified ? ' (Verified)' : ''}` : '—'}
            </span>
          </div>
        </div>
      </section>

      <section className="pay-panel">
        <div className="pay-panel__head">
          <div className="pay-panel__title-row">
            <FiCreditCard className="pay-panel__icon" aria-hidden="true" />
            <h2 className="pay-panel__title">Bank &amp; Tax Details</h2>
          </div>
          <p className="pay-panel__sub">Disbursement account and statutory tax identifiers</p>
        </div>
        <div className="pay-tab__grid">
          {bankTaxTiles.map((tile) => (
            <PayTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              hint={tile.hint}
            />
          ))}
        </div>
      </section>

      <section className="pay-panel">
        <div className="pay-panel__head">
          <div className="pay-panel__title-row">
            <FiShield className="pay-panel__icon" aria-hidden="true" />
            <h2 className="pay-panel__title">Statutory Deductions</h2>
            {canEditPayrollSettings && onEditPayrollSettings ? (
              <button type="button" onClick={onEditPayrollSettings} className="pay-panel__edit">
                <FiEdit className="h-3.5 w-3.5" aria-hidden="true" />
                Edit
              </button>
            ) : null}
          </div>
          <p className="pay-panel__sub">
            When disabled, PF and ESI are not applied in future payroll runs for this employee.
          </p>
        </div>
        <div className="pay-tab__grid pay-tab__grid--3">
          {statutoryTiles.map((tile) => (
            <PayTile
              key={tile.label}
              label={tile.label}
              value={tile.value}
              hint={tile.hint}
              accent={tile.accent}
            />
          ))}
        </div>
        <p className="pay-panel__footnote">
          <FiFileText className="pay-panel__footnote-icon" aria-hidden="true" />
          Detailed payslips remain available from the Payroll module for this employee.
        </p>
      </section>
    </div>
  );
};

export default PayrollTab;
