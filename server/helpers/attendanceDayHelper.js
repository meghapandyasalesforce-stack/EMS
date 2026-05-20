import { DateTime } from 'luxon';
import {
  getEffectiveTimezone,
} from './organizationTimezoneService.js';
import {
  getStartOfDayInTimezone,
  getEndOfDayInTimezone,
  getDateKeyInTimezone,
} from './timezoneHelper.js';

/**
 * Canonical "attendance day" for an organization (rule TZ → org TZ → UTC).
 * @returns {{ timezone: string, attendanceDateKey: string, startOfDay: Date, endOfDay: Date }}
 */
export async function getAttendanceDayContext(organizationId, refDate = new Date()) {
  const timezone = await getEffectiveTimezone(organizationId);
  const attendanceDateKey = getDateKeyInTimezone(refDate, timezone);
  const startOfDay = getStartOfDayInTimezone(refDate, timezone);
  const endOfDay = getEndOfDayInTimezone(refDate, timezone);
  return { timezone, attendanceDateKey, startOfDay, endOfDay };
}

/** Match today's row by date key, with legacy fallback on exact `date` instant. */
export function buildTodayAttendanceFilter(dayContext) {
  return {
    $or: [
      { attendanceDateKey: dayContext.attendanceDateKey },
      {
        $and: [
          {
            $or: [
              { attendanceDateKey: null },
              { attendanceDateKey: '' },
              { attendanceDateKey: { $exists: false } },
            ],
          },
          { date: dayContext.startOfDay },
        ],
      },
    ],
  };
}

export async function findTodayAttendance(AttendanceModel, { organizationId, userId, dayContext }) {
  return AttendanceModel.findOne({
    organizationId,
    userId,
    ...buildTodayAttendanceFilter(dayContext),
  });
}

/** Filter all attendance rows for an org for "today". */
export function buildOrgTodayAttendanceFilter(organizationId, dayContext) {
  return {
    organizationId,
    ...buildTodayAttendanceFilter(dayContext),
  };
}

/**
 * Parse yyyy-MM-dd as a calendar day in the given IANA timezone.
 */
export function parseDateKeyInTimezone(dateKey, timezone) {
  const dt = DateTime.fromISO(String(dateKey).slice(0, 10), { zone: timezone });
  if (!dt.isValid) {
    throw new Error(`Invalid date key: ${dateKey}`);
  }
  return dt;
}

/**
 * Build Mongo filter for log/report ranges using attendanceDateKey when possible.
 */
export function buildAttendancePeriodFilter({
  startDateKey,
  endDateKey,
  periodStart,
  periodEnd,
}) {
  const branches = [];

  if (startDateKey && endDateKey) {
    branches.push({
      attendanceDateKey: { $gte: startDateKey, $lte: endDateKey },
    });
  }

  if (periodStart && periodEnd) {
    branches.push({
      $and: [
        {
          $or: [
            { attendanceDateKey: null },
            { attendanceDateKey: '' },
            { attendanceDateKey: { $exists: false } },
          ],
        },
        { date: { $gte: periodStart, $lte: periodEnd } },
      ],
    });
  }

  if (branches.length === 0) {
    return {};
  }
  if (branches.length === 1) {
    return branches[0];
  }
  return { $or: branches };
}

/**
 * Resolve display / stats key for an attendance document.
 */
export function resolveAttendanceDateKey(record, timezone) {
  if (record?.attendanceDateKey) {
    return record.attendanceDateKey;
  }
  if (record?.clockIn) {
    return getDateKeyInTimezone(record.clockIn, timezone);
  }
  if (record?.date) {
    return getDateKeyInTimezone(record.date, timezone);
  }
  return null;
}
