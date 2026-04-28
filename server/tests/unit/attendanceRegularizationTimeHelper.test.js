import { describe, it, expect } from '@jest/globals';
import {
    harmonizeRegularizationRequestedTimes,
    ensureClockOutAfterClockIn,
    addCalendarDays
} from '../../helpers/attendanceRegularizationTimeHelper.js';

describe('attendanceRegularizationTimeHelper', () => {
    it('rolls clock-out to next day when out is before in (night shift)', () => {
        const attendanceDate = new Date('2026-04-27T00:00:00');
        const clockIn = new Date('2026-04-27T15:11:00');
        const clockOut = new Date('2026-04-27T06:00:00');
        const { clockIn: ci, clockOut: co } = harmonizeRegularizationRequestedTimes({
            attendanceDate,
            clockIn,
            clockOut,
            clockOutNextDay: false
        });
        expect(co.getTime()).toBeGreaterThan(ci.getTime());
        expect(co.getDate()).toBe(clockOut.getDate() + 1);
    });

    it('honors explicit clockOutNextDay before auto roll', () => {
        const attendanceDate = new Date('2026-04-27T00:00:00');
        const clockIn = new Date('2026-04-27T22:00:00');
        const clockOut = new Date('2026-04-27T06:00:00');
        const { clockOut: co } = harmonizeRegularizationRequestedTimes({
            attendanceDate,
            clockIn,
            clockOut,
            clockOutNextDay: true
        });
        expect(co.getHours()).toBe(6);
        expect(co.getDate()).toBe(clockOut.getDate() + 1);
    });

    it('ensureClockOutAfterClockIn fixes legacy inverted pair', () => {
        const ci = new Date('2026-04-27T15:11:00');
        const co = new Date('2026-04-27T06:00:00');
        const fixed = ensureClockOutAfterClockIn(ci, co);
        expect(fixed.clockOutTime.getTime()).toBeGreaterThan(fixed.clockInTime.getTime());
    });

    it('addCalendarDays adds one calendar day', () => {
        const d = new Date('2026-04-27T12:00:00');
        const next = addCalendarDays(d, 1);
        expect(next.getDate()).toBe(28);
    });
});
