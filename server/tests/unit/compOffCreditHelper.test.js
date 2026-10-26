import { describe, it, expect } from '@jest/globals';
import { hoursBetween, creditFromHourTotal } from '../../helpers/compOffCreditHelper.js';

describe('compOffCreditHelper', () => {
    it('counts hours between two times on the same day', () => {
        expect(hoursBetween('21:00', '23:00')).toBe(2);
        expect(hoursBetween('23:00', '21:00')).toBe(0);
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
