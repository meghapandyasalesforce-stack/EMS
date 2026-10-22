import React, { useEffect, useMemo, useState } from 'react';
import {
  FiCalendar,
  FiClipboard,
  FiHeart,
  FiLayers,
  FiPlus,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import { HiOutlineCurrencyRupee } from 'react-icons/hi2';
import axios from '../../../../utils/axios';
import {
  getLeaveTypeDisplayName,
  getPolicyMonthlyAccrualForType,
  getTakeableDaysThisMonth,
  LEAVE_UI,
  monthlyEarnsLabel,
} from '../../../../constants/leaveConstants';

const leaveTypeIcon = (leaveType = '') => {
  const key = String(leaveType).toLowerCase();
  if (key.includes('sick') || key.includes('medical')) return FiHeart;
  if (key.includes('casual')) return FiCalendar;
  if (key.includes('paid') || key.includes('earned') || key.includes('privilege')) return FiUser;
  return FiLayers;
};

const SUMMARY_KPI_ICONS = {
  [LEAVE_UI.yearlyLimitAll]: FiCalendar,
  [LEAVE_UI.addedThisMonth]: FiPlus,
  [LEAVE_UI.hrAdjustment]: FiRefreshCw,
  [LEAVE_UI.totalUsed]: FiClipboard,
  [LEAVE_UI.totalBalance]: HiOutlineCurrencyRupee,
};

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
  'min-w-[7.5rem] rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 shadow-sm focus:border-[#0E9370] focus:outline-none focus:ring-2 focus:ring-[#0E9370]/20';

const BalanceMetricValue = ({
  value,
  prefix = '',
  valueClassName = 'text-slate-900',
  daysClassName = 'text-slate-500',
  compact = false,
}) => (
  <dd className="text-right leading-none">
    <span className={`block font-semibold ${compact ? 'text-sm' : 'text-xl'} ${valueClassName}`}>
      {prefix}
      {fmtDays(value)}
    </span>
    <span className={`block font-normal ${compact ? 'mt-0.5 text-[10px]' : 'mt-1 text-xs'} ${daysClassName}`}>
      days
    </span>
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
  <div className={`ml-auto flex shrink-0 flex-row flex-wrap items-center gap-2 ${className}`.trim()}>
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

export const LeaveBalanceCard = ({
  typeBalance,
  policyLeaveTypes,
  className = '',
  compact = false,
}) => {
  const policyType = policyLeaveTypes.find((lt) => lt.type === typeBalance.leaveType);
  const displayName =
    typeBalance.leaveTypeDisplayName ||
    policyType?.displayName ||
    getLeaveTypeDisplayName(typeBalance.leaveType, policyLeaveTypes);
  const used = Number(typeBalance.usedDays ?? typeBalance.used ?? 0);
  const available = Number(typeBalance.availableDays ?? typeBalance.available ?? 0);
  const carriedForward = Number(typeBalance.carriedDays ?? typeBalance.carriedForward ?? 0);
  const pending = Number(typeBalance.pendingDays ?? typeBalance.pending ?? 0);
  const annualEntitlement = Number(typeBalance.annualEntitlement ?? policyType?.accrual?.maxAccrual ?? 0);
  const monthlyAccrual = Number(
    typeBalance.monthlyRate ??
      getPolicyMonthlyAccrualForType(policyType) ??
      policyType?.accrual?.amount ??
      0
  );
  const currentMonthAccrual = Number(
    typeBalance.currentMonthAccrual ?? typeBalance.earnedThisMonth ?? monthlyAccrual
  );
  const manualAdjustment = Number(typeBalance.manualAdjustment ?? typeBalance.manualStock ?? 0);
  const takeable = getTakeableDaysThisMonth(typeBalance);
  const frozen =
    typeBalance.probationFrozenBalance != null
      ? Number(typeBalance.probationFrozenBalance)
      : null;
  const probationAccrualActive = Boolean(typeBalance.probationAccrualActive);
  const leaveBlocked =
    probationAccrualActive && typeBalance.allowLeaveDuringProbation === false;
  if (compact) {
    const TypeIcon = leaveTypeIcon(typeBalance.leaveType);
    const entitlementLabel =
      annualEntitlement > 0
        ? `of ${fmtDays(annualEntitlement)} days available`
        : 'days available';

    return (
      <div className={`leave-balance-card ${className}`.trim()}>
        <div className="leave-card-title">
          <span className="leave-card-icon" aria-hidden="true">
            <TypeIcon />
          </span>
          <h3>
            {displayName}
            {probationAccrualActive ? (
              <span className="leave-balance-card__tag">Probation</span>
            ) : null}
          </h3>
        </div>

        {(typeBalance.probationNote || leaveBlocked) && (
          <p className="leave-balance-card__note">
            {typeBalance.probationNote ||
              'On probation — you cannot apply this leave until confirmation.'}
          </p>
        )}

        <p className="leave-days">
          {fmtDays(available)}
          <span> days</span>
        </p>
        <p className="leave-description">{entitlementLabel}</p>

        <div className="leave-usage">
          <div>
            <div className="label">Available</div>
            <div className="value">
              {fmtDays(available)} <span>days</span>
            </div>
          </div>
          <div>
            <div className="label">Used</div>
            <div className="value">
              {fmtDays(used)} <span>days</span>
            </div>
          </div>
        </div>

        <div className="leave-accrual">
          <span className="leave-accrual-label">
            <HiOutlineCurrencyRupee aria-hidden="true" />
            {monthlyEarnsLabel(probationAccrualActive)}
          </span>
          <strong>
            {fmtDays(monthlyAccrual)} <span>days</span>
          </strong>
        </div>

        {(carriedForward !== 0 ||
          (frozen != null && frozen > 0) ||
          pending > 0 ||
          manualAdjustment !== 0 ||
          currentMonthAccrual !== 0) && (
          <dl className="leave-balance-card__extra">
            {currentMonthAccrual !== 0 ? (
              <div>
                <dt>{LEAVE_UI.addedThisMonth}</dt>
                <dd>
                  {currentMonthAccrual > 0 ? '+' : ''}
                  {fmtDays(currentMonthAccrual)}
                </dd>
              </div>
            ) : null}
            {carriedForward !== 0 ? (
              <div>
                <dt>{LEAVE_UI.savedFromEarlier}</dt>
                <dd>{fmtDays(carriedForward)}</dd>
              </div>
            ) : null}
            {frozen != null && frozen > 0 ? (
              <div>
                <dt>{LEAVE_UI.lockedUntilConfirmation}</dt>
                <dd>{fmtDays(frozen)}</dd>
              </div>
            ) : null}
            {pending > 0 ? (
              <div>
                <dt>{LEAVE_UI.pending}</dt>
                <dd>{fmtDays(pending)}</dd>
              </div>
            ) : null}
            {manualAdjustment !== 0 ? (
              <div>
                <dt>{LEAVE_UI.hrAdjustment}</dt>
                <dd>
                  {manualAdjustment > 0 ? '+' : ''}
                  {fmtDays(manualAdjustment)}
                </dd>
              </div>
            ) : null}
          </dl>
        )}
      </div>
    );
  }

  return (
    <div className={`rounded-xl border border-slate-100 bg-white p-4 shadow-sm ${className}`}>
      <h4 className="text-base font-semibold text-slate-900">
        {displayName}
        {probationAccrualActive ? (
          <span className="ml-1.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-800">
            Probation
          </span>
        ) : null}
      </h4>

      {(typeBalance.probationNote || leaveBlocked) && (
        <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[11px] text-amber-900">
          {typeBalance.probationNote ||
            'On probation — you cannot apply this leave until confirmation.'}
        </p>
      )}

      <dl className="mt-4 space-y-3 text-sm">
        <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
          <dt>{LEAVE_UI.yearlyLimit}</dt>
          <dd className="font-medium text-slate-700">{fmtDays(annualEntitlement)} days</dd>
        </div>
        <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
          <dt>{monthlyEarnsLabel(probationAccrualActive)}</dt>
          <dd className="font-medium text-slate-700">{fmtDays(monthlyAccrual)} days</dd>
        </div>
        <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
          <dt>{LEAVE_UI.addedThisMonth}</dt>
          <dd className="font-medium text-[#0d9488]">
            {currentMonthAccrual > 0 ? `+${fmtDays(currentMonthAccrual)}` : fmtDays(currentMonthAccrual)} days
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="font-semibold text-slate-800">{LEAVE_UI.youCanTakeThisMonth}:</dt>
          <BalanceMetricValue
            value={takeable}
            valueClassName="text-xl font-bold text-[#0d9488]"
            daysClassName="text-[#0d9488]"
          />
        </div>
        {frozen != null && frozen > 0 ? (
          <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
            <dt>{LEAVE_UI.lockedUntilConfirmation}</dt>
            <dd className="font-medium text-slate-700">{fmtDays(frozen)} days</dd>
          </div>
        ) : null}
        <div className="flex items-start justify-between gap-3 text-xs text-slate-500">
          <dt>{LEAVE_UI.totalBalance}</dt>
          <dd className="font-medium text-slate-700">{fmtDays(available)} days</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-600">{LEAVE_UI.used}:</dt>
          <BalanceMetricValue
            value={used}
            prefix="-"
            valueClassName="text-red-500"
            daysClassName="text-red-500"
          />
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="text-slate-600">{LEAVE_UI.savedFromEarlier}:</dt>
          <BalanceMetricValue value={carriedForward} />
        </div>
        {pending > 0 && (
          <div className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3">
            <dt className="text-slate-600">{LEAVE_UI.pending}:</dt>
            <BalanceMetricValue value={pending} />
          </div>
        )}
        {manualAdjustment !== 0 && (
          <div className="flex items-start justify-between gap-3 border-t border-slate-100 pt-3">
            <dt className="text-slate-600">{LEAVE_UI.hrAdjustment}:</dt>
            <BalanceMetricValue
              value={manualAdjustment}
              prefix={manualAdjustment > 0 ? '+' : ''}
              valueClassName={manualAdjustment > 0 ? 'text-[#0d9488]' : 'text-rose-600'}
            />
          </div>
        )}
      </dl>
    </div>
  );
};

export const EmployeeLeaveSummaryPanel = ({
  summary,
  loading,
  subtitle,
  className = '',
  compact = false,
}) => {
  const totals = summary || {
    totalAvailableLeave: 0,
    totalTakeableThisMonth: null,
    totalAnnualEntitlement: 0,
    totalAccrued: 0,
    totalUsed: 0,
    totalCarriedForward: 0,
    totalPending: 0,
    earnedThisMonth: 0,
    manualAdjustment: 0,
    noCarryProbation: false,
    inProbation: false,
    probationNote: null,
  };

  const formatSignedDays = (value) => {
    const n = Number(value) || 0;
    const abs = fmtDays(Math.abs(n));
    if (n > 0) return `+${abs}`;
    if (n < 0) return `−${abs}`;
    return abs;
  };

  const manualAdjustment = Number(totals.manualAdjustment) || 0;
  const earnedThisMonth = Number(totals.earnedThisMonth) || 0;
  const takeable =
    totals.totalTakeableThisMonth != null
      ? Number(totals.totalTakeableThisMonth)
      : Number(totals.totalAvailableLeave) || 0;
  // Only use “take this month” when probation / no-carry rules make monthly takeable the primary figure
  const useTakeableHeadline =
    Boolean(totals.noCarryProbation) || Boolean(totals.inProbation);

  const kpiTiles = [
    {
      label: LEAVE_UI.yearlyLimitAll,
      display: fmtDays(totals.totalAnnualEntitlement),
      valueClassName: 'text-slate-900',
    },
    {
      label: LEAVE_UI.addedThisMonth,
      display: formatSignedDays(earnedThisMonth),
      valueClassName: earnedThisMonth > 0 ? 'text-[#0d9488]' : 'text-slate-900',
    },
    {
      label: LEAVE_UI.hrAdjustment,
      display: formatSignedDays(manualAdjustment),
      valueClassName:
        manualAdjustment > 0
          ? 'text-[#0d9488]'
          : manualAdjustment < 0
            ? 'text-rose-600'
            : 'text-slate-900',
    },
    {
      label: LEAVE_UI.totalUsed,
      display: fmtDays(totals.totalUsed),
      valueClassName: 'text-red-600',
    },
    {
      label: LEAVE_UI.totalBalance,
      display: fmtDays(totals.totalAvailableLeave),
      valueClassName: 'text-slate-900',
    },
  ];

  const headline = loading
    ? '…'
    : useTakeableHeadline
      ? `${fmtDays(takeable)} days you can take this month`
      : `${fmtDays(totals.totalAvailableLeave)} days available this year`;

  return (
    <div
      className={`employee-leave-summary overflow-hidden rounded-2xl border border-[#0E9370]/20 bg-gradient-to-br from-[#0E9370]/10 via-white to-[#F0FDF4] shadow-md ${
        compact ? '' : 'p-6'
      } ${className}`.trim()}
    >
      <p className="employee-leave-summary__eyebrow">Employee leave summary</p>
      <h2 className={`font-bold text-slate-900 ${compact ? '' : 'mt-2 text-3xl'}`}>{headline}</h2>
      {!loading && subtitle ? <p className="employee-leave-summary__subtitle">{subtitle}</p> : null}
      {!loading && (totals.probationNote || totals.inProbation) && (
        <p
          className={`rounded-lg border border-amber-200 bg-amber-50 text-amber-900 ${
            compact ? 'mt-1 px-2 py-1 text-[11px]' : 'mt-2 px-3 py-2 text-xs'
          }`}
        >
          {totals.probationNote || LEAVE_UI.probationBanner}
        </p>
      )}
      {!loading && (
        <div className="leave-summary-stats">
          {kpiTiles.map(({ label, display, valueClassName = 'text-slate-900' }) => {
            const Icon = SUMMARY_KPI_ICONS[label] || FiLayers;
            return (
              <div key={label} className="leave-summary-stat">
                <span className="stat-icon" aria-hidden="true">
                  <Icon />
                </span>
                <div className="stat-body">
                  <div className="stat-label">{label}</div>
                  <div className={`stat-value ${valueClassName}`}>
                    {display}
                    <span> days</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-transparent border-t-[#0E9370]" />
        </div>
      ) : !balance ? (
        <p className="text-sm text-slate-500">No leave balance on file.</p>
      ) : (
        <>
          {balance.policy?.policyName && (
            <div className="mb-4 rounded-lg border border-[#0E9370]/25 bg-[#0E9370]/10 px-4 py-2.5 text-sm text-[#0d9488]">
              <span className="font-semibold">Policy:</span> {balance.policy.policyName}
            </div>
          )}

          {displayBalances.length > 0 ? (
            <div className="grid w-full grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayBalances.map((typeBalance) => (
                <LeaveBalanceCard
                  key={typeBalance.leaveType}
                  typeBalance={typeBalance}
                  policyLeaveTypes={policyLeaveTypes}
                  className="h-full min-w-0"
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
