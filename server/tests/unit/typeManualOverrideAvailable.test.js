import { describe, it, expect } from '@jest/globals';
import {
    typeManualOverrideAvailable,
    manualAvailableFromOverride,
    roundLeaveDays,
} from '../../helpers/leaveBalanceRulesHelper.js';

/**
 * Balance Adjustment (per leave type) contract:
 * - Client folds desired available into accrued: accrued = available + used
 * - carriedForward is last CF add for display/audit only
 * - available must NOT be accrued + carriedForward (that double-counts CF)
 */
describe('typeManualOverrideAvailable (per-type Balance Adjustment)', () => {
    it('does not add carriedForward on top of accrued (fixes CF double-count)', () => {
        // Jul joiner: 0.5 accrual + add CF 1 → client sends accrued=1.5, CF=1
        expect(
            typeManualOverrideAvailable({ accrued: 1.5, used: 0, pending: 0 })
        ).toBe(1.5);

        // Sick: 0.5 + CF 2 → accrued=2.5, CF=2 → available 2.5 (not 4.5)
        expect(
            typeManualOverrideAvailable({ accrued: 2.5, used: 0 })
        ).toBe(2.5);

        // Privileged: 0.5 + CF 3 → accrued=3.5 → available 3.5 (not 6.5)
        expect(
            typeManualOverrideAvailable({ accrued: 3.5, used: 0 })
        ).toBe(3.5);
    });

    it('matches the screenshot regression: total available 7.5 not 13.5', () => {
        const rows = [
            { accrued: 1.5, used: 0, carriedForward: 1 },
            { accrued: 2.5, used: 0, carriedForward: 2 },
            { accrued: 3.5, used: 0, carriedForward: 3 },
        ];

        const totalAvailable = roundLeaveDays(
            rows.reduce((sum, row) => sum + typeManualOverrideAvailable(row), 0)
        );
        const manualAdjustmentDisplay = roundLeaveDays(
            rows.reduce((sum, row) => sum + (Number(row.carriedForward) || 0), 0)
        );

        expect(totalAvailable).toBe(7.5);
        expect(manualAdjustmentDisplay).toBe(6);
        // Buggy formula that produced 13.5:
        const doubleCounted = roundLeaveDays(
            rows.reduce(
                (sum, row) =>
                    sum +
                    Math.max(0, (row.accrued || 0) + (row.carriedForward || 0) - (row.used || 0)),
                0
            )
        );
        expect(doubleCounted).toBe(13.5);
        expect(totalAvailable).not.toBe(doubleCounted);
    });

    it('subtracts used and pending from accrued only', () => {
        expect(
            typeManualOverrideAvailable({ accrued: 5, used: 1.5, pending: 0.5 })
        ).toBe(3);
    });

    it('never goes below zero', () => {
        expect(
            typeManualOverrideAvailable({ accrued: 1, used: 3, pending: 0 })
        ).toBe(0);
    });
});

describe('manualAvailableFromOverride (legacy wallet seed — additive CF)', () => {
    it('still treats wallet CF as an addend when available is omitted', () => {
        expect(
            manualAvailableFromOverride({
                accrued: 5,
                carriedForward: 10,
                used: 2,
            })
        ).toBe(13);
    });

    it('prefers explicit available when set', () => {
        expect(
            manualAvailableFromOverride({
                accrued: 5,
                carriedForward: 10,
                used: 2,
                available: 7.5,
            })
        ).toBe(7.5);
    });
});
