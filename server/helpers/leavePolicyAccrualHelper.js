import {
    applyLeaveTypeEntitlementDefaults,
    DEFAULT_MONTHLY_LEAVE_DAYS,
    DEFAULT_LEAVE_ENTITLEMENT_DAYS,
    LEAVE_TYPES_NO_CARRY_FORWARD,
} from '../constants/leaveDefaults.js';

/**
 * SaaS-style monthly leave entitlement helpers.
 * - Monthly entitlement accrues into a cumulative balance (unused months roll forward in available).
 * - maxDaysPerMonth limits how many days can be taken in a single calendar month.
 */

export const MONTHS_PER_ACCRUAL_YEAR = 12;

export function getMonthlyEntitlementAmount(leaveTypeConfig) {
    const cap = Number(leaveTypeConfig?.maxDaysPerMonth);
    if (Number.isFinite(cap) && cap > 0) {
        return cap;
    }
    if (leaveTypeConfig?.accrual?.method === 'monthly') {
        const amount = Number(leaveTypeConfig.accrual.amount);
        if (Number.isFinite(amount) && amount > 0) {
            // Legacy policies may store 18 as amount — treat as yearly and convert to monthly
            return amount > 3 ? amount / MONTHS_PER_ACCRUAL_YEAR : amount;
        }
    }
    return null;
}

/**
 * Monthly rate for rolling balance recalc (Update leave).
 * Standard types accrue 1.5/month; LOP uses policy rate.
 */
export function getRollingAccrualMonthlyRate(leaveTypeConfig) {
    const type = leaveTypeConfig?.type;
    if (type && LEAVE_TYPES_NO_CARRY_FORWARD.has(type)) {
        return getMonthlyEntitlementAmount(leaveTypeConfig) ?? DEFAULT_MONTHLY_LEAVE_DAYS;
    }
    if (usesMonthlyAllocation(leaveTypeConfig)) {
        return DEFAULT_MONTHLY_LEAVE_DAYS;
    }
    return getMonthlyEntitlementAmount(leaveTypeConfig) ?? DEFAULT_MONTHLY_LEAVE_DAYS;
}

export function getDisplayYearlyAccrualCap(leaveTypeConfig) {
    const monthly = getRollingAccrualMonthlyRate(leaveTypeConfig);
    return monthly * MONTHS_PER_ACCRUAL_YEAR;
}

export function hasMonthlyEntitlement(leaveTypeConfig) {
    return getMonthlyEntitlementAmount(leaveTypeConfig) != null;
}

/** True when policy uses automated monthly allocation (1.5/mo style). Legacy fixed/yearly policies stay unchanged. */
export function usesMonthlyAllocation(leaveTypeConfig) {
    if (leaveTypeConfig?.enabled === false) {
        return false;
    }
    if (hasMonthlyEntitlement(leaveTypeConfig)) {
        return true;
    }
    const method = leaveTypeConfig?.accrual?.method;
    return method === 'monthly' || method === 'fixed';
}

export function getYearlyAccrualCap(leaveTypeConfig) {
    const monthly = getMonthlyEntitlementAmount(leaveTypeConfig);
    if (monthly == null) {
        return null;
    }
    const configuredMax = Number(leaveTypeConfig?.accrual?.maxAccrual);
    const defaultCap = monthly * MONTHS_PER_ACCRUAL_YEAR;
    if (Number.isFinite(configuredMax) && configuredMax > 0) {
        return Math.min(configuredMax, defaultCap);
    }
    return defaultCap;
}

/** Convert mongoose subdocument or plain object to a plain leave-type config. */
export function toPlainLeaveTypeConfig(leaveType) {
    if (!leaveType || typeof leaveType !== 'object') {
        return leaveType;
    }
    if (typeof leaveType.toObject === 'function') {
        return leaveType.toObject();
    }
    return { ...leaveType };
}

/**
 * When maxDaysPerMonth is set, sync monthly accrual (2/month → max 24/year in balance pool).
 */
export function syncMonthlyEntitlementLeaveType(leaveType) {
    const plain = toPlainLeaveTypeConfig(leaveType);
    if (!plain || typeof plain !== 'object') {
        return plain;
    }
    const cap = Number(plain.maxDaysPerMonth);
    if (!Number.isFinite(cap) || cap <= 0) {
        return plain;
    }
    const yearlyCap = cap * MONTHS_PER_ACCRUAL_YEAR;
    return {
        ...plain,
        accrual: {
            ...(plain.accrual || {}),
            method: 'monthly',
            amount: cap,
            frequency: 'monthly',
            maxAccrual: yearlyCap,
        },
    };
}

export function normalizePolicyLeaveTypes(leaveTypes = []) {
    if (!Array.isArray(leaveTypes)) {
        return [];
    }
    return leaveTypes
        .map((lt) => applyLeaveTypeEntitlementDefaults(syncMonthlyEntitlementLeaveType(lt)))
        .filter((lt) => lt?.type);
}

/** Days employee can still apply for this calendar month (min of balance vs monthly take cap). */
export function getAppliableDaysThisMonth({ availableBalance = 0, maxDaysPerMonth, usedThisMonth = 0 }) {
    const available = Math.max(0, Number(availableBalance) || 0);
    const used = Math.max(0, Number(usedThisMonth) || 0);
    const cap = Number(maxDaysPerMonth);

    if (!Number.isFinite(cap) || cap <= 0) {
        return roundDays(available);
    }

    const remainingTakeCap = Math.max(0, cap - used);
    return roundDays(Math.min(available, remainingTakeCap));
}

export function getRemainingMonthlyTakeCap(maxDaysPerMonth, usedThisMonth = 0) {
    const cap = Number(maxDaysPerMonth);
    const used = Math.max(0, Number(usedThisMonth) || 0);
    if (!Number.isFinite(cap) || cap <= 0) {
        return null;
    }
    return roundDays(Math.max(0, cap - used));
}

export function roundDays(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
}
