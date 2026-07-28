/**
 * Employee-specific leave take limits and manual/imported stock buckets.
 *
 * Product rules:
 * - Manual Add raises that employee's available balance AND month take limit together.
 * - Month take limit tracks available (unused days + new month accrual roll forward).
 * - On apply/approve: consume policy/accrued portion first, then manualStock.
 * - Manual Reduce (current month): policy portion first, then manualStock.
 * - Excess beyond available: HR chooses
 *   - `lop` → LOP this month (dates + half-day shift)
 *   - `future_months` → cut remaining future pool / re-split months after current (not LOP)
 */

import { roundLeaveDays } from './leaveBalanceRulesHelper.js';

/**
 * Effective calendar-month take ceiling for one employee + leave type.
 * Cap is set so remaining room equals current available (pending already netted in available).
 * usedThisMonth + requested <= usedThisMonth + available  ⇒  requested <= available.
 */
export function getEffectiveMonthlyTakeCap({ availableBalance = 0, usedThisMonth = 0 } = {}) {
    const available = Math.max(0, Number(availableBalance) || 0);
    const used = Math.max(0, Number(usedThisMonth) || 0);
    return roundLeaveDays(used + available);
}

/**
 * Days the employee can still apply this month for a leave type.
 * With balance-tracking limits this is simply remaining available.
 */
export function getEmployeeAppliableDaysThisMonth({
    availableBalance = 0,
    usedThisMonth = 0,
    policyMaxDaysPerMonth,
} = {}) {
    const available = Math.max(0, Number(availableBalance) || 0);
    // Balance-as-limit: accumulated + manual stock is takeable; policy maxDaysPerMonth
    // must not block migration CF / unused accrual roll-forward.
    void usedThisMonth;
    void policyMaxDaysPerMonth;
    return roundLeaveDays(available);
}

/**
 * Apply HR add/reduce to remaining manual/imported stock.
 * Add: manualStock += amount.
 * Reduce (stock-only helper): decrease manualStock (not below 0).
 */
export function applyManualStockDelta(manualStock, delta) {
    const current = Math.max(0, roundLeaveDays(Number(manualStock) || 0));
    const change = roundLeaveDays(Number(delta) || 0);
    if (change === 0) return current;
    if (change > 0) {
        return roundLeaveDays(current + change);
    }
    return Math.max(0, roundLeaveDays(current + change));
}

/**
 * Consume approved/applied leave days: policy/accrued bucket first, then manualStock.
 * availableBefore = balance available before this consumption (policyPortion + manualStock).
 */
export function consumeLeaveBuckets({ manualStock = 0, availableBefore = 0, days = 0 } = {}) {
    const stock = Math.max(0, roundLeaveDays(Number(manualStock) || 0));
    const available = Math.max(0, roundLeaveDays(Number(availableBefore) || 0));
    const take = Math.max(0, roundLeaveDays(Number(days) || 0));

    const policyBucket = Math.max(0, roundLeaveDays(available - stock));
    const fromPolicy = Math.min(take, policyBucket);
    const fromManual = Math.max(0, roundLeaveDays(take - fromPolicy));
    const nextManualStock = Math.max(0, roundLeaveDays(stock - fromManual));

    return {
        fromPolicy: roundLeaveDays(fromPolicy),
        fromManual: roundLeaveDays(fromManual),
        manualStock: nextManualStock,
    };
}

/**
 * Split a Balance Adjustment Reduce amount:
 * - fromPolicy / fromManual come from current available only (policy first, then stock)
 * - excessDays = amount beyond available (handled as LOP or future-months re-split)
 */
export function splitBalanceReduceAmount({
    available = 0,
    manualStock = 0,
    reduceAmount = 0,
} = {}) {
    const availableBal = Math.max(0, roundLeaveDays(Number(available) || 0));
    const stock = Math.max(0, roundLeaveDays(Number(manualStock) || 0));
    const reduce = Math.max(0, roundLeaveDays(Number(reduceAmount) || 0));

    const fromBalance = Math.min(reduce, availableBal);
    const consumed = consumeLeaveBuckets({
        manualStock: stock,
        availableBefore: availableBal,
        days: fromBalance,
    });
    const excessDays = Math.max(0, roundLeaveDays(reduce - fromBalance));

    return {
        fromPolicy: consumed.fromPolicy,
        fromManual: consumed.fromManual,
        fromBalance,
        /** @deprecated use excessDays — kept for callers that still say lopDays */
        lopDays: excessDays,
        excessDays,
        manualStock: consumed.manualStock,
        availableAfter: Math.max(0, roundLeaveDays(availableBal - fromBalance)),
    };
}

/**
 * Re-budget remaining months after current when HR chooses "adjust future months".
 *
 * SaaS-safe: never thin-spread below the policy monthly entitlement.
 * Excess cuts the future pool; remaining pool funds as many full policy-monthly
 * chunks as possible (next months in order). Later months get 0 for this type.
 *
 * Example: monthly 0.5, July adjust, 5 future months, excess 1
 * → future pool 2.5 − 1 = 1.5 → 3 × 0.5 funded (Aug–Oct), Nov–Dec = 0
 */
export function computeFutureMonthsResplit({
    policyAnnual = 0,
    policyMonthly = 0,
    adjustMonth = 1,
    excessDays = 0,
} = {}) {
    const month = Math.min(12, Math.max(1, Number(adjustMonth) || 1));
    const annual = Math.max(0, roundLeaveDays(Number(policyAnnual) || 0));
    const monthly = Math.max(0, roundLeaveDays(Number(policyMonthly) || 0));
    const excess = Math.max(0, roundLeaveDays(Number(excessDays) || 0));
    const futureMonthCount = Math.max(0, 12 - month);

    if (futureMonthCount <= 0) {
        return {
            ok: false,
            futureMonthCount: 0,
            futurePoolBefore: 0,
            futurePoolAfter: 0,
            futureMonthlyRate: 0,
            fundedFutureMonths: 0,
            zeroedFutureMonths: 0,
            effectiveAnnual: Math.max(0, roundLeaveDays(annual - excess)),
            message: 'No future months left in this year; use LOP for this month instead',
        };
    }

    if (monthly <= 0) {
        return {
            ok: false,
            futureMonthCount,
            futurePoolBefore: 0,
            futurePoolAfter: 0,
            futureMonthlyRate: 0,
            fundedFutureMonths: 0,
            zeroedFutureMonths: futureMonthCount,
            effectiveAnnual: Math.max(0, roundLeaveDays(annual - excess)),
            message: 'This leave type has no monthly entitlement to re-split; use LOP instead',
        };
    }

    const futurePoolBefore = roundLeaveDays(futureMonthCount * monthly);
    const futurePoolAfter = Math.max(0, roundLeaveDays(futurePoolBefore - excess));
    // Full policy-monthly chunks only — never below policy monthly for a funded month
    const fundedFutureMonths = Math.min(
        futureMonthCount,
        Math.floor((futurePoolAfter + 1e-9) / monthly)
    );
    const fundedPool = roundLeaveDays(fundedFutureMonths * monthly);
    const zeroedFutureMonths = Math.max(0, futureMonthCount - fundedFutureMonths);
    const pastAndCurrentPool = roundLeaveDays(month * monthly);
    const effectiveAnnual = roundLeaveDays(pastAndCurrentPool + fundedPool);

    return {
        ok: true,
        futureMonthCount,
        futurePoolBefore,
        futurePoolAfter: fundedPool,
        /** Rate applied to each funded future month (= policy monthly entitlement). */
        futureMonthlyRate: monthly,
        fundedFutureMonths,
        zeroedFutureMonths,
        effectiveAnnual,
        message: null,
    };
}

/**
 * Break LOP days into UI/API slots: full days (1) then a trailing half (0.5) if needed.
 * Example: 3 → three 1.0 slots; 0.5 → one half slot; 2.5 → two full + one half.
 */
export function buildLopDaySlots(lopDays = 0) {
    const total = Math.max(0, roundLeaveDays(Number(lopDays) || 0));
    if (total <= 0) return [];

    const slots = [];
    let remaining = total;
    while (remaining >= 1 - 0.0001) {
        slots.push({ days: 1, isHalfDay: false });
        remaining = roundLeaveDays(remaining - 1);
    }
    if (remaining >= 0.5 - 0.0001) {
        slots.push({ days: 0.5, isHalfDay: true });
    }
    return slots;
}

/**
 * Given previous/next available after Balance Adjustment, update manualStock.
 */
export function manualStockAfterBalanceAdjust({
    previousAvailable = 0,
    nextAvailable = 0,
    previousManualStock = 0,
} = {}) {
    const delta = roundLeaveDays(
        (Number(nextAvailable) || 0) - (Number(previousAvailable) || 0)
    );
    return applyManualStockDelta(previousManualStock, delta);
}
