import { describe, it, expect } from '@jest/globals';
import {
    MONTHS_PER_ACCRUAL_YEAR,
    getMonthlyEntitlementAmount,
    getYearlyAccrualCap,
    syncMonthlyEntitlementLeaveType,
    normalizePolicyLeaveTypes,
    getAppliableDaysThisMonth,
    getRemainingMonthlyTakeCap,
    hasMonthlyEntitlement
} from '../../helpers/leavePolicyAccrualHelper.js';

describe('leavePolicyAccrualHelper', () => {
    describe('monthly entitlement from policy', () => {
        it('uses maxDaysPerMonth as monthly entitlement when set', () => {
            expect(getMonthlyEntitlementAmount({ maxDaysPerMonth: 2 })).toBe(2);
            expect(getYearlyAccrualCap({ maxDaysPerMonth: 2 })).toBe(24);
        });

        it('falls back to monthly accrual amount when cap field empty', () => {
            expect(
                getMonthlyEntitlementAmount({
                    accrual: { method: 'monthly', amount: 1.5 }
                })
            ).toBe(1.5);
        });

        it('syncs leave type to monthly accrual when maxDaysPerMonth set', () => {
            const synced = syncMonthlyEntitlementLeaveType({
                type: 'casual',
                maxDaysPerMonth: 2,
                accrual: { method: 'fixed', amount: 12 }
            });
            expect(synced.accrual.method).toBe('monthly');
            expect(synced.accrual.amount).toBe(2);
            expect(synced.accrual.maxAccrual).toBe(2 * MONTHS_PER_ACCRUAL_YEAR);
        });

        it('normalizes all leave types on policy save', () => {
            const normalized = normalizePolicyLeaveTypes([
                { type: 'paid', maxDaysPerMonth: 2 },
                { type: 'sick', maxDaysPerMonth: null }
            ]);
            expect(normalized[0].accrual.method).toBe('monthly');
            expect(normalized[0].accrual.maxAccrual).toBe(24);
            expect(normalized[1].accrual?.method).toBeUndefined();
        });
    });

    describe('SaaS appliable days this month', () => {
        it('returns min of available balance and remaining monthly take cap', () => {
            expect(
                getAppliableDaysThisMonth({
                    availableBalance: 6,
                    maxDaysPerMonth: 2,
                    usedThisMonth: 0
                })
            ).toBe(2);

            expect(
                getAppliableDaysThisMonth({
                    availableBalance: 1,
                    maxDaysPerMonth: 2,
                    usedThisMonth: 0
                })
            ).toBe(1);

            expect(
                getAppliableDaysThisMonth({
                    availableBalance: 6,
                    maxDaysPerMonth: 2,
                    usedThisMonth: 1.5
                })
            ).toBe(0.5);
        });

        it('returns full available when no monthly take cap', () => {
            expect(
                getAppliableDaysThisMonth({
                    availableBalance: 5,
                    maxDaysPerMonth: null,
                    usedThisMonth: 0
                })
            ).toBe(5);
        });

        it('detects monthly entitlement from cap or accrual', () => {
            expect(hasMonthlyEntitlement({ maxDaysPerMonth: 2 })).toBe(true);
            expect(hasMonthlyEntitlement({ accrual: { method: 'monthly', amount: 2 } })).toBe(true);
            expect(hasMonthlyEntitlement({ accrual: { method: 'fixed', amount: 12 } })).toBe(false);
        });

        it('computes remaining monthly take cap', () => {
            expect(getRemainingMonthlyTakeCap(2, 0.5)).toBe(1.5);
            expect(getRemainingMonthlyTakeCap(2, 2)).toBe(0);
        });
    });
});
