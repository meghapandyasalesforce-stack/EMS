import { describe, it, expect } from '@jest/globals';
import {
    isLifecycleProbationBlocking,
    buildLeaveProbationContext,
    isOnProbationAsOf,
    isProbationAccrualMonth,
    applyProbationAccrualOverlay,
    evaluateLeaveProbationRestriction,
    normalizeProbationRestrictions,
} from '../../helpers/leaveProbationHelper.js';

describe('leaveProbationHelper', () => {
    const join = new Date(2026, 0, 1);

    describe('isLifecycleProbationBlocking', () => {
        it('blocks only Active and Extended', () => {
            expect(isLifecycleProbationBlocking('Active')).toBe(true);
            expect(isLifecycleProbationBlocking('Extended')).toBe(true);
            expect(isLifecycleProbationBlocking('Confirmed')).toBe(false);
            expect(isLifecycleProbationBlocking('Waived')).toBe(false);
            expect(isLifecycleProbationBlocking(null)).toBe(false);
        });
    });

    describe('isOnProbationAsOf / month-1st switch', () => {
        it('keeps June on probation when confirmed mid-June; July is normal', () => {
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join },
                lifecycleProbation: {
                    status: 'Confirmed',
                    startDate: join,
                    confirmedAt: new Date(2026, 5, 15),
                },
            });
            expect(isOnProbationAsOf(ctx, new Date(2026, 5, 1))).toBe(true);
            expect(isProbationAccrualMonth(ctx, 2026, 5)).toBe(true);
            expect(isOnProbationAsOf(ctx, new Date(2026, 5, 15))).toBe(false);
            expect(isOnProbationAsOf(ctx, new Date(2026, 6, 1))).toBe(false);
            expect(isProbationAccrualMonth(ctx, 2026, 6)).toBe(false);
        });

        it('uses employee.probation when Lifecycle is absent', () => {
            const ctx = buildLeaveProbationContext({
                employee: {
                    joiningDate: join,
                    probation: { status: 'Active', startDate: join },
                },
                lifecycleProbation: null,
            });
            expect(isOnProbationAsOf(ctx, new Date(2026, 2, 1))).toBe(true);
        });

        it('prefers Lifecycle over employee fallback', () => {
            const ctx = buildLeaveProbationContext({
                employee: {
                    joiningDate: join,
                    probation: { status: 'Active', startDate: join },
                },
                lifecycleProbation: {
                    status: 'Confirmed',
                    confirmedAt: new Date(2026, 1, 1),
                },
            });
            expect(isOnProbationAsOf(ctx, new Date(2026, 3, 1))).toBe(false);
        });
    });

    describe('applyProbationAccrualOverlay', () => {
        const base = {
            type: 'casual',
            enabled: true,
            accrual: { method: 'fixed', frequency: 'yearly', amount: 1, maxAccrual: 12 },
            maxDaysPerMonth: 1,
            probationRestrictions: {
                enabled: true,
                allowLeave: true,
                accrual: { method: 'fixed', frequency: 'monthly', amount: 0.5, maxAccrual: 6 },
            },
        };

        it('applies monthly probation rates while on probation', () => {
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join },
                lifecycleProbation: { status: 'Active', startDate: join },
            });
            const overlay = applyProbationAccrualOverlay(base, ctx, new Date(2026, 2, 1));
            expect(overlay._probationOverlay).toBe(true);
            expect(overlay.accrual.amount).toBe(0.5);
            expect(overlay.accrual.maxAccrual).toBe(6);
        });

        it('returns normal config after confirmation month', () => {
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join },
                lifecycleProbation: {
                    status: 'Confirmed',
                    confirmedAt: new Date(2026, 5, 15),
                },
            });
            const overlay = applyProbationAccrualOverlay(base, ctx, new Date(2026, 6, 1));
            expect(overlay._probationOverlay).toBeUndefined();
            expect(overlay.accrual.amount).toBe(1);
        });

        it('encodes yearly probation as capped lump for monthly engine', () => {
            const yearlyType = {
                ...base,
                probationRestrictions: {
                    enabled: true,
                    allowLeave: true,
                    accrual: { method: 'yearly', frequency: 'yearly', amount: 0, maxAccrual: 2 },
                },
            };
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join },
                lifecycleProbation: { status: 'Active', startDate: join },
            });
            const overlay = applyProbationAccrualOverlay(yearlyType, ctx, new Date(2026, 0, 1));
            expect(overlay.accrual.amount).toBe(2);
            expect(overlay.accrual.maxAccrual).toBe(2);
            expect(overlay._probationFrequency).toBe('yearly');
        });
    });

    describe('evaluateLeaveProbationRestriction', () => {
        it('blocks when allowLeave is false while on probation', () => {
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join },
                lifecycleProbation: { status: 'Active', startDate: join },
            });
            const result = evaluateLeaveProbationRestriction({
                probationContext: ctx,
                allowLeave: false,
                asOfDate: new Date(2026, 1, 1),
                leaveTypeLabel: 'Casual Leave',
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/not allowed during probation/i);
        });

        it('allows leave during probation when allowLeave is true', () => {
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join },
                lifecycleProbation: { status: 'Extended', startDate: join },
            });
            const result = evaluateLeaveProbationRestriction({
                probationContext: ctx,
                allowLeave: true,
                asOfDate: new Date(2026, 1, 1),
            });
            expect(result.allowed).toBe(true);
            expect(result.inProbation).toBe(true);
        });

        it('does not restrict when not on probation', () => {
            const ctx = buildLeaveProbationContext({
                employee: { joiningDate: join, probation: { status: 'None' } },
                lifecycleProbation: null,
            });
            const result = evaluateLeaveProbationRestriction({
                probationContext: ctx,
                allowLeave: false,
                asOfDate: new Date(2026, 4, 1),
            });
            expect(result.allowed).toBe(true);
            expect(result.inProbation).toBe(false);
        });
    });

    describe('normalizeProbationRestrictions', () => {
        it('migrates legacy maxDaysDuringProbation 0 to allowLeave false', () => {
            const result = normalizeProbationRestrictions({
                enabled: true,
                maxDaysDuringProbation: 0,
            });
            expect(result.enabled).toBe(true);
            expect(result.allowLeave).toBe(false);
        });

        it('migrates legacy positive max to yearly accrual', () => {
            const result = normalizeProbationRestrictions({
                enabled: true,
                maxDaysDuringProbation: 2,
            });
            expect(result.allowLeave).toBe(true);
            expect(result.accrual.frequency).toBe('yearly');
            expect(result.accrual.maxAccrual).toBe(2);
        });
    });
});
