import { describe, it, expect } from '@jest/globals';
import { getDateKeyInTimezone } from '../../helpers/timezoneHelper.js';
import { DateTime } from 'luxon';
import {
    DEFAULT_OVERTIME_RATE,
    countCalendarDaysInclusive,
    countCalendarDaysInDateKeyRange,
    countWorkingDaysInclusive,
    countWorkingDaysInDateKeyRange,
    leaveWorkingDaysInRange,
    buildIsWorkingDayFn,
    buildIsWorkingDayKeyFn,
    attendanceDayCredit,
    buildAttendanceCreditByDay,
    buildPaidLeaveByDayMap,
    sumEffectivePresentDays,
    sumEffectivePresentDaysByKeys,
    computePayrollProration,
    resolvePayrollServiceDateKeys,
    resolvePayslipSalaryPaidDays,
    attendanceDayCreditDayBased
} from '../../helpers/payrollGenerationHelper.js';

const TZ = 'Asia/Kolkata';
const dayKey = (date) => getDateKeyInTimezone(date, TZ);

/** Mon–Fri working-day predicate (no calendar doc). */
const monFriFn = (date) => {
    const d = date.getDay();
    return d !== 0 && d !== 6;
};

describe('payrollGenerationHelper', () => {
    describe('countCalendarDaysInclusive', () => {
        it('counts all days in June 2026', () => {
            const start = new Date(2026, 5, 1);
            const end = new Date(2026, 5, 30);
            expect(countCalendarDaysInclusive(start, end)).toBe(30);
        });

        it('returns 0 for inverted range', () => {
            expect(countCalendarDaysInclusive(new Date(2026, 5, 10), new Date(2026, 5, 1))).toBe(0);
        });
    });

    describe('countWorkingDaysInclusive', () => {
        it('counts Mon–Fri in a week', () => {
            const start = new Date(2026, 5, 1); // Mon
            const end = new Date(2026, 5, 7); // Sun
            expect(countWorkingDaysInclusive(start, end, monFriFn)).toBe(5);
        });

        it('excludes holidays from org calendar', () => {
            const calendar = {
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                holidays: [{ date: new Date(2026, 5, 15), isActive: true }] // Mon Jun 15
            };
            const isWorkingDayFn = buildIsWorkingDayFn(calendar, dayKey);
            const start = new Date(2026, 5, 1);
            const end = new Date(2026, 5, 30);
            const withHoliday = countWorkingDaysInclusive(start, end, isWorkingDayFn);
            const withoutHoliday = countWorkingDaysInclusive(start, end, monFriFn);
            expect(withHoliday).toBe(withoutHoliday - 1);
        });
    });

    describe('leaveWorkingDaysInRange', () => {
        it('counts only working days in leave span', () => {
            const leave = {
                startDate: new Date(2026, 5, 5), // Fri
                endDate: new Date(2026, 5, 8) // Mon
            };
            expect(leaveWorkingDaysInRange(leave, new Date(2026, 5, 1), new Date(2026, 5, 30), monFriFn)).toBe(2);
        });
    });

    describe('attendanceDayCredit', () => {
        it('returns 0 when hours are zero', () => {
            expect(attendanceDayCredit({ status: 'present', effectiveHours: 0, grossHours: 0 })).toBe(0);
        });

        it('returns fractional credit for partial hours', () => {
            expect(attendanceDayCredit({ status: 'present', effectiveHours: 4 })).toBe(0.5);
            expect(attendanceDayCredit({ status: 'present', effectiveHours: 8 })).toBe(1);
        });

        it('caps half-day status at 0.5', () => {
            expect(attendanceDayCredit({ status: 'half-day', effectiveHours: 6 })).toBe(0.5);
        });
    });

    describe('attendanceDayCreditDayBased', () => {
        it('requires clockOut and meets full-day hours', () => {
            expect(
                attendanceDayCreditDayBased(
                    { status: 'loggedOut', effectiveHours: 8 },
                    8,
                    4
                )
            ).toBe(0);
            expect(
                attendanceDayCreditDayBased(
                    { status: 'loggedOut', clockOut: new Date(), effectiveHours: 8 },
                    8,
                    4
                )
            ).toBe(1);
        });

        it('returns half day for partial hours', () => {
            expect(
                attendanceDayCreditDayBased(
                    { status: 'loggedOut', clockOut: new Date(), effectiveHours: 5 },
                    8,
                    4
                )
            ).toBe(0.5);
        });

        it('caps late arrival at 0.5 when markHalfDayIfLate is enabled', () => {
            expect(
                attendanceDayCreditDayBased(
                    {
                        status: 'loggedOut',
                        clockOut: new Date(),
                        effectiveHours: 9,
                        isLateArrival: true
                    },
                    8,
                    4,
                    { markHalfDayIfLate: true }
                )
            ).toBe(0.5);
        });

        it('does not cap late arrival when markHalfDayIfLate is off', () => {
            expect(
                attendanceDayCreditDayBased(
                    {
                        status: 'loggedOut',
                        clockOut: new Date(),
                        effectiveHours: 9,
                        isLateArrival: true
                    },
                    8,
                    4,
                    { markHalfDayIfLate: false }
                )
            ).toBe(1);
        });
    });

    describe('buildPaidLeaveByDayMap', () => {
        const effStart = new Date(2026, 5, 1);
        const effEnd = new Date(2026, 5, 30);

        it('credits full paid leave on each overlapping working day', () => {
            const leaves = [{
                leaveType: 'sick',
                startDate: new Date(2026, 5, 10),
                endDate: new Date(2026, 5, 10)
            }];
            const map = buildPaidLeaveByDayMap(leaves, effStart, effEnd, monFriFn, dayKey);
            expect(map.get(dayKey(new Date(2026, 5, 10)))).toBe(1);
        });

        it('credits 0.5 on first overlapping working day for half-day leave', () => {
            const leaves = [{
                leaveType: 'casual',
                isHalfDay: true,
                duration: 0.5,
                startDate: new Date(2026, 5, 9),
                endDate: new Date(2026, 5, 11)
            }];
            const map = buildPaidLeaveByDayMap(leaves, effStart, effEnd, monFriFn, dayKey);
            expect(map.get(dayKey(new Date(2026, 5, 9)))).toBe(0.5);
            expect(map.get(dayKey(new Date(2026, 5, 10)))).toBeUndefined();
        });

        it('skips loss_of_pay leaves', () => {
            const leaves = [{
                leaveType: 'loss_of_pay',
                startDate: new Date(2026, 5, 10),
                endDate: new Date(2026, 5, 10)
            }];
            const map = buildPaidLeaveByDayMap(leaves, effStart, effEnd, monFriFn, dayKey);
            expect(map.size).toBe(0);
        });
    });

    describe('sumEffectivePresentDays', () => {
        const effStart = new Date(2026, 5, 1);
        const effEnd = new Date(2026, 5, 7);

        it('combines attendance and leave credits capped at 1 per day', () => {
            const key = dayKey(new Date(2026, 5, 2)); // Tue
            const attByDay = new Map([[key, 0.5]]);
            const paidLeaveByDay = new Map([[key, 0.5]]);
            const total = sumEffectivePresentDays(
                effStart,
                effEnd,
                attByDay,
                paidLeaveByDay,
                monFriFn,
                dayKey
            );
            expect(total).toBe(1);
        });
    });

    describe('computePayrollProration', () => {
        it('deducts one unpaid working day from full-month salary', () => {
            const { effectiveGross, unpaidWorkingDays, paidPayrollDays } = computePayrollProration({
                fullGross: 30000,
                fullMonthCalDays: 30,
                serviceWindowCalDays: 30,
                attendanceWorkingDays: 22,
                effectivePresent: 21
            });
            expect(unpaidWorkingDays).toBe(1);
            expect(paidPayrollDays).toBe(29);
            expect(effectiveGross).toBe(29000);
        });

        it('does not reduce pay when all working days are covered', () => {
            const { effectiveGross, unpaidWorkingDays } = computePayrollProration({
                fullGross: 30000,
                fullMonthCalDays: 30,
                serviceWindowCalDays: 30,
                attendanceWorkingDays: 22,
                effectivePresent: 22
            });
            expect(unpaidWorkingDays).toBe(0);
            expect(effectiveGross).toBe(30000);
        });
    });

    describe('resolvePayslipSalaryPaidDays', () => {
        it('uses full calendar month minus unpaid leave', () => {
            const paid = resolvePayslipSalaryPaidDays({
                month: 'May',
                year: 2026,
                unpaidLeave: 2.39875,
                timezone: TZ
            });
            expect(paid).toBeCloseTo(28.60125, 5);
        });

        it('shortens service window for mid-month join', () => {
            const paid = resolvePayslipSalaryPaidDays({
                month: 'May',
                year: 2026,
                unpaidLeave: 1,
                joiningDate: new Date('2026-05-16T00:00:00+05:30'),
                timezone: TZ
            });
            // May 16–31 = 16 calendar days − 1 unpaid
            expect(paid).toBe(15);
        });
    });

    describe('attendance day key alignment', () => {
        it('uses attendanceDateKey when bucketing attendance rows', () => {
            const effStart = new Date(2026, 5, 1);
            const effEnd = new Date(2026, 5, 7);
            const attByDay = new Map();
            const record = {
                date: new Date('2026-06-02T18:30:00.000Z'),
                attendanceDateKey: '2026-06-03',
                status: 'present',
                effectiveHours: 8
            };
            const key = record.attendanceDateKey || dayKey(new Date(record.date));
            attByDay.set(key, Math.min(1, attendanceDayCredit(record)));
            const paidLeaveByDay = new Map();
            const total = sumEffectivePresentDays(
                effStart,
                effEnd,
                attByDay,
                paidLeaveByDay,
                monFriFn,
                dayKey
            );
            expect(attByDay.has('2026-06-03')).toBe(true);
            expect(total).toBeGreaterThanOrEqual(1);
        });

        it('credits IST Monday rows when date UTC instant falls on Sunday (SaaS timezone fix)', () => {
            const calendar = {
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                holidays: []
            };
            const isWorkingDayKeyFn = buildIsWorkingDayKeyFn(calendar, TZ, dayKey);
            const mondayRecord = {
                attendanceDateKey: '2026-06-01',
                date: new Date('2026-05-31T18:30:00.000Z'),
                status: 'loggedOut',
                effectiveHours: 9.26
            };
            const attByDay = buildAttendanceCreditByDay([mondayRecord], {
                dayKey,
                isWorkingDayKeyFn
            });
            expect(attByDay.get('2026-06-01')).toBe(1);

            const present = sumEffectivePresentDaysByKeys(
                '2026-06-01',
                '2026-06-07',
                attByDay,
                new Map(),
                TZ,
                isWorkingDayKeyFn
            );
            expect(present).toBeGreaterThanOrEqual(1);
        });

        it('counts 22 working days in June 2026 using org date keys', () => {
            const calendar = {
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                holidays: []
            };
            const isWorkingDayKeyFn = buildIsWorkingDayKeyFn(calendar, TZ, dayKey);
            expect(
                countWorkingDaysInDateKeyRange('2026-06-01', '2026-06-30', TZ, isWorkingDayKeyFn)
            ).toBe(22);
        });

        it('counts 21 Mon–Fri days in May 2026 (not 22 from next-month spill)', () => {
            const calendar = {
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                holidays: []
            };
            const isWorkingDayKeyFn = buildIsWorkingDayKeyFn(calendar, TZ, dayKey);
            const monthEndKey = DateTime.fromObject(
                { year: 2026, month: 5, day: 1 },
                { zone: TZ }
            )
                .endOf('month')
                .toFormat('yyyy-MM-dd');
            expect(monthEndKey).toBe('2026-05-31');
            expect(
                countWorkingDaysInDateKeyRange('2026-05-01', monthEndKey, TZ, isWorkingDayKeyFn)
            ).toBe(21);
            // Legacy server-local month-end can spill into June 1 in IST → wrongly 22.
            expect(
                countWorkingDaysInDateKeyRange('2026-05-01', '2026-06-01', TZ, isWorkingDayKeyFn)
            ).toBe(22);
        });

        it('counts 22 Mon–Fri days in April 2026 (not 23 from next-month spill)', () => {
            const calendar = {
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                holidays: []
            };
            const isWorkingDayKeyFn = buildIsWorkingDayKeyFn(calendar, TZ, dayKey);
            expect(
                countWorkingDaysInDateKeyRange('2026-04-01', '2026-04-30', TZ, isWorkingDayKeyFn)
            ).toBe(22);
        });
    });

    describe('resolvePayrollServiceDateKeys', () => {
        it('keeps full month when no join/termination', () => {
            expect(
                resolvePayrollServiceDateKeys({
                    monthStartKey: '2026-05-01',
                    monthEndKey: '2026-05-31',
                    timezone: TZ
                })
            ).toEqual({ effStartKey: '2026-05-01', effEndKey: '2026-05-31' });
        });

        it('clamps join and termination into the month', () => {
            expect(
                resolvePayrollServiceDateKeys({
                    monthStartKey: '2026-05-01',
                    monthEndKey: '2026-05-31',
                    joiningDate: '2026-05-10T00:00:00.000Z',
                    lastWorkingDate: '2026-05-20T00:00:00.000Z',
                    timezone: TZ
                })
            ).toEqual({ effStartKey: '2026-05-10', effEndKey: '2026-05-20' });
        });
    });

    describe('countCalendarDaysInDateKeyRange', () => {
        it('counts 31 days in May 2026', () => {
            expect(countCalendarDaysInDateKeyRange('2026-05-01', '2026-05-31', TZ)).toBe(31);
        });
    });

    describe('DEFAULT_OVERTIME_RATE', () => {
        it('is 1.5 to match salary structure default', () => {
            expect(DEFAULT_OVERTIME_RATE).toBe(1.5);
        });
    });
});
