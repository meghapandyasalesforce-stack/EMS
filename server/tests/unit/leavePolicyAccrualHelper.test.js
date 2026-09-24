import { describe, it, expect } from '@jest/globals';
import {
    MONTHS_PER_LEAVE_CYCLE,
    getPolicyMonthlyAccrualAmount,
    getAnnualEntitlementAmount,
    getRollingAccrualMonthlyRate,
    getDisplayYearlyAccrualCap,
    getYearlyAccrualCap,
    normalizePolicyLeaveTypes,
    validateLeaveTypeAccrual,
    validateLeavePolicyAccrual,
    getAppliableDaysThisMonth,
    getRemainingMonthlyTakeCap,
    hasMonthlyEntitlement,
    usesMonthlyAccrual,
    getAccrualPeriodsPerYear,
    sumPolicyAnnualEntitlement,
    sumPolicyMonthlyAccrual,
    sumPolicyMonthlyAccrualForViewMonth,
    getJoinAccrualCutoffDay,
    getFirstAccrualCalendarMonth,
    normalizeLeaveCycle,
} from '../../helpers/leavePolicyAccrualHelper.js';

describe('leavePolicyAccrualHelper', () => {
    const casualType = {
        type: 'casual',
        displayName: 'Casual Leave',
        enabled: true,
        accrual: { method: 'monthly', frequency: 'monthly', amount: 0.5, maxAccrual: 6 },
        maxDaysPerMonth: 2,
    };

    const sickType = {
        type: 'sick',
        displayName: 'Sick Leave',
        enabled: true,
        accrual: { method: 'monthly', frequency: 'monthly', amount: 1, maxAccrual: 12 },
    };

    describe('policy field mapping', () => {
        it('reads monthly accrual from accrual.amount only', () => {
            expect(getPolicyMonthlyAccrualAmount(casualType)).toBe(0.5);
            expect(getPolicyMonthlyAccrualAmount({ ...casualType, maxDaysPerMonth: 2 })).toBe(0.5);
        });

        it('infers monthly from annual when amount is missing (legacy paid leave)', () => {
            expect(
                getPolicyMonthlyAccrualAmount({
                    type: 'paid',
                    enabled: true,
                    accrual: { method: 'monthly', frequency: 'monthly', maxAccrual: 12, amount: 0 },
                })
            ).toBe(1);
        });

        it('reads annual entitlement from accrual.maxAccrual only', () => {
            expect(getAnnualEntitlementAmount(casualType)).toBe(6);
            expect(getDisplayYearlyAccrualCap(casualType)).toBe(6);
            expect(getYearlyAccrualCap(sickType)).toBe(12);
        });

        it('uses policy monthly rate for rolling accrual', () => {
            expect(getRollingAccrualMonthlyRate(casualType)).toBe(0.5);
            expect(getRollingAccrualMonthlyRate(sickType)).toBe(1);
        });

        it('preserves HR values on normalize without hardcoded overwrite', () => {
            const normalized = normalizePolicyLeaveTypes([casualType, sickType]);
            expect(normalized[0].accrual.amount).toBe(0.5);
            expect(normalized[0].accrual.maxAccrual).toBe(6);
            expect(normalized[1].accrual.amount).toBe(1);
            expect(normalized[1].accrual.maxAccrual).toBe(12);
        });
    });

    describe('validation', () => {
        it('accepts valid monthly × periods ≤ annual', () => {
            expect(validateLeaveTypeAccrual(casualType)).toEqual([]);
        });

        it('rejects when monthly × periods exceeds annual', () => {
            const invalid = {
                ...casualType,
                accrual: { ...casualType.accrual, amount: 0.5, maxAccrual: 5 },
            };
            const errors = validateLeaveTypeAccrual(invalid);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toMatch(/exceeds annual entitlement/i);
        });

        it('uses leave cycle month count for monthly frequency', () => {
            expect(getAccrualPeriodsPerYear(casualType, { startMonth: 4, endMonth: 3 })).toBe(
                MONTHS_PER_LEAVE_CYCLE
            );
        });

        it('validates full policy', () => {
            const errors = validateLeavePolicyAccrual({
                leaveTypes: [casualType, sickType],
                leaveCycle: { startMonth: 1, endMonth: 12 },
            });
            expect(errors).toEqual([]);
            expect(sumPolicyAnnualEntitlement({ leaveTypes: [casualType, sickType] })).toBe(18);
        });

        it('accepts on_anniversary with Amount only (no monthly entitlement)', () => {
            const anniversarySick = {
                type: 'sick',
                enabled: true,
                displayName: 'Sick',
                accrual: {
                    method: 'on_anniversary',
                    frequency: 'yearly',
                    maxAccrual: 5,
                    amount: 0,
                },
            };
            expect(validateLeaveTypeAccrual(anniversarySick)).toEqual([]);
            expect(usesMonthlyAccrual(anniversarySick)).toBe(false);
            const normalized = normalizePolicyLeaveTypes([anniversarySick])[0];
            expect(normalized.accrual.maxAccrual).toBe(5);
            expect(normalized.accrual.amount).toBe(0);
            expect(normalized.accrual.anniversaryBased).toBe(true);
            expect(normalized.maxDaysPerMonth).toBeUndefined();
        });

        it('accepts yearly lump-sum with Amount only', () => {
            const yearlyType = {
                type: 'vacation',
                enabled: true,
                displayName: 'Vacation',
                accrual: {
                    method: 'yearly',
                    frequency: 'yearly',
                    maxAccrual: 6,
                    amount: 0,
                },
            };
            expect(validateLeaveTypeAccrual(yearlyType)).toEqual([]);
            expect(usesMonthlyAccrual(yearlyType)).toBe(false);
        });

        it('rejects on_anniversary without annual Amount', () => {
            const invalid = {
                type: 'sick',
                enabled: true,
                displayName: 'Sick',
                accrual: {
                    method: 'on_anniversary',
                    frequency: 'yearly',
                    maxAccrual: 0,
                    amount: 0,
                },
            };
            const errors = validateLeaveTypeAccrual(invalid);
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toMatch(/Amount \(annual entitlement\) is required/i);
        });
    });

    describe('application limits vs accrual', () => {
        it('allows applying full available balance (month limit tracks available)', () => {
            expect(
                getAppliableDaysThisMonth({
                    availableBalance: 6,
                    maxDaysPerMonth: 2,
                    usedThisMonth: 0,
                })
            ).toBe(6);
        });

        it('detects monthly accrual from accrual.amount', () => {
            expect(hasMonthlyEntitlement(casualType)).toBe(true);
            expect(usesMonthlyAccrual(casualType)).toBe(true);
        });

        it('computes remaining monthly take cap from available when provided', () => {
            expect(getRemainingMonthlyTakeCap(2, 0.5, 3)).toBe(3);
            expect(getRemainingMonthlyTakeCap(2, 0.5)).toBe(1.5);
        });
    });

    describe('fixed yearly leave type (standard policy model)', () => {
        const fixedYearlyCasual = {
            type: 'casual',
            enabled: true,
            accrual: { method: 'fixed', frequency: 'yearly', maxAccrual: 6, amount: 0.5 },
            maxDaysPerMonth: 0.5,
        };

        const fixedYearlyPaid = {
            type: 'paid',
            enabled: true,
            accrual: { method: 'fixed', frequency: 'yearly', maxAccrual: 12, amount: 1 },
            maxDaysPerMonth: 1,
        };

        it('reads Amount as annual and Monthly Entitlement as monthly accrual', () => {
            expect(getAnnualEntitlementAmount(fixedYearlyCasual)).toBe(6);
            expect(getPolicyMonthlyAccrualAmount(fixedYearlyCasual)).toBe(0.5);
            expect(getAnnualEntitlementAmount(fixedYearlyPaid)).toBe(12);
            expect(getPolicyMonthlyAccrualAmount(fixedYearlyPaid)).toBe(1);
        });

        it('sums policy totals for leave summary', () => {
            expect(sumPolicyAnnualEntitlement({ leaveTypes: [fixedYearlyCasual, fixedYearlyPaid] })).toBe(18);
            expect(sumPolicyMonthlyAccrual({ leaveTypes: [fixedYearlyCasual, fixedYearlyPaid] })).toBe(1.5);
        });

        it('validates monthly × 12 ≤ annual', () => {
            expect(validateLeaveTypeAccrual(fixedYearlyCasual)).toEqual([]);
            expect(validateLeaveTypeAccrual(fixedYearlyPaid)).toEqual([]);
        });

        it('syncs maxDaysPerMonth from monthly entitlement on normalize', () => {
            const normalized = normalizePolicyLeaveTypes([fixedYearlyCasual])[0];
            expect(normalized.maxDaysPerMonth).toBe(0.5);
            expect(normalized.accrual.maxAccrual).toBe(6);
            expect(normalized.accrual.amount).toBe(0.5);
        });
    });

    describe('leave summary policy totals', () => {
        it('sums annual entitlement across all enabled leave types', () => {
            expect(sumPolicyAnnualEntitlement({ leaveTypes: [casualType, sickType] })).toBe(18);
        });

        it('sums monthly accrual across enabled leave types', () => {
            expect(sumPolicyMonthlyAccrual({ leaveTypes: [casualType, sickType] })).toBe(1.5);
        });

        it('returns policy monthly accrual for view month, not accumulated balance', () => {
            const employee = { joiningDate: new Date('2025-07-01') };
            expect(
                sumPolicyMonthlyAccrualForViewMonth(
                    { leaveTypes: [casualType] },
                    employee,
                    2026,
                    4
                )
            ).toBe(0.5);
        });

        it('returns zero monthly accrual before join month', () => {
            const employee = { joiningDate: new Date('2026-05-01') };
            expect(
                sumPolicyMonthlyAccrualForViewMonth(
                    { leaveTypes: [casualType] },
                    employee,
                    2026,
                    4
                )
            ).toBe(0);
        });

        it('with cutoff 15, returns zero for join month when joining after the 15th', () => {
            const employee = { joiningDate: new Date(2026, 8, 28) }; // 28 Sep
            const policy = {
                leaveTypes: [casualType],
                leaveCycle: { startMonth: 1, endMonth: 12, joinAccrualCutoffDay: 15 },
            };
            expect(sumPolicyMonthlyAccrualForViewMonth(policy, employee, 2026, 9)).toBe(0);
            expect(sumPolicyMonthlyAccrualForViewMonth(policy, employee, 2026, 10)).toBe(0.5);
        });
    });

    describe('joinAccrualCutoffDay', () => {
        it('defaults cutoff to 31', () => {
            expect(getJoinAccrualCutoffDay({})).toBe(31);
            expect(getJoinAccrualCutoffDay(null)).toBe(31);
        });

        it('normalizes leave cycle with cutoff', () => {
            expect(normalizeLeaveCycle({ joinAccrualCutoffDay: 15 })).toEqual({
                startMonth: 1,
                endMonth: 12,
                joinAccrualCutoffDay: 15,
            });
        });

        it('maps join after cutoff to next month', () => {
            expect(getFirstAccrualCalendarMonth(new Date(2026, 8, 28), 15)).toEqual({
                year: 2026,
                monthIndex: 9,
            });
            expect(getFirstAccrualCalendarMonth(new Date(2026, 11, 20), 15)).toEqual({
                year: 2027,
                monthIndex: 0,
            });
        });

        it('maps join on/before cutoff to join month', () => {
            expect(getFirstAccrualCalendarMonth(new Date(2026, 8, 15), 15)).toEqual({
                year: 2026,
                monthIndex: 8,
            });
            expect(getFirstAccrualCalendarMonth(new Date(2026, 8, 1), 15)).toEqual({
                year: 2026,
                monthIndex: 8,
            });
        });

        it('rejects invalid cutoff in policy validation', () => {
            const errors = validateLeavePolicyAccrual({
                leaveCycle: { startMonth: 1, endMonth: 12, joinAccrualCutoffDay: 40 },
                leaveTypes: [casualType],
            });
            expect(errors.some((e) => /cutoff/i.test(e))).toBe(true);
        });
    });
});
