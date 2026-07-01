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
            return amount;
        }
    }
    return null;
}

export function hasMonthlyEntitlement(leaveTypeConfig) {
    return getMonthlyEntitlementAmount(leaveTypeConfig) != null;
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

/**
 * When maxDaysPerMonth is set, sync monthly accrual (2/month → max 24/year in balance pool).
 */
export function syncMonthlyEntitlementLeaveType(leaveType) {
    if (!leaveType || typeof leaveType !== 'object') {
        return leaveType;
    }
    const cap = Number(leaveType.maxDaysPerMonth);
    if (!Number.isFinite(cap) || cap <= 0) {
        return leaveType;
    }
    const yearlyCap = cap * MONTHS_PER_ACCRUAL_YEAR;
    return {
        ...leaveType,
        accrual: {
            ...(leaveType.accrual || {}),
            method: 'monthly',
            amount: cap,
            frequency: 'monthly',
            maxAccrual: yearlyCap
        }
    };
}

export function normalizePolicyLeaveTypes(leaveTypes = []) {
    if (!Array.isArray(leaveTypes)) {
        return [];
    }
    return leaveTypes.map(syncMonthlyEntitlementLeaveType);
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
