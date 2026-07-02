import {
    getEmployeeLeaveYearBounds,
    clampLeaveViewPeriod,
    clampLeavePeriodStart,
    isLeaveYearAllowed,
    buildYearRange,
} from '../../helpers/leaveYearBoundsHelper.js';
import { LEAVE_HISTORY_MIN_YEAR } from '../../constants/leaveDefaults.js';

describe('leaveYearBoundsHelper', () => {
    const ref = new Date('2026-07-15T12:00:00');

    test('selectable years run from 2016 through current year', () => {
        const bounds = getEmployeeLeaveYearBounds({ joiningDate: new Date('2023-04-10') }, ref);
        expect(bounds.minYear).toBe(2016);
        expect(bounds.maxYear).toBe(2026);
        expect(buildYearRange(bounds.minYear, bounds.maxYear)).toEqual([
            2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026,
        ]);
    });

    test('allows years before employee joining in selector', () => {
        const bounds = getEmployeeLeaveYearBounds({ joiningDate: new Date('2023-06-01') }, ref);
        expect(isLeaveYearAllowed(2018, bounds)).toBe(true);
        expect(isLeaveYearAllowed(2015, bounds)).toBe(false);
    });

    test('clamps view to all months except future in current year', () => {
        const bounds = getEmployeeLeaveYearBounds({ joiningDate: new Date('2023-06-01') }, ref);
        const past = clampLeaveViewPeriod(2020, 3, bounds);
        expect(past).toEqual({ year: 2020, month: 3, clamped: false });
        const future = clampLeaveViewPeriod(2026, 12, bounds);
        expect(future).toEqual({ year: 2026, month: 7, clamped: true });
    });

    test('recalc start defaults to January 2016', () => {
        const bounds = getEmployeeLeaveYearBounds({ joiningDate: new Date('2023-06-01') }, ref);
        const result = clampLeavePeriodStart(2010, 1, bounds);
        expect(result).toEqual({ year: LEAVE_HISTORY_MIN_YEAR, month: 1, clamped: true });
    });
});
