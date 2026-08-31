import { toSentenceCase } from '../utils/textFormat.js';

export const LEAVE_REASON_OPTIONS = [
  'Personal Work',
  'Family Function',
  'Marriage',
  'Vacation',
  'Medical Checkup',
  'Fever',
  'Hospitalization',
  'Child Care',
  'Pregnancy',
  'Newborn Care',
  'Emergency',
  'Religious Event',
  'Examination',
  'Training',
  'Mental Wellness',
  'Compensatory Leave',
];

export const LEAVE_TYPE_LABELS = {
  casual: 'Casual Leave',
  paid: 'Paid Leave',
  sick: 'Sick Leave',
  maternity: 'Maternity Leave',
  paternity: 'Paternity Leave',
  vacation: 'Vacation Leave',
  privileged: 'Privileged Leave',
  compensatory: 'Compensatory Leave',
  sabbatical: 'Sabbatical Leave',
  loss_of_pay: 'Loss of Pay',
  annual: 'Annual Leave',
};

/** Default when UI needs a fallback before policy loads — first enabled type preferred at runtime. */
export const DEFAULT_LEAVE_TYPE = 'casual';

export const LEAVE_TYPE_OPTIONS = [
  { value: 'casual', label: 'Casual Leave' },
  { value: 'paid', label: 'Paid Leave' },
  { value: 'sick', label: 'Sick Leave' },
  { value: 'maternity', label: 'Maternity Leave' },
  { value: 'paternity', label: 'Paternity Leave' },
  { value: 'vacation', label: 'Vacation Leave' },
  { value: 'privileged', label: 'Privileged Leave' },
  { value: 'compensatory', label: 'Compensatory Leave (Comp Off)' },
  { value: 'sabbatical', label: 'Sabbatical Leave' },
  { value: 'loss_of_pay', label: 'Loss of Pay (LOP)' },
  { value: 'annual', label: 'Annual Leave' },
];

const fmtLeaveStatDays = (value) => {
  const n = Number(value) || 0;
  return Math.round(n * 2) / 2;
};

/** Days the employee can actually apply this month (probation cap when carry-forward is off). */
export const getTakeableDaysThisMonth = (row = {}) => {
  if (
    row.probationAccrualActive &&
    row.allowLeaveDuringProbation === false
  ) {
    return 0;
  }
  if (row.appliableThisMonth != null && !Number.isNaN(Number(row.appliableThisMonth))) {
    return fmtLeaveStatDays(Number(row.appliableThisMonth));
  }
  if (row.remainingThisMonth != null && !Number.isNaN(Number(row.remainingThisMonth))) {
    return fmtLeaveStatDays(Number(row.remainingThisMonth));
  }
  return fmtLeaveStatDays(
    Number(row.availableBalance ?? row.availableDays ?? row.available) || 0
  );
};

export const sumTakeableDaysThisMonth = (rows = []) =>
  fmtLeaveStatDays(rows.reduce((sum, row) => sum + getTakeableDaysThisMonth(row), 0));

export const hasNoCarryProbationLeave = (rows = []) =>
  rows.some((row) => row?.probationAccrualActive && row?.carryForwardDuringProbation !== true);

/** Employee-facing leave copy — keep policy/admin forms technical if needed. */
export const LEAVE_UI = {
  yearlyLimit: 'Yearly limit',
  yearlyLimitAll: 'Yearly limit (all types)',
  earnsEachMonth: 'Earns each month',
  earnsEachMonthProbation: 'Earns each month (on probation)',
  addedThisMonth: 'Added this month',
  youCanTakeThisMonth: 'You can take this month',
  totalBalance: 'Total balance',
  used: 'Used',
  savedFromEarlier: 'Saved from earlier',
  lockedUntilConfirmation: 'Locked until confirmation',
  hrAdjustment: 'HR adjustment',
  pending: 'Pending',
  leaveThisMonth: 'Leave this month',
  daysRemaining: 'Days remaining',
  thisMonthLeave: 'Added this month',
  totalUsed: 'Total used',
  probationBanner:
    'On probation — leave follows probation rules until confirmation. Normal rules start from the 1st of the next month after confirmation.',
  noCarryFooter:
    'These numbers are what you can take this month. Unused days this month do not move to next month. Your old balance stays locked until confirmation.',
  takeableFooter: 'These numbers are what you can take this month.',
  lockedNotIncluded: 'Locked days are not included until confirmation.',
};

export const monthlyEarnsLabel = (onProbation) =>
  onProbation ? LEAVE_UI.earnsEachMonthProbation : LEAVE_UI.earnsEachMonth;

export const getLeaveTypeDisplayName = (leaveType, policyLeaveTypes = []) => {
  if (!leaveType) return 'Leave';
  const fromPolicy = policyLeaveTypes?.find((lt) => lt.type === leaveType);
  if (fromPolicy?.displayName) return fromPolicy.displayName;
  return LEAVE_TYPE_LABELS[leaveType] || toSentenceCase(leaveType.replace(/_/g, ' '));
};

export const getAllLeaveTypeOptions = (policyLeaveTypes = []) => {
  const options = new Map();
  LEAVE_TYPE_OPTIONS.forEach(({ value, label }) => {
    options.set(value, {
      value,
      label: getLeaveTypeDisplayName(value, policyLeaveTypes) || label,
    });
  });
  (policyLeaveTypes || []).forEach((lt) => {
    if (!lt?.type) return;
    options.set(lt.type, {
      value: lt.type,
      label: lt.displayName || getLeaveTypeDisplayName(lt.type, policyLeaveTypes),
    });
  });
  return Array.from(options.values());
};

export const getEnabledPolicyLeaveTypes = (policy) =>
  (policy?.leaveTypes || []).filter((lt) => lt?.type && lt.enabled !== false);

const usesPolicyMonthlyAccrual = (leaveType) => {
  if (!leaveType?.type || leaveType.enabled === false || leaveType.type === 'loss_of_pay') return false;
  const method = String(leaveType?.accrual?.method || 'fixed').toLowerCase();
  const frequency = String(leaveType?.accrual?.frequency || 'yearly').toLowerCase();
  return method === 'monthly' || method === 'fixed' || frequency === 'monthly';
};

export const sumPolicyAnnualEntitlement = (policy) =>
  fmtLeaveStatDays(
    getEnabledPolicyLeaveTypes(policy).reduce(
      (sum, lt) => sum + (Number(lt?.accrual?.maxAccrual) || 0),
      0
    )
  );

export const getPolicyMonthlyAccrualForType = (leaveType) => {
  if (!leaveType?.type || leaveType.enabled === false || leaveType.type === 'loss_of_pay') return 0;
  const amount = Number(leaveType?.accrual?.amount);
  if (Number.isFinite(amount) && amount > 0) return amount;
  const maxDays = Number(leaveType?.maxDaysPerMonth);
  if (Number.isFinite(maxDays) && maxDays > 0) return maxDays;
  const annual = Number(leaveType?.accrual?.maxAccrual) || 0;
  if (annual > 0 && usesPolicyMonthlyAccrual(leaveType)) {
    return fmtLeaveStatDays(annual / 12);
  }
  return 0;
};

export const sumPolicyMonthlyAccrual = (policy) =>
  fmtLeaveStatDays(
    getEnabledPolicyLeaveTypes(policy).reduce(
      (sum, lt) => sum + getPolicyMonthlyAccrualForType(lt),
      0
    )
  );

/** One card per enabled leave type — driven by policy + balance rows (probation-aware from API). */
export const getLeaveTypeCards = (balance) => {
  if (!balance) return [];
  const policyTypes = getEnabledPolicyLeaveTypes(balance.policy);
  const rows = balance.balances || [];

  return policyTypes.map((policyType) => {
    const row =
      rows.find((b) => b.leaveType === policyType.type) || {
        leaveType: policyType.type,
        available: 0,
        used: 0,
        pending: 0,
        carriedForward: 0,
        manualAdjustment: 0,
      };
    const policyAnnual = Number(policyType.accrual?.maxAccrual) || 0;
    const policyMonthly = usesPolicyMonthlyAccrual(policyType)
      ? getPolicyMonthlyAccrualForType(policyType)
      : 0;
    // Prefer API row values (probation overlay) when present
    const annualEntitlement =
      row.annualEntitlement != null && !Number.isNaN(Number(row.annualEntitlement))
        ? Number(row.annualEntitlement)
        : policyAnnual;
    const monthlyAccrual =
      row.monthlyRate != null && !Number.isNaN(Number(row.monthlyRate))
        ? Number(row.monthlyRate)
        : policyMonthly;
    const currentMonthAccrual = fmtLeaveStatDays(
      Number(row.earnedThisMonth ?? row.currentMonthAccrual) ||
        (row.monthlyRate != null ? Number(row.monthlyRate) : policyMonthly)
    );
    const available = Number(row.availableDays ?? row.available) || 0;
    const inProbation = Boolean(row.inProbation || balance.probation?.inProbation);
    const probationAccrualActive = Boolean(row.probationAccrualActive);
    return {
      leaveType: policyType.type,
      displayName:
        row.leaveTypeDisplayName ||
        policyType.displayName ||
        getLeaveTypeDisplayName(policyType.type, balance.policy?.leaveTypes),
      annualEntitlement: fmtLeaveStatDays(annualEntitlement),
      monthlyAccrual: fmtLeaveStatDays(monthlyAccrual),
      currentMonthAccrual,
      available: fmtLeaveStatDays(available),
      used: fmtLeaveStatDays(Number(row.usedDays ?? row.used) || 0),
      pending: fmtLeaveStatDays(Number(row.pendingDays ?? row.pending) || 0),
      carriedForward: fmtLeaveStatDays(Number(row.carriedDays ?? row.carriedForward) || 0),
      manualAdjustment: fmtLeaveStatDays(Number(row.manualAdjustment) || 0),
      chartTotal: fmtLeaveStatDays(annualEntitlement > 0 ? annualEntitlement : policyAnnual || 1),
      inProbation,
      probationAccrualActive,
      carryForwardDuringProbation: row.carryForwardDuringProbation === true,
      allowLeaveDuringProbation: row.allowLeaveDuringProbation !== false,
      appliableThisMonth:
        row.appliableThisMonth != null ? fmtLeaveStatDays(Number(row.appliableThisMonth)) : null,
      takeableThisMonth: getTakeableDaysThisMonth({
        ...row,
        available,
        appliableThisMonth: row.appliableThisMonth,
        allowLeaveDuringProbation: row.allowLeaveDuringProbation,
      }),
      probationFrozenBalance:
        row.probationFrozenBalance != null
          ? fmtLeaveStatDays(Number(row.probationFrozenBalance))
          : null,
      probationNote: row.probationNote || balance.probation?.note || null,
      normalMonthlyAccrual: fmtLeaveStatDays(
        row.normalMonthlyRate != null ? Number(row.normalMonthlyRate) : policyMonthly
      ),
    };
  });
};

/** Employee leave summary — sums across leave types; prefers API/row probation-aware rates. */
export const getLeaveSummary = (balance) => {
  const policy = balance?.policy;
  const allRows = balance?.balances || [];
  const policyAnnual = sumPolicyAnnualEntitlement(policy);
  const policyMonthly = sumPolicyMonthlyAccrual(policy);
  const rowMonthly = fmtLeaveStatDays(
    allRows.reduce((sum, row) => sum + (Number(row.monthlyRate) || 0), 0)
  );
  const rowAnnual = fmtLeaveStatDays(
    allRows.reduce((sum, row) => sum + (Number(row.annualEntitlement) || 0), 0)
  );
  const hasRowRates = allRows.some((r) => r.monthlyRate != null || r.annualEntitlement != null);
  const viewPeriod = balance?.viewPeriod;
  const joiningDate = balance?.employeeContext?.joiningDate
    ? new Date(balance.employeeContext.joiningDate)
    : null;
  const employedThisMonth =
    viewPeriod && joiningDate && !Number.isNaN(joiningDate.getTime())
      ? (() => {
          const joinKey = joiningDate.getFullYear() * 12 + joiningDate.getMonth();
          const viewKey = viewPeriod.year * 12 + (viewPeriod.month - 1);
          return viewKey >= joinKey;
        })()
      : true;

  const rowEarnedThisMonth = fmtLeaveStatDays(
    allRows.reduce((sum, row) => sum + (Number(row.earnedThisMonth ?? row.currentMonthAccrual) || 0), 0)
  );

  const resolveEarnedThisMonth = (fromApiValue) => {
    // Prefer per-type / leaveSummary values (probation-aware) over raw policy monthly sum
    if (hasRowRates || allRows.some((r) => r.earnedThisMonth != null || r.probationAccrualActive)) {
      return employedThisMonth ? rowEarnedThisMonth : 0;
    }
    const apiVal = fmtLeaveStatDays(fromApiValue);
    if (fromApiValue != null && !Number.isNaN(apiVal)) {
      return employedThisMonth ? apiVal : 0;
    }
    return employedThisMonth ? fmtLeaveStatDays(policyMonthly) : 0;
  };

  const inProbation = Boolean(
    balance?.probation?.inProbation ||
      balance?.employeeContext?.inProbation ||
      allRows.some((r) => r.inProbation)
  );
  const probationNote = balance?.probation?.note || null;
  const totalTakeableThisMonth = sumTakeableDaysThisMonth(allRows);
  const noCarryProbation = hasNoCarryProbationLeave(allRows);

  const fromApi = balance?.leaveSummary;
  if (fromApi && typeof fromApi === 'object') {
    return {
      totalAvailableLeave: fmtLeaveStatDays(fromApi.totalAvailableLeave),
      totalTakeableThisMonth,
      noCarryProbation,
      totalAnnualEntitlement: hasRowRates
        ? rowAnnual
        : policy?.leaveTypes?.length
          ? policyAnnual
          : fmtLeaveStatDays(fromApi.totalAnnualEntitlement),
      totalMonthlyAccrual: hasRowRates
        ? rowMonthly
        : policy?.leaveTypes?.length
          ? policyMonthly
          : fmtLeaveStatDays(fromApi.totalMonthlyAccrual),
      totalAccrued: fmtLeaveStatDays(fromApi.totalAccrued),
      totalUsed: fmtLeaveStatDays(fromApi.totalUsed),
      totalCarriedForward: fmtLeaveStatDays(fromApi.totalCarriedForward),
      totalPending: fmtLeaveStatDays(fromApi.totalPending),
      earnedThisMonth: resolveEarnedThisMonth(fromApi.earnedThisMonth ?? fromApi.perTypeCurrentMonthAccrual),
      manualAdjustment: fmtLeaveStatDays(fromApi.perTypeManualAdjustment ?? fromApi.manualAdjustment),
      legacyGlobalAdjustment: fmtLeaveStatDays(fromApi.legacyGlobalAdjustment),
      inProbation,
      probationNote,
    };
  }

  const enabledTypes = getEnabledPolicyLeaveTypes(policy);
  const rows = allRows.filter((b) =>
    enabledTypes.some((lt) => lt.type === b.leaveType)
  );

  return {
    totalAvailableLeave: fmtLeaveStatDays(
      rows.reduce((sum, row) => sum + (Number(row.availableDays ?? row.available) || 0), 0)
    ),
    totalTakeableThisMonth: sumTakeableDaysThisMonth(rows),
    noCarryProbation: hasNoCarryProbationLeave(rows),
    totalAnnualEntitlement: hasRowRates ? rowAnnual : policyAnnual,
    totalMonthlyAccrual: hasRowRates ? rowMonthly : policyMonthly,
    totalAccrued: fmtLeaveStatDays(rows.reduce((sum, row) => sum + (Number(row.accrued) || 0), 0)),
    totalUsed: fmtLeaveStatDays(rows.reduce((sum, row) => sum + (Number(row.usedDays ?? row.used) || 0), 0)),
    totalCarriedForward: fmtLeaveStatDays(
      rows.reduce((sum, row) => sum + (Number(row.carriedDays ?? row.carriedForward) || 0), 0)
    ),
    totalPending: fmtLeaveStatDays(rows.reduce((sum, row) => sum + (Number(row.pending) || 0), 0)),
    earnedThisMonth: resolveEarnedThisMonth(balance?.leaveSummary?.earnedThisMonth),
    manualAdjustment: 0,
    legacyGlobalAdjustment: fmtLeaveStatDays(balance?.legacyGlobalAdjustment?.amount),
    inProbation,
    probationNote,
  };
};

export const getTotalAvailableLeave = (balance) => getLeaveSummary(balance).totalAvailableLeave;

export const resolvePolicyAnnualEntitlement = (balance) => {
  if (!balance) return 0;
  const fromRows = (balance.balances || []).reduce(
    (sum, row) => sum + (Number(row.annualEntitlement) || 0),
    0
  );
  if ((balance.balances || []).some((r) => r.annualEntitlement != null)) {
    return fmtLeaveStatDays(fromRows);
  }
  const fromPolicy = sumPolicyAnnualEntitlement(balance.policy);
  if (balance.policy?.leaveTypes?.length) return fromPolicy;
  const fromSummary = Number(balance.leaveSummary?.totalAnnualEntitlement);
  if (fromSummary > 0) return fmtLeaveStatDays(fromSummary);
  const fromTotals = Number(balance.policyTotals?.annualEntitlement);
  if (fromTotals > 0) return fmtLeaveStatDays(fromTotals);
  const fromContext = Number(balance.employeeContext?.totalAnnualEntitlement);
  if (fromContext > 0) return fmtLeaveStatDays(fromContext);
  return fromPolicy;
};

export const resolvePolicyMonthlyAccrual = (balance) => {
  if (!balance) return 0;
  const fromRows = (balance.balances || []).reduce(
    (sum, row) => sum + (Number(row.monthlyRate) || 0),
    0
  );
  if ((balance.balances || []).some((r) => r.monthlyRate != null)) {
    return fmtLeaveStatDays(fromRows);
  }
  const fromPolicy = sumPolicyMonthlyAccrual(balance.policy);
  if (balance.policy?.leaveTypes?.length) return fromPolicy;
  const fromSummary = Number(balance.leaveSummary?.totalMonthlyAccrual);
  if (fromSummary > 0) return fmtLeaveStatDays(fromSummary);
  const fromTotals = Number(balance.policyTotals?.monthlyAccrual);
  if (fromTotals > 0) return fmtLeaveStatDays(fromTotals);
  const fromContext = Number(balance.employeeContext?.totalMonthlyAccrual);
  if (fromContext > 0) return fmtLeaveStatDays(fromContext);
  return fromPolicy;
};
  

/** Statistics — policy-driven totals; chart uses available / to        tal annual entitlement. */
export const getLeaveWidgetStats = (balance) => {
  if (!balance) return null;

  const summary = getLeaveSummary(balance);
  const annualQuota = resolvePolicyAnnualEntitlement(balance);
  const monthlyAccrual = resolvePolicyMonthlyAccrual(balance);
  const typeCards = getLeaveTypeCards(balance);

  return {
    annualQuota,
    monthlyAccrual,
    accrued: fmtLeaveStatDays(summary.totalAccrued),
    carriedForward: fmtLeaveStatDays(summary.totalCarriedForward),
    available: fmtLeaveStatDays(summary.totalAvailableLeave),
    takeableThisMonth: fmtLeaveStatDays(summary.totalTakeableThisMonth),
    noCarryProbation: Boolean(summary.noCarryProbation),
    used: fmtLeaveStatDays(summary.totalUsed),
    manualAdjustment: fmtLeaveStatDays(summary.manualAdjustment),
    earnedThisMonth: fmtLeaveStatDays(summary.earnedThisMonth),
    chartTotal: annualQuota,
    typeCards,
  };
};

/** @deprecated Generic label — prefer per-type display names from policy. */
export const getLeaveDisplayLabel = () => 'Leave';

/** First enabled leave type from policy (for backward-compatible single-type UIs). */
export const pickPrimaryLeaveBalance = (balances = [], policy) => {
  const enabled = getEnabledPolicyLeaveTypes(policy);
  if (enabled.length > 0) {
    return balances.find((b) => b.leaveType === enabled[0].type) || balances[0] || null;
  }
  return balances[0] || null;
};

/** True when leave is a single-calendar-day half-day request. */
export function isHalfDayLeaveRecord(leave) {
  if (!leave) return false;
  if (leave.isHalfDay === true) return true;
  return Number(leave.duration) === 0.5 && Boolean(leave.halfDayType);
}

/** Human-readable days column for leave history tables. */
export function formatLeaveDurationDisplay(leave) {
  const duration = Number(leave?.duration ?? leave?.days ?? 0);
  if (isHalfDayLeaveRecord(leave) || (leave?.isHalfDay && duration === 0.5)) {
    const half =
      leave?.halfDayType === 'second_half'
        ? '2nd half'
        : leave?.halfDayType === 'first_half'
          ? '1st half'
          : 'half day';
    return `0.5 (${half})`;
  }
  return duration;
}

/** For half-day rows, end date should match start (avoids misleading multi-day ranges). */
export function formatLeaveHistoryEndDate(leave, startIso, endIso) {
  if (isHalfDayLeaveRecord(leave) || leave?.isHalfDay) {
    return startIso;
  }
  return endIso;
}
