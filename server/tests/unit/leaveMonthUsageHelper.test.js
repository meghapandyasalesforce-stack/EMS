import { describe, it, expect } from '@jest/globals';
import {
    allocateLeaveDurationAcrossMonths,
    countPolicyLeaveDays,
} from '../../helpers/leaveMonthUsageHelper.js';

const weekdayCalendar = {
    workingDays: {
        sunday: false,
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
    },
    holidays: [],
};

describe('leaveMonthUsageHelper', () => {
    it('keeps a same-month leave entirely in that month', () => {
        const slices = allocateLeaveDurationAcrossMonths(
            {
                startDate: new Date(2026, 2, 3),
                endDate: new Date(2026, 2, 5),
                duration: 3,
            },
            { calendarsByYear: new Map([[2026, weekdayCalendar]]) }
        );

        expect(slices.get('2026-2')).toBe(3);
        expect(slices.size).toBe(1);
    });

    it('keeps a half-day on one date as 0.5 in that month', () => {
        const slices = allocateLeaveDurationAcrossMonths(
            {
                startDate: new Date(2026, 2, 10),
                endDate: new Date(2026, 2, 10),
                duration: 0.5,
                isHalfDay: true,
            },
            { calendarsByYear: new Map([[2026, weekdayCalendar]]) }
        );

        expect(slices.get('2026-2')).toBe(0.5);
        expect(slices.size).toBe(1);
    });

    it('splits a leave that crosses into the next month by working days', () => {
        // Thu 29 Jan, Fri 30 Jan, Mon 2 Feb. Weekend is not counted.
        const start = new Date(2026, 0, 29);
        const end = new Date(2026, 1, 2);
        const calendarsByYear = new Map([[2026, weekdayCalendar]]);
        const total = countPolicyLeaveDays(start, end, {}, calendarsByYear);
        expect(total).toBe(3);

        const slices = allocateLeaveDurationAcrossMonths(
            { startDate: start, endDate: end, duration: 3 },
            { calendarsByYear }
        );

        expect(slices.get('2026-0')).toBe(2);
        expect(slices.get('2026-1')).toBe(1);
        expect((slices.get('2026-0') || 0) + (slices.get('2026-1') || 0)).toBe(3);
    });

    it('splits a December leave into January of the next year', () => {
        // Wed 30 Dec 2026, Thu 31 Dec, Fri 1 Jan 2027.
        const start = new Date(2026, 11, 30);
        const end = new Date(2027, 0, 1);
        const calendarsByYear = new Map([
            [2026, weekdayCalendar],
            [2027, weekdayCalendar],
        ]);

        const slices = allocateLeaveDurationAcrossMonths(
            { startDate: start, endDate: end, duration: 3 },
            { calendarsByYear }
        );

        expect(slices.get('2026-11')).toBe(2);
        expect(slices.get('2027-0')).toBe(1);
    });

    it('does not count a holiday as a leave day when splitting', () => {
        const calendar = {
            ...weekdayCalendar,
            holidays: [{ date: new Date(2026, 0, 30), isActive: true, name: 'Holiday' }],
        };
        const slices = allocateLeaveDurationAcrossMonths(
            {
                startDate: new Date(2026, 0, 29),
                endDate: new Date(2026, 1, 2),
                duration: 2,
            },
            {
                dateHandlingRules: { countWeekends: false, countHolidays: false },
                calendarsByYear: new Map([[2026, calendar]]),
            }
        );

        // Thu 29 Jan counts, Fri 30 Jan is a holiday, Mon 2 Feb counts.
        expect(slices.get('2026-0')).toBe(1);
        expect(slices.get('2026-1')).toBe(1);
    });
});
