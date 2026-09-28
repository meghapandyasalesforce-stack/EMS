/** Shared leave type metadata (matches policy model enum) */
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
];

/** Predefined leave application reasons */
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

export const DEFAULT_MONTHLY_ALLOCATION = 1.5;
export const DEFAULT_ANNUAL_ENTITLEMENT = 18;
/** Default 31 = credit join month for any join day (legacy behavior). */
export const DEFAULT_JOIN_ACCRUAL_CUTOFF_DAY = 31;

export const DEFAULT_LEAVE_CYCLE = {
    startMonth: 1,
    endMonth: 12,
    joinAccrualCutoffDay: DEFAULT_JOIN_ACCRUAL_CUTOFF_DAY,
};
