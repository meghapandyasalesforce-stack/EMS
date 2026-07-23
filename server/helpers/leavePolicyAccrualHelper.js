import { roundLeaveDays, getEffectiveJoiningDate, calendarMonthSortKey } from './leaveBalanceRulesHelper.js';
import { getEmployeeAppliableDaysThisMonth } from './leaveEmployeeTakeLimitHelper.js';

/**
 * Policy-driven leave accrual helpers — Leave Policy is the single source of truth.
 *
 * Field mapping (HR Leave Policy form):
 * - Annual Entitlement (Amount)     → accrual.maxAccrual
 * - Monthly Entitlement (days/mo)   → accrual.amount
 * - Max days taken per calendar mo  → maxDaysPerMonth (synced from monthly entitlement on save)
 */

export const MONTHS_PER_LEAVE_CYCLE = 12;

const FREQUENCY_PERIODS = {
    daily: 365,
    monthly: MONTHS_PER_LEAVE_CYCLE,
    quarterly: 4,
    yearly: 1,
    on_anniversary: 1,
};

export function toPlainLeaveTypeConfig(leaveType) {
    if (!leaveType || typeof leaveType !== 'object') {
        return leaveType;
    }
    if (typeof leaveType.toObject === 'function') {
        return leaveType.toObject();
    }
    return { ...leaveType };
}

export function roundDays(value) {
    return roundLeaveDays(value);
}

export function roundDaysForDisplay(value) {
    const n = Number(value) || 0;
    return Math.round(n * 2) / 2;
}

export function getLeaveCycleMonthCount(leaveCycle = {}) {
    const start = Number(leaveCycle?.startMonth);
    const end = Number(leaveCycle?.endMonth);
    if (Number.isInteger(start) && Number.isInteger(end) && start >= 1 && end >= 1) {
        if (start <= end) {
            return end - start + 1;
        }
        return 12 - start + 1 + end;
    }
    return MONTHS_PER_LEAVE_CYCLE;
}

export function getAccrualPeriodsPerYear(leaveTypeConfig, leaveCycle = {}) {
    if (usesMonthlyAccrual(leaveTypeConfig)) {
        return getLeaveCycleMonthCount(leaveCycle);
    }

    const frequency = String(
        leaveTypeConfig?.accrual?.frequency || leaveTypeConfig?.accrual?.method || 'monthly'
    ).toLowerCase();

    if (frequency === 'monthly') {
        return getLeaveCycleMonthCount(leaveCycle);
    }
    if (FREQUENCY_PERIODS[frequency] != null) {
        return FREQUENCY_PERIODS[frequency];
    }
    return MONTHS_PER_LEAVE_CYCLE;
}

/** Standard policy model: Fixed accrual with yearly annual cap + monthly entitlement. */
export function isFixedYearlyLeaveType(leaveTypeConfig) {
    const method = String(leaveTypeConfig?.accrual?.method || '').toLowerCase();
    const frequency = String(leaveTypeConfig?.accrual?.frequency || '').toLowerCase();
    return method === 'fixed' && frequency === 'yearly';
}

/** Annual entitlement — accrual.maxAccrual only (Amount field). Never derived from monthly. */
export function getAnnualEntitlementAmount(leaveTypeConfig) {
    const maxAccrual = Number(leaveTypeConfig?.accrual?.maxAccrual);
    if (Number.isFinite(maxAccrual) && maxAccrual >= 0) {
        return maxAccrual;
    }
    return 0;
}

/** Monthly accrual — accrual.amount, else maxDaysPerMonth, else annual÷12 when annual is set (legacy policies). */
export function getPolicyMonthlyAccrualAmount(leaveTypeConfig) {
    if (leaveTypeConfig?.enabled === false || leaveTypeConfig?.type === 'loss_of_pay') {
        return 0;
    }
    const amount = Number(leaveTypeConfig?.accrual?.amount);
    if (Number.isFinite(amount) && amount > 0) {
        return amount;
    }
    const maxDaysPerMonth = Number(leaveTypeConfig?.maxDaysPerMonth);
    if (Number.isFinite(maxDaysPerMonth) && maxDaysPerMonth > 0) {
        return maxDaysPerMonth;
    }
    const annual = getAnnualEntitlementAmount(leaveTypeConfig);
    if (annual > 0 && (usesMonthlyAccrual(leaveTypeConfig) || isFixedYearlyLeaveType(leaveTypeConfig))) {
        return roundDays(annual / MONTHS_PER_LEAVE_CYCLE);
    }
    return 0;
}

/** @deprecated alias */
export function getMonthlyEntitlementAmount(leaveTypeConfig) {
    const amount = getPolicyMonthlyAccrualAmount(leaveTypeConfig);
    return amount > 0 ? amount : null;
}

export function getRollingAccrualMonthlyRate(leaveTypeConfig) {
    if (!usesMonthlyAccrual(leaveTypeConfig)) {
        return 0;
    }
    return getPolicyMonthlyAccrualAmount(leaveTypeConfig);
}

export function getDisplayYearlyAccrualCap(leaveTypeConfig) {
    return getAnnualEntitlementAmount(leaveTypeConfig);
}

export function getYearlyAccrualCap(leaveTypeConfig) {
    return getAnnualEntitlementAmount(leaveTypeConfig);
}

export function hasMonthlyEntitlement(leaveTypeConfig) {
    return usesMonthlyAccrual(leaveTypeConfig) && getPolicyMonthlyAccrualAmount(leaveTypeConfig) > 0;
}

/** Monthly entitlement accrues when method is fixed/monthly or frequency is monthly. */
export function usesMonthlyAccrual(leaveTypeConfig) {
    if (leaveTypeConfig?.enabled === false || leaveTypeConfig?.type === 'loss_of_pay') {
        return false;
    }
    const method = String(leaveTypeConfig?.accrual?.method || 'fixed').toLowerCase();
    const frequency = String(leaveTypeConfig?.accrual?.frequency || 'yearly').toLowerCase();
    return method === 'monthly' || method === 'fixed' || frequency === 'monthly';
}

/** @deprecated */
export function usesMonthlyAllocation(leaveTypeConfig) {
    return usesMonthlyAccrual(leaveTypeConfig);
}

/**
 * Normalize leave type on save — preserve HR values; sync maxDaysPerMonth from monthly entitlement.
 */
export function normalizePolicyLeaveType(leaveType) {
    const plain = toPlainLeaveTypeConfig(leaveType);
    if (!plain || typeof plain !== 'object') {
        return plain;
    }

    const accrual = plain.accrual || {};
    const method = accrual.method || 'fixed';
    const frequency = accrual.frequency || 'yearly';
    const rawAmount = Number.isFinite(Number(accrual.amount)) ? Number(accrual.amount) : 0;
    const maxDaysFromField =
        plain.maxDaysPerMonth != null && Number(plain.maxDaysPerMonth) > 0
            ? Number(plain.maxDaysPerMonth)
            : 0;
    const maxAccrual = Number.isFinite(Number(accrual.maxAccrual)) ? Number(accrual.maxAccrual) : 0;
    let amount = rawAmount > 0 ? rawAmount : maxDaysFromField;
    if (
        amount <= 0 &&
        maxAccrual > 0 &&
        (method === 'fixed' || method === 'monthly' || frequency === 'monthly')
    ) {
        amount = roundDays(maxAccrual / MONTHS_PER_LEAVE_CYCLE);
    }

    const maxDaysPerMonth = amount > 0 ? amount : maxDaysFromField > 0 ? maxDaysFromField : undefined;

    return {
        ...plain,
        enabled: plain.enabled !== false,
        type: plain.type,
        displayName: plain.displayName || plain.type,
        accrual: {
            method,
            frequency,
            amount,
            maxAccrual,
            anniversaryBased: Boolean(accrual.anniversaryBased),
            accrualDay: accrual.accrualDay,
        },
        maxDaysPerMonth,
        carryForward: plain.carryForward || { enabled: false, maxDays: null },
    };
}

export function normalizePolicyLeaveTypes(leaveTypes = []) {
    if (!Array.isArray(leaveTypes)) {
        return [];
    }
    return leaveTypes.map(normalizePolicyLeaveType).filter((lt) => lt?.type);
}

export function getEnabledPolicyLeaveTypes(policy) {
    return (policy?.leaveTypes || []).filter((lt) => lt?.type && lt.enabled !== false);
}

export function getEnabledAccruableLeaveTypes(policy) {
    return getEnabledPolicyLeaveTypes(policy).filter(
        (lt) => getAnnualEntitlementAmount(lt) > 0 || getPolicyMonthlyAccrualAmount(lt) > 0
    );
}

export function isEmployedInViewMonth(employee, viewYear, viewMonth) {
    const joiningDate = getEffectiveJoiningDate(employee);
    const joinKey = calendarMonthSortKey(joiningDate.getFullYear(), joiningDate.getMonth() + 1);
    const viewKey = calendarMonthSortKey(viewYear, viewMonth);
    return viewKey >= joinKey;
}

export function sumPolicyMonthlyAccrualForViewMonth(policy, employee, viewYear, viewMonth) {
    if (!isEmployedInViewMonth(employee, viewYear, viewMonth)) {
        return 0;
    }
    return sumPolicyMonthlyAccrual(policy);
}

export function getTypeMonthlyAccrualForViewMonth(leaveTypeConfig, employee, viewYear, viewMonth) {
    if (!isEmployedInViewMonth(employee, viewYear, viewMonth)) {
        return 0;
    }
    return usesMonthlyAccrual(leaveTypeConfig) ? getPolicyMonthlyAccrualAmount(leaveTypeConfig) : 0;
}

export function sumPolicyAnnualEntitlement(policy) {
    return roundDays(
        getEnabledPolicyLeaveTypes(policy).reduce(
            (sum, lt) => sum + getAnnualEntitlementAmount(lt),
            0
        )
    );
}

export function sumPolicyMonthlyAccrual(policy) {
    return roundDays(
        getEnabledPolicyLeaveTypes(policy).reduce(
            (sum, lt) => sum + (usesMonthlyAccrual(lt) ? getPolicyMonthlyAccrualAmount(lt) : 0),
            0
        )
    );
}

export function validateLeaveTypeAccrual(leaveTypeConfig, leaveCycle = {}) {
    const errors = [];
    if (leaveTypeConfig?.enabled === false || !leaveTypeConfig?.type) {
        return errors;
    }

    const displayName = leaveTypeConfig.displayName || leaveTypeConfig.type || 'Leave type';
    const annual = getAnnualEntitlementAmount(leaveTypeConfig);
    const monthly = getPolicyMonthlyAccrualAmount(leaveTypeConfig);

    if (annual < 0) {
        errors.push(`${displayName}: Annual entitlement must be non-negative.`);
    }
    if (monthly < 0) {
        errors.push(`${displayName}: Monthly entitlement must be non-negative.`);
    }

    if (usesMonthlyAccrual(leaveTypeConfig) && annual > 0 && monthly > 0) {
        const periods = getAccrualPeriodsPerYear(leaveTypeConfig, leaveCycle);
        const projected = roundDays(monthly * periods);
        if (projected > roundDays(annual) + 0.001) {
            errors.push(
                `${displayName}: Monthly entitlement (${monthly}) × ${periods} months (${projected} days) exceeds annual entitlement (${annual} days).`
            );
        }
    }

    return errors;
}

export function validateLeavePolicyAccrual(policyData = {}) {
    const leaveCycle = policyData.leaveCycle || { startMonth: 1, endMonth: 12 };
    const leaveTypes = normalizePolicyLeaveTypes(policyData.leaveTypes || []);
    const errors = [];

    for (const lt of leaveTypes) {
        errors.push(...validateLeaveTypeAccrual(lt, leaveCycle));
    }

    const enabled = leaveTypes.filter((lt) => lt.enabled !== false);
    if (enabled.length === 0) {
        errors.push('At least one enabled leave type is required.');
    }

    return errors;
}

/**
 * Days appliable this month for a leave type.
 * Employee take limit tracks available balance (manual add + unused accrual roll-forward).
 * policy maxDaysPerMonth is not a tighter ceiling than available.
 */
export function getAppliableDaysThisMonth({ availableBalance = 0, maxDaysPerMonth, usedThisMonth = 0 }) {
    return getEmployeeAppliableDaysThisMonth({
        availableBalance,
        usedThisMonth,
        policyMaxDaysPerMonth: maxDaysPerMonth,
    });
}

export function getRemainingMonthlyTakeCap(maxDaysPerMonth, usedThisMonth = 0, availableBalance = null) {
    if (availableBalance != null && Number.isFinite(Number(availableBalance))) {
        return roundLeaveDays(Math.max(0, Number(availableBalance) || 0));
    }
    const cap = Number(maxDaysPerMonth);
    const used = Math.max(0, Number(usedThisMonth) || 0);
    if (!Number.isFinite(cap) || cap <= 0) {
        return null;
    }
    return roundLeaveDays(Math.max(0, cap - used));
}

/** @deprecated */
export function syncMonthlyEntitlementLeaveType(leaveType) {
    return normalizePolicyLeaveType(leaveType);
}
