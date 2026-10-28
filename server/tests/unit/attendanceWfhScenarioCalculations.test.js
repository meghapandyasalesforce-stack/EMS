import { describe, it, expect } from '@jest/globals';
import { DateTime } from 'luxon';
import {
  resolveAttendanceDayPlan,
  getLateThresholdFromPlan,
  getEarlyDepartureThresholdFromPlan,
  getExpectedHoursFromPlan,
  applySecondaryWorkLocation,
  evaluateClockOutMetrics,
  combinePlanInstant,
  isWfhOnlyPunchPeriod,
  isOfficeOnlyPunchPeriod,
} from '../../helpers/attendanceDayContextHelper.js';
import { combineDateAndTimeInTimezone } from '../../helpers/timezoneHelper.js';

const TZ = 'Asia/Kolkata';
const DAY = '2026-03-10';
const startOfDay = DateTime.fromFormat(DAY, 'yyyy-MM-dd', { zone: TZ }).startOf('day').toJSDate();

const dayRule = {
  enablePenaltyRules: true,
  penaltyRules: {
    lateArrival: { enabled: true, gracePeriod: 15 },
    earlyDeparture: { enabled: true, gracePeriod: 0 },
  },
};

function at(hhmm, dayOffset = 0) {
  const base = DateTime.fromJSDate(startOfDay, { zone: TZ }).plus({ days: dayOffset });
  const [h, m] = hhmm.split(':').map(Number);
  return base.set({ hour: h, minute: m, second: 0, millisecond: 0 }).toJSDate();
}

function planOf(overrides) {
  return resolveAttendanceDayPlan({
    startHHmm: '09:00',
    endHHmm: '17:00',
    nowHHmm: '10:00',
    ...overrides,
  });
}

describe('WFH/Attendance scenario calculations', () => {
  describe('Full-day WFH', () => {
    it('uses full-day late/early windows and WFH location', () => {
      const plan = planOf({ wfhType: 'full', nowHHmm: '09:30' });
      expect(plan.punchAllowed).toBe(true);
      expect(plan.expectedHoursFactor).toBe(1);
      expect(plan.expectedWorkLocation).toBe('work_from_home');
      expect(plan.lateStartHHmm).toBe('09:00');
      expect(plan.earlyEndHHmm).toBe('17:00');

      const lateAt = getLateThresholdFromPlan(plan, startOfDay, TZ, dayRule);
      expect(lateAt).toEqual(at('09:15'));
      expect(at('09:10') > lateAt).toBe(false);
      expect(at('09:20') > lateAt).toBe(true);

      const out = evaluateClockOutMetrics({
        plan,
        fullDayHours: 8,
        effectiveHours: 8,
        clockOutTime: at('17:05'),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
      });
      expect(out.expectedHours).toBe(8);
      expect(out.isEarlyDeparture).toBe(false);
      expect(out.status).toBe('present');

      const attendance = {
        workLocation: 'work_from_home',
        secondaryWorkLocation: null,
        clockIn: at('09:05'),
      };
      expect(attendance.workLocation).toBe('work_from_home');
      expect(attendance.secondaryWorkLocation).toBeNull();
    });
  });

  describe('1st-half WFH + 2nd-half Office', () => {
    it('morning WFH then continue Office without overwriting primary location', () => {
      const morning = planOf({ wfhType: 'first_half', nowHHmm: '10:00' });
      expect(morning.expectedWorkLocationFirstHalf).toBe('work_from_home');
      expect(morning.expectedWorkLocationSecondHalf).toBe('office');
      expect(morning.lateStartHHmm).toBe('09:00');
      expect(morning.expectedHoursFactor).toBe(1);

      let attendance = {
        workLocation: 'work_from_home',
        secondaryWorkLocation: null,
        clockIn: at('09:05'),
        clockOut: null,
      };
      const continued = applySecondaryWorkLocation(attendance, 'office');
      expect(continued.ok).toBe(true);
      attendance = continued.attendance;
      expect(attendance.workLocation).toBe('work_from_home');
      expect(attendance.secondaryWorkLocation).toBe('office');

      const afternoon = planOf({ wfhType: 'first_half', nowHHmm: '14:00' });
      const out = evaluateClockOutMetrics({
        plan: afternoon,
        fullDayHours: 8,
        effectiveHours: 7.5,
        clockOutTime: at('17:00'),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
      });
      expect(out.status).toBe('present');
      expect(out.isEarlyDeparture).toBe(false);
    });
  });

  describe('1st-half Office + 2nd-half WFH', () => {
    it('preserves office primary and records WFH secondary', () => {
      const morning = planOf({ wfhType: 'second_half', nowHHmm: '10:00' });
      expect(morning.expectedWorkLocationFirstHalf).toBe('office');
      expect(morning.expectedWorkLocationSecondHalf).toBe('work_from_home');

      let attendance = {
        workLocation: 'office',
        secondaryWorkLocation: null,
        clockIn: at('09:00'),
        clockOut: null,
        status: 'present',
        isLateArrival: false,
      };
      const snapshot = { ...attendance };

      const continued = applySecondaryWorkLocation(attendance, 'work_from_home');
      expect(continued.ok).toBe(true);
      attendance = continued.attendance;

      expect(attendance.workLocation).toBe('office');
      expect(attendance.secondaryWorkLocation).toBe('work_from_home');
      expect(attendance.clockIn).toEqual(snapshot.clockIn);
      expect(attendance.status).toBe('present');
      expect(attendance.isLateArrival).toBe(false);
    });
  });

  describe('1st-half Leave + 2nd-half WFH', () => {
    it('defers late to midpoint and expects half-day WFH hours', () => {
      const plan = planOf({
        leaveType: 'first_half',
        wfhType: 'second_half',
        nowHHmm: '13:30',
      });
      expect(plan.punchAllowed).toBe(true);
      expect(plan.firstHalfOff).toBe(true);
      expect(plan.lateStartHHmm).toBe('13:00');
      expect(plan.expectedWorkLocation).toBe('work_from_home');
      expect(plan.expectedHoursFactor).toBe(0.5);

      const lateAt = getLateThresholdFromPlan(plan, startOfDay, TZ, dayRule);
      expect(lateAt).toEqual(at('13:15'));
      // Punch at 13:10 is NOT late (before grace end)
      expect(at('13:10') > lateAt).toBe(false);
      // Early morning punch is also not late vs deferred baseline
      expect(at('10:00') > lateAt).toBe(false);
      expect(at('13:20') > lateAt).toBe(true);

      const out = evaluateClockOutMetrics({
        plan,
        fullDayHours: 8,
        effectiveHours: 3.8,
        clockOutTime: at('17:00'),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
        isLateArrival: false,
      });
      expect(out.expectedHours).toBe(4);
      expect(out.status).toBe('half-day');
      expect(out.isEarlyDeparture).toBe(false);
    });
  });

  describe('1st-half Leave + 2nd-half Office', () => {
    it('expects office in second half with deferred late start', () => {
      const plan = planOf({
        leaveType: 'first_half',
        wfhType: 'none',
        nowHHmm: '14:00',
      });
      expect(plan.lateStartHHmm).toBe('13:00');
      expect(plan.expectedWorkLocation).toBe('office');
      expect(plan.expectedHoursFactor).toBe(0.5);

      const out = evaluateClockOutMetrics({
        plan,
        fullDayHours: 8,
        effectiveHours: 4,
        clockOutTime: at('17:00'),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
      });
      expect(out.expectedHours).toBe(4);
      expect(out.status).toBe('half-day');
    });
  });

  describe('1st-half WFH + 2nd-half Leave', () => {
    it('ends expected work at midpoint and does not flag early departure at half boundary', () => {
      const plan = planOf({
        leaveType: 'second_half',
        wfhType: 'first_half',
        nowHHmm: '10:00',
      });
      expect(plan.earlyEndHHmm).toBe('13:00');
      expect(plan.expectedWorkLocation).toBe('work_from_home');
      expect(plan.expectedHoursFactor).toBe(0.5);

      const earlyAt = getEarlyDepartureThresholdFromPlan(plan, startOfDay, TZ, dayRule);
      expect(earlyAt).toEqual(at('13:00'));

      const onTimeHalf = evaluateClockOutMetrics({
        plan,
        fullDayHours: 8,
        effectiveHours: 4,
        clockOutTime: at('13:00'),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
      });
      expect(onTimeHalf.isEarlyDeparture).toBe(false);
      expect(onTimeHalf.status).toBe('half-day');
      expect(onTimeHalf.expectedHours).toBe(4);

      const earlyHalf = evaluateClockOutMetrics({
        plan,
        fullDayHours: 8,
        effectiveHours: 2,
        clockOutTime: at('11:00'),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
      });
      expect(earlyHalf.isEarlyDeparture).toBe(true);
    });
  });

  describe('Half-day Holiday + half working', () => {
    it('first-half holiday defers work like first-half leave', () => {
      const plan = planOf({
        holidayType: 'first_half',
        nowHHmm: '14:00',
      });
      expect(plan.punchAllowed).toBe(true);
      expect(plan.firstHalfOff).toBe(true);
      expect(plan.lateStartHHmm).toBe('13:00');
      expect(getExpectedHoursFromPlan(plan, 8)).toBe(4);
    });

    it('second-half holiday ends work at midpoint', () => {
      const plan = planOf({
        holidayType: 'second_half',
        nowHHmm: '10:00',
      });
      expect(plan.secondHalfOff).toBe(true);
      expect(plan.earlyEndHHmm).toBe('13:00');
      expect(getExpectedHoursFromPlan(plan, 8)).toBe(4);
    });
  });

  describe('Full-day Leave / Holiday', () => {
    it('blocks punch on full-day leave', () => {
      const plan = planOf({ leaveType: 'full' });
      expect(plan.punchAllowed).toBe(false);
      expect(plan.punchBlockedCode).toBe('FULL_DAY_LEAVE');
    });

    it('blocks punch on full-day holiday unless non-working punch allowed', () => {
      const blocked = planOf({ holidayType: 'full', allowNonWorkingDayPunch: false });
      expect(blocked.punchAllowed).toBe(false);
      expect(blocked.punchBlockedCode).toBe('NON_WORKING_DAY');

      const allowed = planOf({ holidayType: 'full', allowNonWorkingDayPunch: true });
      expect(allowed.punchAllowed).toBe(true);
    });
  });

  describe('Night Shift + half-day combinations', () => {
    const nightPlan = (overrides) =>
      resolveAttendanceDayPlan({
        startHHmm: '21:00',
        endHHmm: '06:00',
        nowHHmm: '22:00',
        ...overrides,
      });

    it('uses overnight midpoint and next-day late threshold after first-half leave', () => {
      const plan = nightPlan({ leaveType: 'first_half', wfhType: 'second_half', nowHHmm: '01:30' });
      expect(plan.midpointHHmm).toBe('01:00');
      expect(plan.lateStartHHmm).toBe('01:00');
      expect(plan.workEndHHmm).toBe('06:00');
      expect(plan.expectedHoursFactor).toBe(0.5);

      const lateAt = getLateThresholdFromPlan(plan, startOfDay, TZ, dayRule);
      // 01:00 next day + 15m grace
      expect(lateAt).toEqual(at('01:15', 1));
      expect(at('01:10', 1) > lateAt).toBe(false);
      expect(at('01:20', 1) > lateAt).toBe(true);

      // Same-calendar-day 01:00 before shift must NOT be used as late baseline
      const wrongSameDay = combineDateAndTimeInTimezone(startOfDay, '01:00', TZ);
      expect(lateAt.getTime()).toBeGreaterThan(wrongSameDay.getTime());
    });

    it('second-half leave ends at overnight midpoint without false early departure', () => {
      const plan = nightPlan({ leaveType: 'second_half', wfhType: 'first_half', nowHHmm: '22:00' });
      expect(plan.earlyEndHHmm).toBe('01:00');
      const earlyAt = getEarlyDepartureThresholdFromPlan(plan, startOfDay, TZ, dayRule);
      expect(earlyAt).toEqual(at('01:00', 1));

      const out = evaluateClockOutMetrics({
        plan,
        fullDayHours: 9,
        effectiveHours: 4,
        clockOutTime: at('01:00', 1),
        startOfDay,
        timezone: TZ,
        rule: dayRule,
      });
      expect(out.expectedHours).toBe(4.5);
      expect(out.isEarlyDeparture).toBe(false);
      expect(out.status).toBe('half-day');
    });

    it('combinePlanInstant places post-midnight times on next day', () => {
      const plan = nightPlan({});
      const start = combinePlanInstant(startOfDay, '21:00', plan, TZ);
      const mid = combinePlanInstant(startOfDay, '01:00', plan, TZ);
      const end = combinePlanInstant(startOfDay, '06:00', plan, TZ);
      expect(start).toEqual(at('21:00'));
      expect(mid).toEqual(at('01:00', 1));
      expect(end).toEqual(at('06:00', 1));
      expect(mid.getTime()).toBeGreaterThan(start.getTime());
      expect(end.getTime()).toBeGreaterThan(mid.getTime());
    });

    it('first-half leave overnight window allows post-midnight punch (01:00–06:00 next day)', () => {
      const plan = nightPlan({ leaveType: 'first_half', nowHHmm: '01:30' });
      const windowStart = combinePlanInstant(startOfDay, plan.workStartHHmm, plan, TZ);
      const windowEnd = combinePlanInstant(startOfDay, plan.workEndHHmm, plan, TZ);
      const punch = at('01:30', 1);
      expect(windowStart).toEqual(at('01:00', 1));
      expect(windowEnd).toEqual(at('06:00', 1));
      expect(punch >= windowStart && punch <= windowEnd).toBe(true);
      // Same-calendar-day morning window would be wrong for this shift
      const wrongStart = combineDateAndTimeInTimezone(startOfDay, '01:00', TZ);
      expect(punch >= wrongStart && punch <= combineDateAndTimeInTimezone(startOfDay, '06:00', TZ)).toBe(false);
    });
  });

  describe('No Shift + half-day combinations', () => {
    it('uses office hours 09:00–17:00 midpoint for leave/WFH mix', () => {
      const plan = planOf({
        leaveType: 'first_half',
        wfhType: 'second_half',
        nowHHmm: '13:05',
      });
      expect(plan.dayStartHHmm).toBe('09:00');
      expect(plan.dayEndHHmm).toBe('17:00');
      expect(plan.midpointHHmm).toBe('13:00');
      expect(plan.lateStartHHmm).toBe('13:00');
      expect(getExpectedHoursFromPlan(plan, 8)).toBe(4);
    });
  });

  describe('Location preservation Home ↔ Office', () => {
    it('Home → Office keeps primary WFH and sets secondary office', () => {
      const result = applySecondaryWorkLocation(
        {
          workLocation: 'work_from_home',
          secondaryWorkLocation: null,
          clockIn: at('09:00'),
          clockOut: null,
          status: 'present',
          effectiveHours: 0,
        },
        'office'
      );
      expect(result.ok).toBe(true);
      expect(result.attendance.workLocation).toBe('work_from_home');
      expect(result.attendance.secondaryWorkLocation).toBe('office');
      expect(result.attendance.status).toBe('present');
      expect(result.attendance.clockIn).toEqual(at('09:00'));
    });

    it('Office → Home keeps primary office and sets secondary WFH', () => {
      const result = applySecondaryWorkLocation(
        {
          workLocation: 'office',
          secondaryWorkLocation: null,
          clockIn: at('09:00'),
          isLateArrival: false,
        },
        'work_from_home'
      );
      expect(result.ok).toBe(true);
      expect(result.attendance.workLocation).toBe('office');
      expect(result.attendance.secondaryWorkLocation).toBe('work_from_home');
      expect(result.attendance.isLateArrival).toBe(false);
    });

    it('does not overwrite when continuing to the same location', () => {
      const result = applySecondaryWorkLocation(
        { workLocation: 'office', secondaryWorkLocation: null },
        'office'
      );
      expect(result.ok).toBe(false);
      expect(result.code).toBe('SAME_LOCATION');
    });
  });

  describe('Pending / rejected WFH do not alter plan inputs', () => {
    it('wfhType none keeps office expectation and full-day late start', () => {
      const plan = planOf({ wfhType: 'none', nowHHmm: '10:00' });
      expect(plan.expectedWorkLocation).toBe('office');
      expect(plan.lateStartHHmm).toBe('09:00');
      expect(plan.expectedHoursFactor).toBe(1);
    });
  });

  describe('isWfhOnlyPunchPeriod / isOfficeOnlyPunchPeriod', () => {
    it('full-day WFH forces Home only', () => {
      const plan = planOf({ wfhType: 'full', nowHHmm: '10:00' });
      expect(isWfhOnlyPunchPeriod(plan)).toBe(true);
      expect(isOfficeOnlyPunchPeriod(plan)).toBe(false);
    });

    it('second-half WFH forces Home only after midpoint', () => {
      const morning = planOf({ wfhType: 'second_half', nowHHmm: '10:00' });
      const afternoon = planOf({ wfhType: 'second_half', nowHHmm: '14:00' });
      expect(isWfhOnlyPunchPeriod(morning)).toBe(false);
      expect(isWfhOnlyPunchPeriod(afternoon)).toBe(true);
    });

    it('first-half leave + second-half WFH forces Home for the working half', () => {
      const plan = planOf({
        leaveType: 'first_half',
        wfhType: 'second_half',
        nowHHmm: '10:00',
      });
      expect(plan.firstHalfOff).toBe(true);
      expect(isWfhOnlyPunchPeriod(plan)).toBe(true);
    });

    it('first-half leave + second-half office forces Office only', () => {
      const plan = planOf({ leaveType: 'first_half', wfhType: 'none', nowHHmm: '14:00' });
      expect(isOfficeOnlyPunchPeriod(plan)).toBe(true);
      expect(isWfhOnlyPunchPeriod(plan)).toBe(false);
    });

    it('pending/none WFH does not force Home-only', () => {
      const plan = planOf({ wfhType: 'none', nowHHmm: '14:00' });
      expect(isWfhOnlyPunchPeriod(plan)).toBe(false);
    });

    it('Home punch is only authorized when approved WFH covers the period', () => {
      const none = planOf({ wfhType: 'none', nowHHmm: '10:00' });
      const approved = planOf({ wfhType: 'full', nowHHmm: '10:00' });
      // clock-in uses isWfhOnlyPunchPeriod: false → WFH_APPROVAL_REQUIRED; true → Home allowed / Office blocked
      expect(isWfhOnlyPunchPeriod(none)).toBe(false);
      expect(isWfhOnlyPunchPeriod(approved)).toBe(true);
    });
  });
});
