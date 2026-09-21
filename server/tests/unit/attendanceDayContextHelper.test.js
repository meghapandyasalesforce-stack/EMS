import { describe, it, expect } from '@jest/globals';
import {
  computeHalfDayMidpointHHmm,
  classifyLeaveForDate,
  classifyWfhForDate,
  classifyHoliday,
  resolveAttendanceDayPlan,
  getExpectedHoursFromPlan,
} from '../../helpers/attendanceDayContextHelper.js';

describe('attendanceDayContextHelper', () => {
  describe('computeHalfDayMidpointHHmm', () => {
    it('splits a normal day window', () => {
      expect(computeHalfDayMidpointHHmm('09:00', '17:00')).toBe('13:00');
    });

    it('uses start+4h for overnight shifts', () => {
      expect(computeHalfDayMidpointHHmm('21:00', '06:00')).toBe('01:00');
    });
  });

  describe('classifyLeaveForDate', () => {
    const tz = 'UTC';
    const day = '2026-03-10';

    it('ignores non-approved leave', () => {
      expect(
        classifyLeaveForDate(
          [{ status: 'pending', startDate: day, endDate: day, isHalfDay: false }],
          day,
          tz
        )
      ).toBe('none');
    });

    it('detects full-day leave', () => {
      expect(
        classifyLeaveForDate(
          [
            {
              status: 'approved',
              startDate: new Date('2026-03-10T00:00:00Z'),
              endDate: new Date('2026-03-10T00:00:00Z'),
              isHalfDay: false,
            },
          ],
          day,
          tz
        )
      ).toBe('full');
    });

    it('detects first-half leave', () => {
      expect(
        classifyLeaveForDate(
          [
            {
              status: 'approved',
              startDate: new Date('2026-03-10T00:00:00Z'),
              endDate: new Date('2026-03-10T00:00:00Z'),
              isHalfDay: true,
              halfDayType: 'first_half',
            },
          ],
          day,
          tz
        )
      ).toBe('first_half');
    });
  });

  describe('classifyWfhForDate', () => {
    const tz = 'UTC';
    const day = '2026-03-10';

    it('ignores pending WFH', () => {
      expect(
        classifyWfhForDate(
          [
            {
              status: 'pending',
              wfhDate: new Date('2026-03-10T00:00:00Z'),
              wfhType: 'full_day',
            },
          ],
          day,
          tz
        )
      ).toBe('none');
    });

    it('detects approved second-half WFH', () => {
      expect(
        classifyWfhForDate(
          [
            {
              status: 'approved',
              wfhDate: new Date('2026-03-10T00:00:00Z'),
              wfhType: 'half_day',
              halfDayType: 'second_half',
            },
          ],
          day,
          tz
        )
      ).toBe('second_half');
    });

    it('ignores rejected WFH', () => {
      expect(
        classifyWfhForDate(
          [
            {
              status: 'rejected',
              wfhDate: new Date('2026-03-10T00:00:00Z'),
              wfhType: 'half_day',
              halfDayType: 'first_half',
            },
          ],
          day,
          tz
        )
      ).toBe('none');
    });
  });

  describe('resolveAttendanceDayPlan', () => {
    it('full-day leave blocks punch', () => {
      const plan = resolveAttendanceDayPlan({
        startHHmm: '09:00',
        endHHmm: '17:00',
        leaveType: 'full',
      });
      expect(plan.punchAllowed).toBe(false);
      expect(plan.punchBlockedCode).toBe('FULL_DAY_LEAVE');
    });

    it('first-half leave defers late start to midpoint', () => {
      const plan = resolveAttendanceDayPlan({
        startHHmm: '09:00',
        endHHmm: '17:00',
        leaveType: 'first_half',
        wfhType: 'second_half',
        nowHHmm: '14:00',
      });
      expect(plan.punchAllowed).toBe(true);
      expect(plan.lateStartHHmm).toBe('13:00');
      expect(plan.expectedHoursFactor).toBe(0.5);
      expect(plan.expectedWorkLocation).toBe('work_from_home');
      expect(plan.currentHalf).toBe('second_half');
    });

    it('second-half leave ends work at midpoint (no early-departure after half)', () => {
      const plan = resolveAttendanceDayPlan({
        startHHmm: '09:00',
        endHHmm: '17:00',
        leaveType: 'second_half',
        wfhType: 'first_half',
        nowHHmm: '10:00',
      });
      expect(plan.earlyEndHHmm).toBe('13:00');
      expect(plan.expectedHoursFactor).toBe(0.5);
      expect(plan.expectedWorkLocation).toBe('work_from_home');
    });

    it('half-day holiday first half defers work start', () => {
      const plan = resolveAttendanceDayPlan({
        startHHmm: '09:00',
        endHHmm: '17:00',
        holidayType: 'first_half',
        nowHHmm: '14:30',
      });
      expect(plan.punchAllowed).toBe(true);
      expect(plan.lateStartHHmm).toBe('13:00');
      expect(plan.firstHalfOff).toBe(true);
    });

    it('uses shift overnight midpoint for night shift', () => {
      const plan = resolveAttendanceDayPlan({
        startHHmm: '21:00',
        endHHmm: '06:00',
        leaveType: 'first_half',
      });
      expect(plan.midpointHHmm).toBe('01:00');
      expect(plan.lateStartHHmm).toBe('01:00');
    });

    it('pending/none WFH does not change office expectation', () => {
      const plan = resolveAttendanceDayPlan({
        startHHmm: '09:00',
        endHHmm: '17:00',
        wfhType: 'none',
        nowHHmm: '10:00',
      });
      expect(plan.expectedWorkLocation).toBe('office');
      expect(plan.lateStartHHmm).toBe('09:00');
    });
  });

  describe('classifyHoliday', () => {
    it('treats unmarked holiday as full', () => {
      expect(classifyHoliday({ name: 'Diwali' })).toBe('full');
    });

    it('supports half-day holiday', () => {
      expect(classifyHoliday({ isHalfDay: true, halfDayType: 'second_half' })).toBe('second_half');
    });
  });

  describe('getExpectedHoursFromPlan', () => {
    it('halves full-day hours when factor is 0.5', () => {
      expect(getExpectedHoursFromPlan({ expectedHoursFactor: 0.5 }, 8)).toBe(4);
    });
  });
});
