import { describe, it, expect } from '@jest/globals';
import {
    daysSinceJoiningOn,
    isLifecycleProbationBlocking,
    resolveLeaveProbationWindow,
    evaluateLeaveProbationRestriction,
} from '../../helpers/leaveProbationHelper.js';

describe('leaveProbationHelper', () => {
    const join = new Date(2026, 0, 1); // 1 Jan 2026

    describe('isLifecycleProbationBlocking', () => {
        it('blocks only Active and Extended', () => {
            expect(isLifecycleProbationBlocking('Active')).toBe(true);
            expect(isLifecycleProbationBlocking('Extended')).toBe(true);
            expect(isLifecycleProbationBlocking('Confirmed')).toBe(false);
            expect(isLifecycleProbationBlocking('Waived')).toBe(false);
            expect(isLifecycleProbationBlocking(null)).toBe(false);
        });
    });

    describe('daysSinceJoiningOn', () => {
        it('counts whole days from joining', () => {
            expect(daysSinceJoiningOn(join, new Date(2026, 0, 1))).toBe(0);
            expect(daysSinceJoiningOn(join, new Date(2026, 0, 31))).toBe(30);
            expect(daysSinceJoiningOn(null)).toBeNull();
        });
    });

    describe('resolveLeaveProbationWindow', () => {
        it('uses tenure only when no lifecycle', () => {
            expect(
                resolveLeaveProbationWindow({
                    daysSinceJoining: 50,
                    minServiceDays: 180,
                    lifecycleProbationStatus: null,
                }).inProbation
            ).toBe(true);
            expect(
                resolveLeaveProbationWindow({
                    daysSinceJoining: 180,
                    minServiceDays: 180,
                    lifecycleProbationStatus: null,
                }).inProbation
            ).toBe(false);
        });

        it('keeps probation when Lifecycle is Extended past tenure', () => {
            const result = resolveLeaveProbationWindow({
                daysSinceJoining: 200,
                minServiceDays: 180,
                lifecycleProbationStatus: 'Extended',
            });
            expect(result.inProbation).toBe(true);
            expect(result.lifecycleBlocks).toBe(true);
            expect(result.withinTenure).toBe(false);
        });

        it('ignores Confirmed lifecycle and uses tenure only', () => {
            expect(
                resolveLeaveProbationWindow({
                    daysSinceJoining: 200,
                    minServiceDays: 180,
                    lifecycleProbationStatus: 'Confirmed',
                }).inProbation
            ).toBe(false);
        });
    });

    describe('evaluateLeaveProbationRestriction', () => {
        it('requires joining date', () => {
            const result = evaluateLeaveProbationRestriction({
                joiningDate: null,
                minServiceDays: 90,
            });
            expect(result.allowed).toBe(false);
        });

        it('allows full leave after tenure with no lifecycle', () => {
            const result = evaluateLeaveProbationRestriction({
                joiningDate: join,
                minServiceDays: 90,
                maxDaysDuringProbation: 0,
                lifecycleProbationStatus: null,
                usedDays: 0,
                requestedDays: 1,
                asOfDate: new Date(2026, 4, 1), // ~120 days
            });
            expect(result.allowed).toBe(true);
            expect(result.inProbation).toBe(false);
        });

        it('blocks all leave during probation when max is 0', () => {
            const result = evaluateLeaveProbationRestriction({
                joiningDate: join,
                minServiceDays: 180,
                maxDaysDuringProbation: 0,
                usedDays: 0,
                requestedDays: 1,
                asOfDate: new Date(2026, 1, 1),
                leaveTypeLabel: 'Casual Leave',
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/not allowed during probation/i);
        });

        it('allows up to maxDaysDuringProbation total while in tenure window', () => {
            const ok = evaluateLeaveProbationRestriction({
                joiningDate: join,
                minServiceDays: 180,
                maxDaysDuringProbation: 2,
                usedDays: 1,
                requestedDays: 1,
                asOfDate: new Date(2026, 1, 1),
            });
            expect(ok.allowed).toBe(true);

            const over = evaluateLeaveProbationRestriction({
                joiningDate: join,
                minServiceDays: 180,
                maxDaysDuringProbation: 2,
                usedDays: 1.5,
                requestedDays: 1,
                asOfDate: new Date(2026, 1, 1),
            });
            expect(over.allowed).toBe(false);
            expect(over.reason).toMatch(/maximum 2/i);
        });

        it('still caps after 180 days when Lifecycle Extended', () => {
            const result = evaluateLeaveProbationRestriction({
                joiningDate: join,
                minServiceDays: 180,
                maxDaysDuringProbation: 2,
                lifecycleProbationStatus: 'Extended',
                usedDays: 2,
                requestedDays: 0.5,
                asOfDate: new Date(2026, 7, 1), // past 180 days
            });
            expect(result.inProbation).toBe(true);
            expect(result.allowed).toBe(false);
        });

        it('does not use lifecycle when missing (non-onboarded employee)', () => {
            const result = evaluateLeaveProbationRestriction({
                joiningDate: join,
                minServiceDays: 90,
                maxDaysDuringProbation: 0,
                lifecycleProbationStatus: null,
                usedDays: 0,
                requestedDays: 1,
                asOfDate: new Date(2026, 4, 1),
            });
            expect(result.allowed).toBe(true);
            expect(result.inProbation).toBe(false);
        });
    });
});
