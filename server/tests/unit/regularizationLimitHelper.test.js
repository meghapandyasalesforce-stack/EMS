import { describe, it, expect } from '@jest/globals';
import {
    resolveRegularizationRules,
    getMonthBounds,
    normalizeRegularizationRulesInput,
    MAX_REGULARIZATION_PER_MONTH
} from '../../helpers/regularizationLimitHelper.js';
import {
    getMonthBoundsInTimezone,
    isSameCalendarMonthInTimezone
} from '../../helpers/timezoneHelper.js';

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

    it('normalizeRegularizationRulesInput accepts valid config', () => {
        expect(
            normalizeRegularizationRulesInput({ enabled: true, allowedPerMonth: 10 })
        ).toEqual({ enabled: true, allowedPerMonth: 10 });
        expect(
            normalizeRegularizationRulesInput({ enabled: false, allowedPerMonth: 0 })
        ).toEqual({ enabled: false, allowedPerMonth: 0 });
    });

    it('normalizeRegularizationRulesInput rejects out-of-range values', () => {
        expect(() =>
            normalizeRegularizationRulesInput({ enabled: true, allowedPerMonth: 32 })
        ).toThrow(`allowedPerMonth must be an integer from 0 to ${MAX_REGULARIZATION_PER_MONTH}`);

        expect(() =>
            normalizeRegularizationRulesInput({ enabled: true, allowedPerMonth: -1 })
        ).toThrow(`allowedPerMonth must be an integer from 0 to ${MAX_REGULARIZATION_PER_MONTH}`);
    });
});

describe('timezoneHelper month boundaries', () => {
    it('getMonthBoundsInTimezone uses org timezone calendar month', () => {
        const reference = new Date('2026-06-17T12:00:00.000Z');
        const { monthStart, nextMonthStart } = getMonthBoundsInTimezone(reference, 'Asia/Kolkata');

        expect(monthStart.toISOString()).toBe('2026-05-31T18:30:00.000Z');
        expect(nextMonthStart.toISOString()).toBe('2026-06-30T18:30:00.000Z');
    });

    it('isSameCalendarMonthInTimezone compares months in timezone', () => {
        const earlyUtc = new Date('2026-03-31T20:00:00.000Z');
        const lateUtc = new Date('2026-04-01T04:00:00.000Z');

        expect(isSameCalendarMonthInTimezone(earlyUtc, lateUtc, 'UTC')).toBe(false);
        expect(isSameCalendarMonthInTimezone(earlyUtc, lateUtc, 'Asia/Kolkata')).toBe(true);
    });
});
