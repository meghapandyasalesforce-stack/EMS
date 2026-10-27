import { describe, it, expect } from '@jest/globals';
import { hoursBetween, creditFromHourTotal, allocateCompOffUsage, compensatoryLeaveDays } from '../../helpers/compOffCreditHelper.js';

describe('compOffCreditHelper', () => {
    it('counts hours on the same day and across midnight', () => {
        expect(hoursBetween('21:00', '23:00')).toBe(2);
        expect(hoursBetween('20:00', '02:00')).toBe(6);
        expect(hoursBetween('23:00', '00:00')).toBe(1);
        expect(hoursBetween('22:30', '01:15')).toBe(2.75);
        expect(hoursBetween('23:00', '21:00')).toBe(22);
        expect(hoursBetween('21:00', '21:00')).toBe(0);
    });

    it('uses approved compensatory leave against the oldest credit first', () => {
        expect(compensatoryLeaveDays({ isHalfDay: true, duration: 1 })).toBe(0.5);
        expect(compensatoryLeaveDays({ workingDays: 2, duration: 2 })).toBe(2);

        const credits = [
            { id: 'oct2', workDateKey: '2026-10-02', creditDays: 0.1 },
            { id: 'oct7', workDateKey: '2026-10-07', creditDays: 0.4 },
        ];
        const halfDay = allocateCompOffUsage(credits, [
            { id: 'leave-1', isHalfDay: true, startDate: '2026-10-28', approvedAt: '2026-10-27' },
        ]);
        expect(halfDay).toEqual([
            { id: 'oct2', usedDays: 0.1, isUsed: true, usedAt: '2026-10-27', usedInLeave: 'leave-1' },
            { id: 'oct7', usedDays: 0.4, isUsed: true, usedAt: '2026-10-27', usedInLeave: 'leave-1' },
        ]);

        const partial = allocateCompOffUsage(
            [{ id: 'full', workDateKey: '2026-10-02', creditDays: 1 }],
            [{ id: 'leave-2', isHalfDay: true, approvedAt: '2026-10-27' }]
        );
        expect(partial[0]).toMatchObject({ usedDays: 0.5, isUsed: false, usedInLeave: 'leave-2' });
    });

    it('turns 4 hours into half a day and 8 into a full day', () => {
        expect(creditFromHourTotal(2)).toEqual({ creditDays: 0, consumeHours: 0 });
        expect(creditFromHourTotal(4)).toEqual({ creditDays: 0.5, consumeHours: 4 });
        expect(creditFromHourTotal(6)).toEqual({ creditDays: 0.5, consumeHours: 4 });
        expect(creditFromHourTotal(8)).toEqual({ creditDays: 1, consumeHours: 8 });
        expect(creditFromHourTotal(10)).toEqual({ creditDays: 1, consumeHours: 8 });
        expect(creditFromHourTotal(12)).toEqual({ creditDays: 1.5, consumeHours: 12 });
    });
});
