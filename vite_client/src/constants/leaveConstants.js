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

export const GENERIC_LEAVE_LABEL = 'Leave';

export const PRIMARY_LEAVE_TYPES = ['casual', 'paid', 'annual', 'vacation'];

/** Default leave type when the UI hides type selection. */
export const DEFAULT_LEAVE_TYPE = 'casual';

export const DEFAULT_MONTHLY_LEAVE_DAYS = 1.5;
export const DEFAULT_YEARLY_LEAVE_DAYS = 18;

/** Display accrual rate: 1.5/month for standard leave; LOP uses policy rate. */
export const getDisplayMonthlyAccrualRate = (leaveType, policyType, balanceMonthlyRate) => {
  if (leaveType === 'loss_of_pay') {
    return (
      Number(policyType?.maxDaysPerMonth) ||
      Number(policyType?.accrual?.amount) ||
      Number(balanceMonthlyRate) ||
      0
    );
  }
  return DEFAULT_MONTHLY_LEAVE_DAYS;
};

/** User-facing label — generic "Leave", not sick/casual/etc. */
export const getLeaveDisplayLabel = () => GENERIC_LEAVE_LABEL;

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

/** Master list of leave types (matches server policy enum). */
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

/** All leave types for dropdowns — policy names override defaults; extra policy types included. */
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

/** Resolve display name from policy config or fallback labels. */
export const getLeaveTypeDisplayName = (leaveType, policyLeaveTypes = []) => {
  if (!leaveType) return GENERIC_LEAVE_LABEL;
  const fromPolicy = policyLeaveTypes?.find((lt) => lt.type === leaveType);
  if (fromPolicy?.displayName) return fromPolicy.displayName;
  return LEAVE_TYPE_LABELS[leaveType] || leaveType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
};

/** Pick the main leave balance row (casual/paid first, else first type). */
export const pickPrimaryLeaveBalance = (balances = []) => {
  if (!Array.isArray(balances) || balances.length === 0) return null;
  const primary = balances.find((b) => PRIMARY_LEAVE_TYPES.includes(b.leaveType));
  return primary || balances[0];
};

/** Total Available Leave — shared pool (not a sum of per-type cards). */
export const getTotalAvailableLeave = (balance) => {
  const summary = getLeaveSummary(balance);
  return summary.totalAvailableLeave;
};

/** Employee leave wallet — canonical summary for all UI totals. */
export const getLeaveSummary = (balance) => {
  const fromApi = balance?.leaveSummary;
  if (fromApi && typeof fromApi === 'object') {
    return {
      totalAvailableLeave: Number(fromApi.totalAvailableLeave) || 0,
      totalAccrued: Number(fromApi.totalAccrued) || 0,
      totalUsed: Number(fromApi.totalUsed) || 0,
      totalCarriedForward: Number(fromApi.totalCarriedForward) || 0,
      totalPending: Number(fromApi.totalPending) || 0,
      earnedThisMonth: Number(fromApi.earnedThisMonth) || 0,
    };
  }

  const primary = pickPrimaryLeaveBalance(balance?.balances || []);
  return {
    totalAvailableLeave: Number(primary?.availableDays ?? primary?.available) || 0,
    totalAccrued: Number((primary?.accrued || 0) + (primary?.carriedForward || 0)),
    totalUsed: Number(primary?.usedDays ?? primary?.used) || 0,
    totalCarriedForward: Number(primary?.carriedForward) || 0,
    totalPending: Number(primary?.pending) || 0,
    earnedThisMonth: 0,
  };
};
