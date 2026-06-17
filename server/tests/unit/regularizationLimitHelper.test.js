import { describe, it, expect } from '@jest/globals';
import {
    resolveRegularizationRules,
    getMonthBounds
} from '../../helpers/regularizationLimitHelper.js';

describe('regularizationLimitHelper', () => {
    it('resolveRegularizationRules uses defaults when rule is missing', () => {
        expect(resolveRegularizationRules(null)).toEqual({
            enabled: true,
            allowedPerMonth: 5
        });
    });

    it('resolveRegularizationRules reads attendance rule config', () => {
        expect(
            resolveRegularizationRules({
                regularizationRules: { enabled: false, allowedPerMonth: 3 }
            })
        ).toEqual({
            enabled: false,
            allowedPerMonth: 3
        });
    });

    it('resolveRegularizationRules treats allowedPerMonth 0 as unlimited', () => {
        expect(
            resolveRegularizationRules({
                regularizationRules: { enabled: true, allowedPerMonth: 0 }
            }).allowedPerMonth
        ).toBe(0);
    });

    it('getMonthBounds returns local month start and next month start', () => {
        const reference = new Date(2026, 5, 17);
        const { monthStart, nextMonthStart } = getMonthBounds(reference);

        expect(monthStart).toEqual(new Date(2026, 5, 1));
        expect(nextMonthStart).toEqual(new Date(2026, 6, 1));
    });
});
