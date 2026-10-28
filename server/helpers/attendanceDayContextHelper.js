/**
 * Attendance day context for WFH + half-day leave/holiday integration.
 * Composes approved leave / approved WFH / optional half-day holiday into
 * effective punch windows, late baseline, and expected hours — without
 * changing geofence, device, or shift-assignment helpers.
 */

import Leave from '../models/leave.model.js';
import WfhRequest from '../models/wfhRequest.model.js';
import { DateTime } from 'luxon';
import { combineDateAndTimeInTimezone, normalizeTimezone } from './timezoneHelper.js';
import { applyEmployeeShiftToRule } from './shiftHelper.js';

const HHMM_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function parseHmToMinutes(value) {
  if (!HHMM_RE.test(String(value || '').trim())) return null;
  const [h, m] = String(value).trim().split(':').map(Number);
  return h * 60 + m;
}

export function formatMinutesAsHHmm(totalMinutes) {
  const mins = ((Number(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Midpoint of a work window (shift or office hours). Overnight windows use start+4h.
 */
export function computeHalfDayMidpointHHmm(startHHmm, endHHmm) {
  const start = parseHmToMinutes(startHHmm) ?? 9 * 60;
  const end = parseHmToMinutes(endHHmm) ?? 17 * 60;
  if (end <= start) return formatMinutesAsHHmm(start + 4 * 60);
  return formatMinutesAsHHmm(Math.floor((start + end) / 2));
}

function normalizeHalf(value) {
  return value === 'second_half' ? 'second_half' : value === 'first_half' ? 'first_half' : null;
}

/**
 * Classify leave covering a single attendance date key.
 * @returns {'none'|'full'|'first_half'|'second_half'}
 */
export function classifyLeaveForDate(leaveRows, dateKey, timezone) {
  const tz = normalizeTimezone(timezone || 'UTC');
  let result = 'none';

  for (const lv of leaveRows || []) {
    if (!lv || lv.status !== 'approved') continue;
    let d = DateTime.fromJSDate(new Date(lv.startDate), { zone: tz }).startOf('day');
    const last = DateTime.fromJSDate(new Date(lv.endDate), { zone: tz }).startOf('day');
    let covers = false;
    while (d <= last) {
      if (d.toFormat('yyyy-MM-dd') === dateKey) {
        covers = true;
        break;
      }
      d = d.plus({ days: 1 });
    }
    if (!covers) continue;

    const isHalf = lv.isHalfDay === true || Number(lv.duration) === 0.5;
    if (!isHalf) return 'full';
    const half = normalizeHalf(lv.halfDayType) || 'first_half';
    if (result === 'none') result = half;
    else if (result !== half) return 'full'; // both halves covered by leave
  }
  return result;
}

/**
 * Classify approved WFH covering a single attendance date key.
 * Matches date keys in org TZ and UTC so stored midnights still hit the right calendar day.
 * @returns {'none'|'full'|'first_half'|'second_half'}
 */
export function classifyWfhForDate(wfhRows, dateKey, timezone) {
  const tz = normalizeTimezone(timezone || 'UTC');
  let result = 'none';

  const dateKeysFor = (value) => {
    if (!value) return [];
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return [];
    const keys = new Set();
    keys.add(DateTime.fromJSDate(d, { zone: tz }).toFormat('yyyy-MM-dd'));
    keys.add(DateTime.fromJSDate(d, { zone: 'utc' }).toFormat('yyyy-MM-dd'));
    // Also accept raw yyyy-MM-dd if the Date was built from a date-only string
    const iso = d.toISOString?.();
    if (iso && /^\d{4}-\d{2}-\d{2}/.test(iso)) keys.add(iso.slice(0, 10));
    return [...keys].filter(Boolean);
  };

  for (const req of wfhRows || []) {
    if (!req || req.status !== 'approved' || !req.wfhDate) continue;
    const fromKeys = dateKeysFor(req.wfhDate);
    const toKeys = req.wfhDateTo ? dateKeysFor(req.wfhDateTo) : fromKeys;
    if (!fromKeys.length) continue;

    const fromKey = fromKeys.sort()[0];
    const toKey = toKeys.sort()[toKeys.length - 1];
    const covers =
      (dateKey >= fromKey && dateKey <= toKey) ||
      fromKeys.includes(dateKey) ||
      toKeys.includes(dateKey);
    if (!covers) continue;

    const type = req.wfhType === 'half_day' ? 'half_day' : 'full_day';
    if (type === 'full_day') return 'full';
    const half = normalizeHalf(req.halfDayType) || 'first_half';
    if (result === 'none') result = half;
    else if (result !== half) return 'full';
  }
  return result;
}

/**
 * Holiday half classification. Full-day holiday when isHalfDay is not true.
 * @returns {'none'|'full'|'first_half'|'second_half'}
 */
export function classifyHoliday(holiday) {
  if (!holiday) return 'none';
  // Converted holiday → treat as a normal working day for attendance planning
  if (holiday.workModeOverride === 'office' || holiday.workModeOverride === 'home') {
    return 'none';
  }
  if (holiday.isHalfDay === true || holiday.isHalfDay === 'true') {
    return normalizeHalf(holiday.halfDayType) || 'first_half';
  }
  return 'full';
}

/**
 * Build effective day plan from leave + WFH + holiday + work window.
 */
export function resolveAttendanceDayPlan({
  startHHmm = '09:00',
  endHHmm = '17:00',
  leaveType = 'none',
  wfhType = 'none',
  holidayType = 'none',
  nowHHmm = null,
  allowNonWorkingDayPunch = false,
} = {}) {
  const midpointHHmm = computeHalfDayMidpointHHmm(startHHmm, endHHmm);

  const firstHalfOff =
    leaveType === 'full' ||
    leaveType === 'first_half' ||
    holidayType === 'full' ||
    holidayType === 'first_half';
  const secondHalfOff =
    leaveType === 'full' ||
    leaveType === 'second_half' ||
    holidayType === 'full' ||
    holidayType === 'second_half';

  const fullDayBlocked =
    (leaveType === 'full' || holidayType === 'full') &&
    !(holidayType === 'full' && allowNonWorkingDayPunch);

  // Full-day leave always blocks (even if non-working punch allowed for holidays)
  const leaveBlocks = leaveType === 'full';

  let punchAllowed = true;
  let punchBlockedReason = null;
  let punchBlockedCode = null;

  if (leaveBlocks) {
    punchAllowed = false;
    punchBlockedReason = 'Cannot punch in on an approved full-day leave.';
    punchBlockedCode = 'FULL_DAY_LEAVE';
  } else if (holidayType === 'full' && !allowNonWorkingDayPunch) {
    punchAllowed = false;
    punchBlockedReason = 'Cannot punch in on a holiday.';
    punchBlockedCode = 'NON_WORKING_DAY';
  } else if (firstHalfOff && secondHalfOff && !allowNonWorkingDayPunch) {
    punchAllowed = false;
    punchBlockedReason = 'No working half remaining for today.';
    punchBlockedCode = 'NO_WORKING_HALF';
  }

  const workStartHHmm = firstHalfOff ? midpointHHmm : startHHmm;
  const workEndHHmm = secondHalfOff ? midpointHHmm : endHHmm;
  const expectedHoursFactor = firstHalfOff || secondHalfOff ? 0.5 : 1;

  // When only second half is off and first is work, factor 0.5; when only first off, 0.5; both off handled above
  const effectiveFactor =
    firstHalfOff && secondHalfOff ? 0 : firstHalfOff || secondHalfOff ? 0.5 : 1;

  let currentHalf = 'first_half';
  if (nowHHmm && HHMM_RE.test(String(nowHHmm))) {
    const nowMins = parseHmToMinutes(nowHHmm);
    const midMins = parseHmToMinutes(midpointHHmm);
    if (nowMins != null && midMins != null && nowMins >= midMins) {
      currentHalf = 'second_half';
    }
  }

  const wfhFirst =
    wfhType === 'full' || wfhType === 'first_half';
  const wfhSecond =
    wfhType === 'full' || wfhType === 'second_half';

  const expectedWorkLocationForHalf = (half) => {
    if (half === 'first_half') {
      if (firstHalfOff) return null;
      return wfhFirst ? 'work_from_home' : 'office';
    }
    if (secondHalfOff) return null;
    return wfhSecond ? 'work_from_home' : 'office';
  };

  return {
    punchAllowed,
    punchBlockedReason,
    punchBlockedCode,
    leaveType,
    wfhType,
    holidayType,
    firstHalfOff,
    secondHalfOff,
    midpointHHmm,
    dayStartHHmm: startHHmm,
    dayEndHHmm: endHHmm,
    workStartHHmm,
    workEndHHmm,
    expectedHoursFactor: effectiveFactor,
    currentHalf,
    expectedWorkLocation: expectedWorkLocationForHalf(currentHalf),
    expectedWorkLocationFirstHalf: expectedWorkLocationForHalf('first_half'),
    expectedWorkLocationSecondHalf: expectedWorkLocationForHalf('second_half'),
    /** Late baseline = effective work start (second-half start when first half is leave/holiday). */
    lateStartHHmm: workStartHHmm,
    /** Early-departure baseline end. */
    earlyEndHHmm: workEndHHmm,
    fullDayBlocked: Boolean(fullDayBlocked || leaveBlocks),
  };
}

/**
 * Load approved leave + WFH and resolve plan for an employee/date.
 */
export async function loadAttendanceDayPlan({
  organizationId,
  employeeId,
  attendanceDateKey,
  timezone,
  rule,
  employee,
  holiday = null,
  allowNonWorkingDayPunch = false,
  now = new Date(),
}) {
  const tz = normalizeTimezone(timezone || 'UTC');
  const dateKey = String(attendanceDateKey || '').slice(0, 10);
  const dayStart = DateTime.fromFormat(dateKey, 'yyyy-MM-dd', { zone: tz }).startOf('day');
  const dayEnd = dayStart.endOf('day');

  const [leaveRows, wfhRows] = await Promise.all([
    Leave.find({
      organizationId,
      employee: employeeId,
      status: 'approved',
      startDate: { $lte: dayEnd.toJSDate() },
      endDate: { $gte: dayStart.toJSDate() },
    })
      .select('status isHalfDay halfDayType duration startDate endDate')
      .lean(),
    WfhRequest.find({
      organizationId,
      employeeId,
      status: 'approved',
      $or: [
        // Single-day WFH near the attendance date (TZ/midnight safe window)
        {
          wfhDate: {
            $gte: dayStart.minus({ days: 1 }).toJSDate(),
            $lte: dayEnd.plus({ days: 1 }).toJSDate(),
          },
          $or: [{ wfhDateTo: null }, { wfhDateTo: { $exists: false } }],
        },
        // Multi-day range that covers the attendance date
        {
          wfhDate: { $lte: dayEnd.plus({ days: 1 }).toJSDate() },
          wfhDateTo: { $gte: dayStart.minus({ days: 1 }).toJSDate() },
        },
      ],
    })
      .select('status wfhType halfDayType wfhDate wfhDateTo')
      .lean(),
  ]);

  // WFH may start before today and extend via wfhDateTo — filter in classify
  const leaveType = classifyLeaveForDate(leaveRows, dateKey, tz);
  const wfhType = classifyWfhForDate(wfhRows, dateKey, tz);
  const holidayType = classifyHoliday(holiday);

  const effectiveRule = applyEmployeeShiftToRule(rule, employee);
  const startHHmm = effectiveRule?.officeHours?.startTime || '09:00';
  const endHHmm = effectiveRule?.officeHours?.endTime || '17:00';
  const nowHHmm = DateTime.fromJSDate(now, { zone: tz }).toFormat('HH:mm');

  const plan = resolveAttendanceDayPlan({
    startHHmm,
    endHHmm,
    leaveType,
    wfhType,
    holidayType,
    nowHHmm,
    allowNonWorkingDayPunch,
  });

  // If second-half WFH is approved but primary TZ still says first half (often org TZ left as
  // default UTC while staff work in IST), re-check half in rule TZ / Asia/Kolkata.
  let resolvedPlan = plan;
  let resolvedNowHHmm = nowHHmm;
  if (plan.wfhType === 'second_half' && plan.currentHalf === 'first_half') {
    const altZones = [rule?.timezone, tz === 'UTC' ? 'Asia/Kolkata' : null].filter(
      (z) => z && normalizeTimezone(z) !== tz
    );
    for (const z of [...new Set(altZones.map((x) => normalizeTimezone(x)))]) {
      const altNow = DateTime.fromJSDate(now, { zone: z }).toFormat('HH:mm');
      const altPlan = resolveAttendanceDayPlan({
        startHHmm,
        endHHmm,
        leaveType,
        wfhType,
        holidayType,
        nowHHmm: altNow,
        allowNonWorkingDayPunch,
      });
      if (altPlan.currentHalf === 'second_half') {
        resolvedPlan = altPlan;
        resolvedNowHHmm = altNow;
        break;
      }
    }
  }

  return {
    ...resolvedPlan,
    officeHours: { startTime: startHHmm, endTime: endHHmm },
    nowHHmm: resolvedNowHHmm,
  };
}

/**
 * Build Date for late / early checks from plan + grace (same rules as attendanceSecurityHelper).
 * Overnight shifts: times earlier than the shift start HH:mm fall on the next calendar day.
 */
export function combinePlanInstant(startOfDay, hhmm, plan, timezone) {
  const tz = normalizeTimezone(timezone || 'UTC');
  let instant = combineDateAndTimeInTimezone(startOfDay, hhmm, tz);
  const dayStartHHmm = plan?.dayStartHHmm || '09:00';
  const dayEndHHmm = plan?.dayEndHHmm || '17:00';
  const startMins = parseHmToMinutes(dayStartHHmm);
  const endMins = parseHmToMinutes(dayEndHHmm);
  const targetMins = parseHmToMinutes(hhmm);
  const overnight = startMins != null && endMins != null && endMins <= startMins;
  if (overnight && targetMins != null && startMins != null && targetMins < startMins) {
    instant = DateTime.fromJSDate(instant, { zone: tz }).plus({ days: 1 }).toJSDate();
  }
  return instant;
}

export function getLateThresholdFromPlan(plan, startOfDay, timezone, rule) {
  const startHHmm = plan?.lateStartHHmm || plan?.workStartHHmm || '09:00';
  let threshold = combinePlanInstant(startOfDay, startHHmm, plan, timezone);
  if (rule?.enablePenaltyRules && rule?.penaltyRules?.lateArrival?.enabled) {
    const graceMinutes = Number(
      rule.penaltyRules.lateArrival.gracePeriod ||
        rule.checkInOutTimes?.checkInGracePeriod ||
        0
    );
    threshold = new Date(threshold.getTime() + graceMinutes * 60 * 1000);
  } else if (rule?.checkInOutTimes?.checkInGracePeriod != null) {
    const graceMinutes = Number(rule.checkInOutTimes.checkInGracePeriod || 0);
    threshold = new Date(threshold.getTime() + graceMinutes * 60 * 1000);
  }
  return threshold;
}

export function getEarlyDepartureThresholdFromPlan(plan, startOfDay, timezone, rule) {
  const endHHmm = plan?.earlyEndHHmm || plan?.workEndHHmm || '17:00';
  let threshold = combinePlanInstant(startOfDay, endHHmm, plan, timezone);
  if (rule?.enablePenaltyRules && rule?.penaltyRules?.earlyDeparture?.enabled) {
    const graceMinutes = Number(rule.penaltyRules.earlyDeparture.gracePeriod || 0);
    threshold = new Date(threshold.getTime() - graceMinutes * 60 * 1000);
  }
  return threshold;
}

export function getExpectedHoursFromPlan(plan, fullDayHours) {
  const full = Number(fullDayHours);
  const base = Number.isFinite(full) && full > 0 ? full : 8;
  const factor = plan?.expectedHoursFactor;
  if (factor === 0) return 0;
  if (factor === 0.5) return Math.round(base * 0.5 * 100) / 100;
  return Math.round(base * 100) / 100;
}

/**
 * Approved WFH covers the employee's current working half/day → Home punch only.
 * Pending/rejected WFH never appear in plan.wfhType.
 */
export function isWfhOnlyPunchPeriod(plan) {
  if (!plan) return false;
  if (plan.expectedWorkLocation === 'work_from_home') return true;
  const wfh = plan.wfhType;
  if (wfh === 'full') return true;
  if (wfh === 'first_half') {
    // First-half WFH (+ optional second-half leave/holiday): WFH-only for the working first half
    if (plan.secondHalfOff) return true;
    return plan.currentHalf === 'first_half';
  }
  if (wfh === 'second_half') {
    // Second-half WFH (+ optional first-half leave/holiday): WFH-only for the working second half
    if (plan.firstHalfOff) return true;
    return plan.currentHalf === 'second_half';
  }
  return false;
}

/**
 * Working half is office only (half leave/holiday, no approved WFH on the working half).
 */
export function isOfficeOnlyPunchPeriod(plan) {
  if (!plan) return false;
  if (plan.wfhType && plan.wfhType !== 'none') return false;
  if (plan.firstHalfOff && !plan.secondHalfOff) return true;
  if (plan.secondHalfOff && !plan.firstHalfOff) return true;
  return false;
}

/**
 * Simulate continuing a session into the other half without overwriting primary workLocation.
 * Mirrors clockIn ATTENDANCE_CONTINUED behavior.
 */
export function applySecondaryWorkLocation(attendance, requestedLocation) {
  if (!attendance || attendance.clockOut) {
    return { ok: false, code: 'NO_OPEN_SESSION' };
  }
  const primary =
    attendance.workLocation === 'home' ? 'work_from_home' : attendance.workLocation;
  const next = requestedLocation === 'home' ? 'work_from_home' : requestedLocation;
  if (!next || next === primary) {
    return { ok: false, code: 'SAME_LOCATION', attendance };
  }
  return {
    ok: true,
    attendance: {
      ...attendance,
      workLocation: primary,
      secondaryWorkLocation: next,
    },
  };
}

/**
 * Derive clock-out flags from plan + worked hours (mirrors attendanceController clockOut rules).
 */
export function evaluateClockOutMetrics({
  plan,
  fullDayHours,
  effectiveHours,
  clockOutTime,
  startOfDay,
  timezone,
  rule,
  isLateArrival = false,
  markHalfDayIfLate = false,
}) {
  const expectedHours = getExpectedHoursFromPlan(plan, fullDayHours);
  const earlyThreshold = getEarlyDepartureThresholdFromPlan(plan, startOfDay, timezone, rule);
  const isEarlyDeparture = expectedHours > 0 && clockOutTime < earlyThreshold;
  const halfDayThreshold = expectedHours > 0 ? expectedHours / 2 : 0;

  let status = 'present';
  if (plan?.expectedHoursFactor === 0.5) {
    status = 'half-day';
  } else if (expectedHours > 0 && effectiveHours < halfDayThreshold) {
    status = 'half-day';
  } else if (markHalfDayIfLate && isLateArrival) {
    status = 'half-day';
  }

  const overtimeHours =
    effectiveHours > expectedHours
      ? Math.round((effectiveHours - expectedHours) * 100) / 100
      : 0;

  return {
    expectedHours,
    isEarlyDeparture,
    earlyThreshold,
    status,
    overtimeHours,
  };
}
