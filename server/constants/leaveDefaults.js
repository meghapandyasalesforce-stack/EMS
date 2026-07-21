import {
    getAnnualEntitlementAmount,
    getPolicyMonthlyAccrualAmount,
    usesMonthlyAccrual,
} from '../helpers/leavePolicyAccrualHelper.js';

/** Earliest year selectable in leave history / recalculation UI */
export const LEAVE_HISTORY_MIN_YEAR = 2016;

/**
 * LEGACY FALLBACK ONLY — do not use in balance/summary/validation when an active policy exists.
 * Used for: new-policy form templates, API metadata, historical compatibility.
 */
export const DEFAULT_LEAVE_ENTITLEMENT_DAYS = 18;

/**
 * LEGACY FALLBACK ONLY — do not use in balance/summary/validation when an active policy exists.
 */
export const DEFAULT_MONTHLY_LEAVE_DAYS = 1.5;

/** Explicit legacy accessors — call sites must document why fallback is needed. */
export function getLegacyDefaultAnnualEntitlement() {
    return DEFAULT_LEAVE_ENTITLEMENT_DAYS;
}

export function getLegacyDefaultMonthlyAccrual() {
    return DEFAULT_MONTHLY_LEAVE_DAYS;
}

/**
 * Annual entitlement from policy (accrual.maxAccrual). Returns 0 when unconfigured.
 * Never falls back to DEFAULT_LEAVE_ENTITLEMENT_DAYS.
 */
export function getEffectiveEntitlementAmount(leaveTypeConfig) {
    return getAnnualEntitlementAmount(leaveTypeConfig);
}

/**
 * Carry-forward from policy configuration (respect HR settings per leave type).
 */
export function getEffectiveCarryForwardConfig(leaveTypeConfig) {
    const cf = leaveTypeConfig?.carryForward;
    if (cf && typeof cf === 'object') {
        return {
            enabled: cf.enabled !== false,
            maxDays: cf.maxDays != null ? Number(cf.maxDays) : null,
            expiresIfNotUsed: Boolean(cf.expiresIfNotUsed),
            expiryDays: cf.expiryDays,
        };
    }
    return {
        enabled: false,
        maxDays: null,
        expiresIfNotUsed: false,
        expiryDays: undefined,
    };
}

/**
 * Fill only missing structural fields — never inject 18/1.5 or overwrite HR values.
 */
export function applyLeaveTypeEntitlementDefaults(leaveType) {
    const plain =
        leaveType && typeof leaveType === 'object' && typeof leaveType.toObject === 'function'
            ? leaveType.toObject()
            : leaveType;
    if (!plain || typeof plain !== 'object') {
        return plain;
    }

    const accrual = plain.accrual || {};
    const normalizedAccrual = {
        ...accrual,
        method: accrual.method || 'monthly',
        frequency: accrual.frequency || accrual.method || 'monthly',
        anniversaryBased: Boolean(accrual.anniversaryBased),
    };

    if (accrual.amount != null && Number.isFinite(Number(accrual.amount))) {
        normalizedAccrual.amount = Number(accrual.amount);
    }
    if (accrual.maxAccrual != null && Number.isFinite(Number(accrual.maxAccrual))) {
        normalizedAccrual.maxAccrual = Number(accrual.maxAccrual);
    }

    const result = {
        ...plain,
        type: plain.type,
        enabled: plain.enabled !== false,
        accrual: normalizedAccrual,
        carryForward: plain.carryForward || { enabled: false },
    };

    if (plain.maxDaysPerMonth != null && Number(plain.maxDaysPerMonth) > 0) {
        result.maxDaysPerMonth = Number(plain.maxDaysPerMonth);
    }

    return result;
}

export function getEffectiveMonthlyAccrual(leaveTypeConfig) {
    if (!usesMonthlyAccrual(leaveTypeConfig)) {
        return 0;
    }
    return getPolicyMonthlyAccrualAmount(leaveTypeConfig);
}
