import { describe, it, expect } from '@jest/globals';
import { DateTime } from 'luxon';
import {
    MISSED_PUNCH_LOP_DAYS,
    MISSED_PUNCH_NOTICE_DAYS,
    buildMissedPunchReminderEmail,
    buildWorkingDayKeyFn,
    collectMissedPunchDateKeys,
    isMissedPunchReminderSendHour,
    resolveMissedPunchReminderStage,
} from '../../helpers/missedPunchReminderHelper.js';

const TZ = 'Asia/Kolkata';

function at(iso) {
    return DateTime.fromISO(iso, { zone: TZ });
}

describe('missedPunchReminderHelper', () => {
    describe('resolveMissedPunchReminderStage', () => {
        it('sends the notice 7 days before a 31-day month end', () => {
            const stage = resolveMissedPunchReminderStage(at('2026-10-24T09:15:00'), TZ);
            expect(MISSED_PUNCH_NOTICE_DAYS).toBe(7);
            expect(stage.stage).toBe('notice');
            expect(stage.monthKey).toBe('2026-10');
            expect(stage.monthStartKey).toBe('2026-10-01');
            expect(stage.walkEndKey).toBe('2026-10-23');
            expect(stage.monthEndKey).toBe('2026-10-31');
        });

        it('sends the LOP reminder 5 days before month end', () => {
            const stage = resolveMissedPunchReminderStage(at('2026-10-26T09:15:00'), TZ);
            expect(MISSED_PUNCH_LOP_DAYS).toBe(5);
            expect(stage.stage).toBe('lop');
            expect(stage.walkEndKey).toBe('2026-10-25');
        });

        it('stays quiet on the days between the two mails', () => {
            const stage = resolveMissedPunchReminderStage(at('2026-10-25T09:15:00'), TZ);
            expect(stage.stage).toBeNull();
        });

        it('uses the real last day of February', () => {
            expect(resolveMissedPunchReminderStage(at('2026-02-21T09:00:00'), TZ).stage).toBe('notice');
            expect(resolveMissedPunchReminderStage(at('2026-02-23T09:00:00'), TZ).stage).toBe('lop');
            expect(resolveMissedPunchReminderStage(at('2028-02-22T09:00:00'), TZ).stage).toBe('notice');
            expect(resolveMissedPunchReminderStage(at('2028-02-24T09:00:00'), TZ).stage).toBe('lop');
        });
    });

    describe('isMissedPunchReminderSendHour', () => {
        it('allows 9am through 11am and skips the afternoon', () => {
            expect(isMissedPunchReminderSendHour(at('2026-10-24T09:15:00'), TZ)).toBe(true);
            expect(isMissedPunchReminderSendHour(at('2026-10-24T11:45:00'), TZ)).toBe(true);
            expect(isMissedPunchReminderSendHour(at('2026-10-24T12:15:00'), TZ)).toBe(false);
        });
    });

    describe('collectMissedPunchDateKeys', () => {
        const calendar = {
            workingDays: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false,
            },
            holidays: [
                { date: new Date('2026-10-02T00:00:00.000Z'), isActive: true, name: 'Gandhi Jayanti' },
                { date: new Date('2026-10-08T00:00:00.000Z'), isActive: true, isHalfDay: true, name: 'Half day' },
            ],
        };
        const isWorkingDayKeyFn = buildWorkingDayKeyFn(calendar, TZ);

        function missed(overrides = {}) {
            return collectMissedPunchDateKeys({
                monthStartKey: '2026-10-01',
                walkEndKey: '2026-10-09',
                joiningDate: new Date('2026-10-01T00:00:00.000Z'),
                timezone: TZ,
                isWorkingDayKeyFn,
                punchedDateKeys: new Set(),
                paidLeaveByDay: new Map(),
                lopByDay: new Map(),
                ...overrides,
            });
        }

        it('lists working days with no punch and skips weekends, holidays, and punches', () => {
            const keys = missed({ punchedDateKeys: new Set(['2026-10-06']) });
            expect(keys).toEqual([
                '2026-10-01',
                '2026-10-05',
                '2026-10-07',
                '2026-10-08',
                '2026-10-09',
            ]);
        });

        it('skips a day covered by a full approved leave or full LOP', () => {
            const keys = missed({
                paidLeaveByDay: new Map([['2026-10-05', 1]]),
                lopByDay: new Map([['2026-10-07', 1]]),
            });
            expect(keys).not.toContain('2026-10-05');
            expect(keys).not.toContain('2026-10-07');
            expect(keys).toContain('2026-10-01');
        });

        it('keeps a half-day leave because the other half still needs a punch', () => {
            const keys = missed({ paidLeaveByDay: new Map([['2026-10-05', 0.5]]) });
            expect(keys).toContain('2026-10-05');
        });

        it('starts at the joining date and stops at the last working date', () => {
            const keys = missed({
                joiningDate: new Date('2026-10-07T00:00:00.000Z'),
                lastWorkingDate: new Date('2026-10-08T00:00:00.000Z'),
            });
            expect(keys).toEqual(['2026-10-07', '2026-10-08']);
        });
    });

    describe('buildMissedPunchReminderEmail', () => {
        it('uses a notice on the first mail and an LOP warning on the second', () => {
            const notice = buildMissedPunchReminderEmail({
                employeeName: 'Asha',
                stage: 'notice',
                missedDateKeys: ['2026-10-01'],
                monthLabel: 'October 2026',
                timezone: TZ,
                regularizationUrl: 'https://app.example/my-attendance-regularization',
            });
            const lop = buildMissedPunchReminderEmail({
                employeeName: 'Asha',
                stage: 'lop',
                missedDateKeys: ['2026-10-01'],
                monthLabel: 'October 2026',
                timezone: TZ,
            });

            expect(notice.subject).toContain('Regularize your attendance');
            expect(notice.message).toContain('01 Oct 2026');
            expect(notice.message).toContain('https://app.example/my-attendance-regularization');
            expect(lop.subject).toContain('LOP');
            expect(lop.message).toContain('loss of pay');
            expect(lop.html).toContain('01 Oct 2026');
        });
    });
});
