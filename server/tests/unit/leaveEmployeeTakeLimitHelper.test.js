import { describe, it, expect } from '@jest/globals';
import {
    getEffectiveMonthlyTakeCap,
    getEmployeeAppliableDaysThisMonth,
    applyManualStockDelta,
    consumeLeaveBuckets,
    manualStockAfterBalanceAdjust,
    splitBalanceReduceAmount,
    buildLopDaySlots,
    computeFutureMonthsResplit,
} from '../../helpers/leaveEmployeeTakeLimitHelper.js';
import { getAppliableDaysThisMonth } from '../../helpers/leavePolicyAccrualHelper.js';

describe('leaveEmployeeTakeLimitHelper', () => {
    describe('month take limit tracks available', () => {
        it('add 1.5 on top of 0.5 → can take 2 this month', () => {
            expect(
                getEmployeeAppliableDaysThisMonth({
                    availableBalance: 2,
                    policyMaxDaysPerMonth: 0.5,
                    usedThisMonth: 0,
                })
            ).toBe(2);
            expect(
                getEffectiveMonthlyTakeCap({ availableBalance: 2, usedThisMonth: 0 })
            ).toBe(2);
        });

        it('unused rolls with accrual: 2.0 → next month 2.5 takeable', () => {
            expect(
                getEmployeeAppliableDaysThisMonth({
                    availableBalance: 2.5,
                    policyMaxDaysPerMonth: 0.5,
                })
            ).toBe(2.5);
        });

        it('policy maxDaysPerMonth does not block accumulated balance', () => {
            expect(
                getAppliableDaysThisMonth({
                    availableBalance: 6,
                    maxDaysPerMonth: 0.5,
                    usedThisMonth: 0,
                })
            ).toBe(6);
        });
    });

    describe('manual stock add/reduce (symmetric)', () => {
        it('add increases manualStock by HR amount', () => {
            expect(applyManualStockDelta(0, 1.5)).toBe(1.5);
            expect(applyManualStockDelta(1.5, 1)).toBe(2.5);
        });

        it('reduce decreases balance/limit/stock by same amount (manual first)', () => {
            expect(applyManualStockDelta(1.5, -1)).toBe(0.5);
            expect(applyManualStockDelta(0.5, -1)).toBe(0);
            expect(
                manualStockAfterBalanceAdjust({
                    previousAvailable: 2,
                    nextAvailable: 1,
                    previousManualStock: 1.5,
                })
            ).toBe(0.5);
        });
    });

    describe('consume policy bucket first, then manual', () => {
        it('takes 0.5 policy then remainder from manual 1.5', () => {
            const result = consumeLeaveBuckets({
                manualStock: 1.5,
                availableBefore: 2,
                days: 1,
            });
            expect(result.fromPolicy).toBe(0.5);
            expect(result.fromManual).toBe(0.5);
            expect(result.manualStock).toBe(1);
        });

        it('all-manual when policy bucket is empty', () => {
            const result = consumeLeaveBuckets({
                manualStock: 1.5,
                availableBefore: 1.5,
                days: 1,
            });
            expect(result.fromPolicy).toBe(0);
            expect(result.fromManual).toBe(1);
            expect(result.manualStock).toBe(0.5);
        });
    });

    describe('reduce beyond available → LOP (not annual)', () => {
        it('June 1.5 (0.5 policy + 1 stock), reduce 2 → balance 1.5 + LOP 0.5', () => {
            const split = splitBalanceReduceAmount({
                available: 1.5,
                manualStock: 1,
                reduceAmount: 2,
            });
            expect(split.fromPolicy).toBe(0.5);
            expect(split.fromManual).toBe(1);
            expect(split.fromBalance).toBe(1.5);
            expect(split.lopDays).toBe(0.5);
            expect(split.availableAfter).toBe(0);
            expect(split.manualStock).toBe(0);
        });

        it('reduce within available creates no LOP', () => {
            const split = splitBalanceReduceAmount({
                available: 1.5,
                manualStock: 1,
                reduceAmount: 1,
            });
            expect(split.fromPolicy).toBe(0.5);
            expect(split.fromManual).toBe(0.5);
            expect(split.lopDays).toBe(0);
            expect(split.availableAfter).toBe(0.5);
        });

        it('buildLopDaySlots: 0.5 → one half; 3 → three full; 2.5 → two full + half', () => {
            expect(buildLopDaySlots(0.5)).toEqual([{ days: 0.5, isHalfDay: true }]);
            expect(buildLopDaySlots(3)).toEqual([
                { days: 1, isHalfDay: false },
                { days: 1, isHalfDay: false },
                { days: 1, isHalfDay: false },
            ]);
            expect(buildLopDaySlots(2.5)).toEqual([
                { days: 1, isHalfDay: false },
                { days: 1, isHalfDay: false },
                { days: 0.5, isHalfDay: true },
            ]);
        });
    });

    describe('future months resplit', () => {
        it('July excess 1 on 0.5/mo → 3 funded months at 0.5, 2 zeroed (not 0.3 across all)', () => {
            const resplit = computeFutureMonthsResplit({
                policyAnnual: 6,
                policyMonthly: 0.5,
                adjustMonth: 7,
                excessDays: 1,
            });
            expect(resplit.ok).toBe(true);
            expect(resplit.futureMonthCount).toBe(5);
            expect(resplit.futurePoolBefore).toBe(2.5);
            expect(resplit.fundedFutureMonths).toBe(3);
            expect(resplit.zeroedFutureMonths).toBe(2);
            expect(resplit.futureMonthlyRate).toBe(0.5);
            expect(resplit.futurePoolAfter).toBe(1.5);
            expect(resplit.effectiveAnnual).toBe(5); // 7*0.5 + 1.5
        });

        it('June excess 2 on 0.5/mo → 2 funded months at 0.5, then 4 months at 0', () => {
            const resplit = computeFutureMonthsResplit({
                policyAnnual: 6,
                policyMonthly: 0.5,
                adjustMonth: 6,
                excessDays: 2,
            });
            expect(resplit.ok).toBe(true);
            expect(resplit.futureMonthCount).toBe(6);
            // future pool 3 − 2 = 1 → floor(1 / 0.5) = 2 funded months (Jul–Aug), Sep–Dec = 0
            expect(resplit.fundedFutureMonths).toBe(2);
            expect(resplit.zeroedFutureMonths).toBe(4);
            expect(resplit.futureMonthlyRate).toBe(0.5);
        });

        it('never funds a month below policy monthly', () => {
            const resplit = computeFutureMonthsResplit({
                policyAnnual: 12,
                policyMonthly: 1,
                adjustMonth: 6,
                excessDays: 0.5,
            });
            expect(resplit.futureMonthlyRate).toBe(1);
            expect(resplit.fundedFutureMonths).toBe(5); // pool 6-0.5=5.5 → floor 5
            expect(resplit.zeroedFutureMonths).toBe(1);
        });

        it('December has no future months', () => {
            const resplit = computeFutureMonthsResplit({
                policyAnnual: 6,
                policyMonthly: 0.5,
                adjustMonth: 12,
                excessDays: 1,
            });
            expect(resplit.ok).toBe(false);
            expect(resplit.futureMonthCount).toBe(0);
        });
    });
});
