import React, { useEffect, useMemo, useState } from 'react';
import axios from '../../../../utils/axios';
import { getLeaveTypeDisplayName, getDisplayMonthlyAccrualRate } from '../../../../constants/leaveConstants';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const LEAVE_MIN_YEAR = 2016;

const selectClassName =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#20C997] focus:outline-none focus:ring-2 focus:ring-[#20C997]/20';

const BalanceMetricValue = ({ value, prefix = '', valueClassName = 'text-slate-900', daysClassName = 'text-slate-500' }) => (
  <dd className="text-right leading-none">
    <span className={`block text-xl font-semibold ${valueClassName}`}>
      {prefix}
      {fmtDays(value)}
    </span>
    <span className={`mt-1 block text-xs font-normal ${daysClassName}`}>days</span>
  </dd>
);

export const LeavePeriodDropdowns = ({
  viewMonth,
  viewYear,
  onMonthChange,
  onYearChange,
  monthOptions,
  yearOptions,
  className = '',
}) => (
  <div className={`ml-auto flex w-[7.5rem] shrink-0 flex-col gap-2 ${className}`.trim()}>
    <select
      value={viewMonth}
      onChange={(e) => onMonthChange(Number(e.target.value))}
      className={selectClassName}
      aria-label="Month"
    >
      {monthOptions.map((m) => (
        <option key={m.value} value={m.value}>
          {m.label}
        </option>
      ))}
    </select>
    <select
      value={viewYear}
      onChange={(e) => onYearChange(Number(e.target.value))}
      className={selectClassName}
      aria-label="Year"
    >
      {yearOptions.map((y) => (
        <option key={y} value={y}>
          {y}
        </option>
      ))}
    </select>
  </div>
);

const fmtDays = (value) => {
  const n = Number(value) || 0;
  return n % 1 === 0 ? String(n) : n.toFixed(1);
};

const buildEmptyBalance = (leaveType, policyLeaveTypes = []) => ({
  leaveType,
  accrued: 0,
  used: 0,
  available: 0,
  availableDays: 0,
  usedDays: 0,
  leaveTypeDisplayName: getLeaveTypeDisplayName(leaveType, policyLeaveTypes),
});

export const getDisplayLeaveBalances = (balance, policyLeaveTypes = []) => {
  if (!balance) return [];
  const rows = balance.balances || [];
  const enabledPolicyTypes = policyLeaveTypes.filter(
    (lt) => lt?.type && lt.enabled !== false
  );

  if (enabledPolicyTypes.length > 0) {
    return enabledPolicyTypes.map((lt) => {
      const match = rows.find((b) => b.leaveType === lt.type);
      return match || buildEmptyBalance(lt.type, policyLeaveTypes);
    });
  }

  return rows.length > 0 ? rows : [];
};

export const LeaveBalanceCard = ({ typeBalance, policyLeaveTypes }) => {
  const policyType = policyLeaveTypes.find((lt) => lt.type === typeBalance.leaveType);
  const displayName =
    typeBalance.leaveTypeDisplayName ||
    policyType?.displayName ||
    getLeaveTypeDisplayName(typeBalance.leaveType, policyLeaveTypes);
  const isPooledCategory = Boolean(typeBalance.isPooledCategory);
  const accrued = Number(typeBalance.accrued ?? typeBalance.earnedToDate ?? 0);
  const used = Number(typeBalance.usedDays ?? typeBalance.used ?? 0);
  const available = Number(typeBalance.availableDays ?? typeBalance.available ?? 0);
  const carried = Number(typeBalance.carriedDays ?? typeBalance.carriedForward ?? 0);
  const monthlyRate = getDisplayMonthlyAccrualRate(
    typeBalance.leaveType,
    policyType,
    typeBalance.monthlyRate
  );
  const yearlyMax = monthlyRate > 0 ? monthlyRate * 12 : 0;

  return (
    <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm">
      <h4 className="text-base font-semibold text-slate-900">{displayName}</h4>

      <dl className="mt-4 space-y-3 text-sm">
        {isPooledCategory ? (
          <>
            <p className="text-xs text-slate-500">
              Leave category only — your total balance is shown in the employee leave summary above.
            </p>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-slate-600">Used:</dt>
              <BalanceMetricValue
                value={used}
                prefix="-"
                valueClassName="text-red-500"
                daysClassName="text-red-500"
              />
            </div>
            {Number(typeBalance.pendingDays ?? typeBalance.pending) > 0 && (
              <div className="flex items-start justify-between gap-3">
                <dt className="text-slate-600">Pending:</dt>
                <BalanceMetricValue value={Number(typeBalance.pendingDays ?? typeBalance.pending)} />
              </div>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-slate-600">Accrued:</dt>
              <BalanceMetricValue value={accrued} />
            </div>
            <div className="flex items-start justify-between gap-3">
              <dt className="text-slate-600">Used:</dt>
              <BalanceMetricValue
                value={used}
                prefix="-"
                valueClassName="text-red-500"
                daysClassName="text-red-500"
              />
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3">
              <dt className="font-semibold text-slate-800">Available:</dt>
              <BalanceMetricValue
                value={available}
                valueClassName="text-xl font-bold text-[#0d9488]"
                daysClassName="text-[#0d9488]"
              />
            </div>
          </>
        )}
      </dl>

      {monthlyRate > 0 && isPooledCategory && (
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Monthly entitlement</span>
          <span className="text-right text-slate-500">
            {fmtDays(monthlyRate)} days/month ({fmtDays(yearlyMax)}/year max)
          </span>
        </div>
      )}

      {monthlyRate > 0 && !isPooledCategory && (
        <div className="mt-4 flex items-start justify-between gap-3 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <span>Monthly entitlement</span>
          <span className="text-right text-slate-500">
            {fmtDays(monthlyRate)} days/month ({fmtDays(yearlyMax)}/year max)
          </span>
        </div>
      )}
    </div>
  );
};

export const EmployeeLeaveSummaryPanel = ({ summary, loading, subtitle }) => {
  const totals = summary || {
    totalAvailableLeave: 0,
    totalAccrued: 0,
    totalUsed: 0,
    totalCarriedForward: 0,
    totalPending: 0,
    earnedThisMonth: 0,
  };

  return (
    <div className="overflow-hidden rounded-2xl border border-[#20C997]/20 bg-gradient-to-br from-[#20C997]/10 via-white to-[#F0FDF4] shadow-md p-6">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-[#0d9488]">
        Employee leave summary
      </p>
      <h2 className="mt-2 text-3xl font-bold text-slate-900">
        {loading ? '…' : `${fmtDays(totals.totalAvailableLeave)} days available`}
      </h2>
      {!loading && subtitle && <p className="mt-1 text-sm text-slate-600">{subtitle}</p>}
      {!loading && (
        <dl className="mt-6 grid grid-cols-2 gap-5 sm:grid-cols-4">
          {[
            { label: 'Current Month Accrual', value: totals.earnedThisMonth },
            { label: 'Total used', value: totals.totalUsed, valueClassName: 'text-red-600' },
          ].map(({ label, value, valueClassName = 'text-slate-900' }) => (
            <div key={label} className="rounded-xl border border-slate-200 bg-white px-5 py-4 shadow-sm hover:shadow-md transition-shadow">
              <dt className="text-xs font-medium text-slate-500 mb-2">{label}</dt>
              <dd className={`text-2xl font-bold ${valueClassName}`}>{fmtDays(value)} <span className="text-sm font-normal text-slate-500">days</span></dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
};

const LeaveBalancesWidget = ({ employeeId }) => {
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth() + 1;
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewYear, setViewYear] = useState(currentYear);
  const [viewMonth, setViewMonth] = useState(currentMonth);

  const policyLeaveTypes = balance?.policy?.leaveTypes || [];

  const yearOptions = useMemo(() => {
    const years = [];
    for (let y = LEAVE_MIN_YEAR; y <= currentYear; y += 1) years.push(y);
    return years;
  }, [currentYear]);

  const monthOptions = useMemo(() => {
    if (viewYear === currentYear) {
      return MONTHS.filter((m) => m.value <= currentMonth);
    }
    return MONTHS;
  }, [viewYear, currentYear, currentMonth]);

  const displayBalances = useMemo(
    () => getDisplayLeaveBalances(balance, policyLeaveTypes),
    [balance, policyLeaveTypes]
  );

  useEffect(() => {
    if (!employeeId) return;
    let cancelled = false;

    const fetchBalance = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`/v1/admin/leave-policy/balance/${employeeId}`, {
          params: { year: viewYear, month: viewMonth },
        });
        if (!cancelled) setBalance(res.data?.balance || null);
      } catch {
        if (!cancelled) setBalance(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchBalance();

    const onUpdated = (event) => {
      if (event.detail?.employeeId === employeeId) fetchBalance();
    };
    window.addEventListener('leave-balance-updated', onUpdated);

    return () => {
      cancelled = true;
      window.removeEventListener('leave-balance-updated', onUpdated);
    };
  }, [employeeId, viewYear, viewMonth]);

  useEffect(() => {
    setViewYear(currentYear);
    setViewMonth(currentMonth);
  }, [employeeId, currentYear, currentMonth]);

  useEffect(() => {
    if (viewYear === currentYear && viewMonth > currentMonth) {
      setViewMonth(currentMonth);
    }
  }, [viewYear, viewMonth, currentYear, currentMonth]);

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <h3 className="shrink-0 text-base font-semibold text-slate-900">Leave balances</h3>
        <LeavePeriodDropdowns
          viewMonth={viewMonth}
          viewYear={viewYear}
          onMonthChange={setViewMonth}
          onYearChange={setViewYear}
          monthOptions={monthOptions}
          yearOptions={yearOptions}
        />
      </div>

      {loading ? (
        <div className="flex justify-center py-10">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#20C997]" />
        </div>
      ) : !balance ? (
        <p className="text-sm text-slate-500">No leave balance on file.</p>
      ) : (
        <>
          {balance.policy?.policyName && (
            <div className="mb-4 rounded-lg border border-[#20C997]/25 bg-[#20C997]/10 px-4 py-2.5 text-sm text-[#0d9488]">
              <span className="font-semibold">Policy:</span> {balance.policy.policyName}
            </div>
          )}

          {displayBalances.length > 0 ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayBalances.map((typeBalance) => (
                <LeaveBalanceCard
                  key={typeBalance.leaveType}
                  typeBalance={typeBalance}
                  policyLeaveTypes={policyLeaveTypes}
                />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-500">No leave types configured for this policy.</p>
          )}
        </>
      )}
    </div>
  );
};

export default LeaveBalancesWidget;
