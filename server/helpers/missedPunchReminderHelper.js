import { DateTime } from 'luxon';
import {
    buildIsWorkingDayKeyFn,
    buildLopUnpaidByDayMapForOrg,
    buildPaidLeaveByDayMapForOrg,
    eachDateKeyInInclusiveRange,
    resolvePayrollServiceDateKeys,
} from './payrollGenerationHelper.js';
import { getDateKeyInTimezone } from './timezoneHelper.js';
import { parseDateKeyInTimezone } from './attendanceDayHelper.js';

/** First mail: 7 calendar days before the last day of the month. */
export const MISSED_PUNCH_NOTICE_DAYS = 7;
/** Second mail: 5 calendar days before the last day of the month. */
export const MISSED_PUNCH_LOP_DAYS = 5;

/** Org-local hours that may send. Later hours retry a failed 9am attempt the same day. */
const SEND_HOUR_START = 9;
const SEND_HOUR_END = 11;

/**
 * Which reminder, if any, is due on this org-local calendar day.
 * Days after today are excluded: walkEndKey is yesterday.
 */
export function resolveMissedPunchReminderStage(now, timezone = 'Asia/Kolkata') {
    const dt = DateTime.isDateTime(now)
        ? now.setZone(timezone)
        : DateTime.fromJSDate(now instanceof Date ? now : new Date(now), { zone: timezone });

    const today = dt.startOf('day');
    const monthEnd = today.endOf('month').startOf('day');
    const daysUntilEnd = Math.round(monthEnd.diff(today, 'days').days);

    let stage = null;
    if (daysUntilEnd === MISSED_PUNCH_NOTICE_DAYS) stage = 'notice';
    else if (daysUntilEnd === MISSED_PUNCH_LOP_DAYS) stage = 'lop';

    const monthStartKey = today.startOf('month').toFormat('yyyy-MM-dd');
    const walkEndKey = today.minus({ days: 1 }).toFormat('yyyy-MM-dd');

    return {
        stage,
        daysUntilEnd,
        todayKey: today.toFormat('yyyy-MM-dd'),
        monthKey: today.toFormat('yyyy-MM'),
        monthLabel: today.toFormat('LLLL yyyy'),
        monthStartKey,
        monthEndKey: monthEnd.toFormat('yyyy-MM-dd'),
        walkEndKey: walkEndKey < monthStartKey ? null : walkEndKey,
    };
}

/** True during the org-local send window (09:00–11:59). */
export function isMissedPunchReminderSendHour(now, timezone = 'Asia/Kolkata') {
    const dt = DateTime.isDateTime(now)
        ? now.setZone(timezone)
        : DateTime.fromJSDate(now instanceof Date ? now : new Date(now), { zone: timezone });
    return dt.hour >= SEND_HOUR_START && dt.hour <= SEND_HOUR_END;
}

/**
 * Half-day holidays still expect a punch on the working half.
 * Drop them so the working-day predicate does not treat the whole day as off.
 */
export function calendarWithoutHalfDayHolidays(calendar) {
    if (!calendar) return null;
    return {
        ...calendar,
        holidays: (calendar.holidays || []).filter((holiday) => holiday && holiday.isHalfDay !== true),
    };
}

export function buildWorkingDayKeyFn(calendar, timezone) {
    const dayKey = (date) => getDateKeyInTimezone(date, timezone);
    return buildIsWorkingDayKeyFn(calendarWithoutHalfDayHolidays(calendar), timezone, dayKey);
}

/**
 * Working days in the service window with no punch-in and less than a full day of approved leave.
 * @returns {string[]} yyyy-MM-dd keys
 */
export function collectMissedPunchDateKeys({
    monthStartKey,
    walkEndKey,
    joiningDate,
    lastWorkingDate,
    terminationDate,
    timezone,
    isWorkingDayKeyFn,
    punchedDateKeys,
    paidLeaveByDay,
    lopByDay,
}) {
    if (!monthStartKey || !walkEndKey || walkEndKey < monthStartKey) return [];

    const { effStartKey, effEndKey } = resolvePayrollServiceDateKeys({
        monthStartKey,
        monthEndKey: walkEndKey,
        joiningDate,
        lastWorkingDate,
        terminationDate,
        timezone,
    });
    if (!effStartKey || !effEndKey || effStartKey > effEndKey) return [];

    const punched = punchedDateKeys instanceof Set ? punchedDateKeys : new Set(punchedDateKeys || []);
    const paid = paidLeaveByDay instanceof Map ? paidLeaveByDay : new Map();
    const lop = lopByDay instanceof Map ? lopByDay : new Map();
    const missed = [];

    eachDateKeyInInclusiveRange(effStartKey, effEndKey, timezone, (key) => {
        if (typeof isWorkingDayKeyFn === 'function' && !isWorkingDayKeyFn(key)) return;
        if (punched.has(key)) return;
        const covered = (Number(paid.get(key)) || 0) + (Number(lop.get(key)) || 0);
        if (covered >= 1) return;
        missed.push(key);
    });

    return missed;
}

export function leaveMapsForEmployee(leaves, walkStartKey, walkEndKey, timezone, isWorkingDayKeyFn) {
    const approved = leaves || [];
    return {
        paidLeaveByDay: buildPaidLeaveByDayMapForOrg(
            approved,
            walkStartKey,
            walkEndKey,
            timezone,
            isWorkingDayKeyFn
        ),
        lopByDay: buildLopUnpaidByDayMapForOrg(
            approved,
            walkStartKey,
            walkEndKey,
            timezone,
            isWorkingDayKeyFn
        ),
    };
}

export function formatMissedPunchDate(dateKey, timezone = 'Asia/Kolkata') {
    return parseDateKeyInTimezone(dateKey, timezone).toFormat('dd LLL yyyy');
}

function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

/**
 * Subject, plain text, and HTML for one reminder stage.
 */
export function buildMissedPunchReminderEmail({
    employeeName,
    stage,
    missedDateKeys,
    monthLabel,
    timezone = 'Asia/Kolkata',
    regularizationUrl,
}) {
    const name = employeeName || 'there';
    const dates = (missedDateKeys || []).map((key) => formatMissedPunchDate(key, timezone));
    const dateLines = dates.map((label) => `- ${label}`).join('\n');
    const dateItems = dates.map((label) => `<li>${escapeHtml(label)}</li>`).join('');
    const link = regularizationUrl
        ? `\n\nRegularize attendance: ${regularizationUrl}`
        : '';
    const linkHtml = regularizationUrl
        ? `<p><a href="${escapeHtml(regularizationUrl)}">Regularize attendance</a></p>`
        : '';

    if (stage === 'lop') {
        const subject = `Reminder: regularize attendance or these days will be LOP — ${monthLabel}`;
        const message = [
            `Hi ${name},`,
            '',
            `This is a reminder. These working days in ${monthLabel} still have no punch-in:`,
            '',
            dateLines,
            '',
            'Please regularize them and get the request approved before the month closes. Any of these days that stay missing will be treated as unpaid absent (loss of pay).',
            link,
        ].join('\n');

        const html = `
            <p>Hi ${escapeHtml(name)},</p>
            <p>This is a reminder. These working days in ${escapeHtml(monthLabel)} still have no punch-in:</p>
            <ul>${dateItems}</ul>
            <p>Please regularize them and get the request approved before the month closes. Any of these days that stay missing will be treated as unpaid absent (loss of pay).</p>
            ${linkHtml}
        `;
        return { subject, message, html };
    }

    const subject = `Regularize your attendance — ${monthLabel}`;
    const message = [
        `Hi ${name},`,
        '',
        `These working days in ${monthLabel} have no punch-in:`,
        '',
        dateLines,
        '',
        'Please submit an attendance regularization request for each date. Approval is required before the month closes.',
        link,
    ].join('\n');

    const html = `
        <p>Hi ${escapeHtml(name)},</p>
        <p>These working days in ${escapeHtml(monthLabel)} have no punch-in:</p>
        <ul>${dateItems}</ul>
        <p>Please submit an attendance regularization request for each date. Approval is required before the month closes.</p>
        ${linkHtml}
    `;
    return { subject, message, html };
}
