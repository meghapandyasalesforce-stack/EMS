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

export const getLeaveTypeDisplayName = (leaveType, policyLeaveTypes = []) => {
  if (!leaveType) return 'Leave';
  const fromPolicy = policyLeaveTypes?.find((lt) => lt.type === leaveType);
  if (fromPolicy?.displayName) return fromPolicy.displayName;
  return LEAVE_TYPE_LABELS[leaveType] || leaveType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
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

/** One card per enabled leave type — driven by policy + balance rows. */
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
    const annualEntitlement = Number(policyType.accrual?.maxAccrual) || 0;
    const monthlyAccrual = usesPolicyMonthlyAccrual(policyType)
      ? getPolicyMonthlyAccrualForType(policyType)
      : 0;
    const currentMonthAccrual = fmtLeaveStatDays(
      Number(row.earnedThisMonth ?? row.currentMonthAccrual) ||
        (usesPolicyMonthlyAccrual(policyType) ? monthlyAccrual : 0)
    );
    const available = Number(row.availableDays ?? row.available) || 0;
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
      chartTotal: fmtLeaveStatDays(annualEntitlement),
    };
  });
};

/** Employee leave summary — sums across all enabled leave types from active policy. */
export const getLeaveSummary = (balance) => {
  const policy = balance?.policy;
  const policyAnnual = sumPolicyAnnualEntitlement(policy);
  const policyMonthly = sumPolicyMonthlyAccrual(policy);
  const viewPeriod = balance?.viewPeriod;
  const joiningDate = balance?.employeeContext?.joiningDate
    ? new Date(balance.employeeContext.joiningDate)
    : null;
  const policyEarnedThisMonth =
    viewPeriod && joiningDate && !Number.isNaN(joiningDate.getTime())
      ? (() => {
          const joinKey = joiningDate.getFullYear() * 12 + joiningDate.getMonth();
          const viewKey = viewPeriod.year * 12 + (viewPeriod.month - 1);
          return viewKey >= joinKey ? policyMonthly : 0;
        })()
      : policyMonthly;

  const rowEarnedThisMonth = fmtLeaveStatDays(
    (balance?.balances || []).reduce((sum, row) => sum + (Number(row.earnedThisMonth ?? row.currentMonthAccrual) || 0), 0)
  );

  const resolveEarnedThisMonth = (fromApiValue) => {
    const policyVal = fmtLeaveStatDays(policyEarnedThisMonth);
    if (policyVal > 0) return policyVal;
    const apiVal = fmtLeaveStatDays(fromApiValue);
    if (apiVal > 0) return apiVal;
    if (rowEarnedThisMonth > 0) return rowEarnedThisMonth;
    return 0;
  };

  const fromApi = balance?.leaveSummary;
  if (fromApi && typeof fromApi === 'object') {
    return {
      totalAvailableLeave: fmtLeaveStatDays(fromApi.totalAvailableLeave),
      totalAnnualEntitlement: policy?.leaveTypes?.length
        ? policyAnnual
        : fmtLeaveStatDays(fromApi.totalAnnualEntitlement),
      totalMonthlyAccrual: policy?.leaveTypes?.length
        ? policyMonthly
        : fmtLeaveStatDays(fromApi.totalMonthlyAccrual),
      totalAccrued: fmtLeaveStatDays(fromApi.totalAccrued),
      totalUsed: fmtLeaveStatDays(fromApi.totalUsed),
      totalCarriedForward: fmtLeaveStatDays(fromApi.totalCarriedForward),
      totalPending: fmtLeaveStatDays(fromApi.totalPending),
      earnedThisMonth: resolveEarnedThisMonth(fromApi.earnedThisMonth ?? fromApi.perTypeCurrentMonthAccrual),
      manualAdjustment: fmtLeaveStatDays(fromApi.perTypeManualAdjustment ?? fromApi.manualAdjustment),
      legacyGlobalAdjustment: fmtLeaveStatDays(fromApi.legacyGlobalAdjustment),
    };
  }

  const enabledTypes = getEnabledPolicyLeaveTypes(policy);
  const rows = (balance?.balances || []).filter((b) =>
    enabledTypes.some((lt) => lt.type === b.leaveType)
  );

  return {
    totalAvailableLeave: fmtLeaveStatDays(
      rows.reduce((sum, row) => sum + (Number(row.availableDays ?? row.available) || 0), 0)
    ),
    totalAnnualEntitlement: policyAnnual,
    totalMonthlyAccrual: policyMonthly,
    totalAccrued: fmtLeaveStatDays(rows.reduce((sum, row) => sum + (Number(row.accrued) || 0), 0)),
    totalUsed: fmtLeaveStatDays(rows.reduce((sum, row) => sum + (Number(row.usedDays ?? row.used) || 0), 0)),
    totalCarriedForward: fmtLeaveStatDays(
      rows.reduce((sum, row) => sum + (Number(row.carriedDays ?? row.carriedForward) || 0), 0)
    ),
    totalPending: fmtLeaveStatDays(rows.reduce((sum, row) => sum + (Number(row.pending) || 0), 0)),
    earnedThisMonth: resolveEarnedThisMonth(balance?.leaveSummary?.earnedThisMonth),
    manualAdjustment: 0,
    legacyGlobalAdjustment: fmtLeaveStatDays(balance?.legacyGlobalAdjustment?.amount),
  };
};

export const getTotalAvailableLeave = (balance) => getLeaveSummary(balance).totalAvailableLeave;

export const resolvePolicyAnnualEntitlement = (balance) => {
  if (!balance) return 0;
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
  const fromPolicy = sumPolicyMonthlyAccrual(balance.policy);
  if (balance.policy?.leaveTypes?.length) return fromPolicy;
  const fromSummary = Number(balance.leaveSummary?.totalMonthlyAccrual);
  if (fromSummary > 0) return fmtLeaveStatDays(fromSummary);
  const fromTotals = Number(balance.policyTotals?.monthlyAccrual);
  if (fromTotals > 0) return fmtLeaveStatDays(fromTotals);
  return fromPolicy;
};

/** Statistics — policy-driven totals; chart uses available / total annual entitlement. */
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
