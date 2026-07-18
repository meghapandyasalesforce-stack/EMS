/** Default annual leave entitlement when policy amount is missing or zero */
export const DEFAULT_LEAVE_ENTITLEMENT_DAYS = 18;

/** Default monthly allocation (18 / 12) */
export const DEFAULT_MONTHLY_LEAVE_DAYS = 1.5;

/** Earliest year selectable in leave history / recalculation UI */
export const LEAVE_HISTORY_MIN_YEAR = 2016;

export const LEAVE_TYPES_NO_CARRY_FORWARD = new Set(['loss_of_pay', 'sick']);

export function getEffectiveEntitlementAmount(leaveTypeConfig) {
    const maxAccrual = Number(leaveTypeConfig?.accrual?.maxAccrual);
    if (Number.isFinite(maxAccrual) && maxAccrual > 0) {
        return maxAccrual;
    }
    const amount = Number(leaveTypeConfig?.accrual?.amount);
    if (Number.isFinite(amount) && amount > 0) {
        // accrual.amount <= 3 is the monthly rate (e.g. 1.5), not the annual cap
        if (amount <= 3) {
            return DEFAULT_LEAVE_ENTITLEMENT_DAYS;
        }
        return amount;
    }
    return DEFAULT_LEAVE_ENTITLEMENT_DAYS;
}

/**
 * Carry-forward defaults: always enabled for standard leave types.
 * 100% of unused balance carries — no cap, no expiry, no January reset.
 */
export function getEffectiveCarryForwardConfig(leaveTypeConfig) {
    const leaveType = leaveTypeConfig?.type;
    if (LEAVE_TYPES_NO_CARRY_FORWARD.has(leaveType)) {
        return { enabled: false, maxDays: null, expiresIfNotUsed: false, expiryDays: undefined };
    }

    return {
        enabled: true,
        maxDays: null,
        expiresIfNotUsed: false,
        expiryDays: undefined,
    };
}

export function applyLeaveTypeEntitlementDefaults(leaveType) {
    const plain =
        leaveType && typeof leaveType === 'object' && typeof leaveType.toObject === 'function'
            ? leaveType.toObject()
            : leaveType;
    if (!plain || typeof plain !== 'object') {
        return plain;
    }

    return {
        ...plain,
        type: plain.type,
        enabled: plain.enabled !== false,
        maxDaysPerMonth:
            Number(plain.maxDaysPerMonth) > 0
                ? Number(plain.maxDaysPerMonth)
                : DEFAULT_MONTHLY_LEAVE_DAYS,
        accrual: {
            method: 'monthly',
            frequency: 'monthly',
            amount: DEFAULT_MONTHLY_LEAVE_DAYS,
            anniversaryBased: false,
        },
        carryForward: {
            enabled: true,
            maxDays: null,
            expiresIfNotUsed: false,
        },
    };
}
