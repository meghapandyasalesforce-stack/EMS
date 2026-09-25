import { roundLeaveDays } from './leaveBalanceRulesHelper.js';

const DAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

function startOfLocalDay(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    date.setHours(0, 0, 0, 0);
    return date;
}

function inclusiveCalendarDays(start, end) {
    const msPerDay = 1000 * 60 * 60 * 24;
    return Math.ceil((end - start) / msPerDay) + 1;
}

function calendarForDate(date, calendarsByYear) {
    if (!calendarsByYear) return null;
    if (typeof calendarsByYear.get === 'function') {
        return calendarsByYear.get(date.getFullYear()) || null;
    }
    return calendarsByYear[date.getFullYear()] || null;
}

function isActiveHoliday(date, calendar) {
    if (!calendar?.holidays?.length) return false;
    const key = date.toDateString();
    return calendar.holidays.some((holiday) => {
        if (holiday?.isActive === false) return false;
        const holidayDate = new Date(holiday.date);
        return !Number.isNaN(holidayDate.getTime()) && holidayDate.toDateString() === key;
    });
}

function isWorkingDay(date, calendar) {
    const dayName = DAY_NAMES[date.getDay()];
    if (!calendar?.workingDays) {
        return date.getDay() >= 1 && date.getDay() <= 5;
    }
    return Boolean(calendar.workingDays[dayName]);
}

/**
 * Day count for a range, matching leave application:
 * every calendar day when the policy counts both weekends and holidays,
 * otherwise working days with holidays excluded.
 */
export function countPolicyLeaveDays(startDate, endDate, dateHandlingRules, calendarsByYear) {
    const start = startOfLocalDay(startDate);
    const end = startOfLocalDay(endDate);
    if (!start || !end || start > end) return 0;

    const rules = dateHandlingRules || {};
    if (rules.countWeekends && rules.countHolidays) {
        return inclusiveCalendarDays(start, end);
    }

    let counted = 0;
    const cursor = new Date(start);
    while (cursor <= end) {
        const calendar = calendarForDate(cursor, calendarsByYear);
        if (isWorkingDay(cursor, calendar) && !isActiveHoliday(cursor, calendar)) {
            counted += 1;
        }
        cursor.setDate(cursor.getDate() + 1);
    }
    return counted;
}

/**
 * Split a leave's stored duration across the calendar months it covers.
 * A leave that stays in one month keeps its full duration in that month.
 * Slices are rounded and the last month absorbs the remainder so they sum to duration.
 *
 * @returns {Map<string, number>} keys are `${year}-${monthIndex}`
 */
export function allocateLeaveDurationAcrossMonths(leave, options = {}) {
    const duration = Number(leave?.duration) || 0;
    const slices = new Map();
    if (duration <= 0 || !leave?.startDate || !leave?.endDate) return slices;

    const start = startOfLocalDay(leave.startDate);
    const end = startOfLocalDay(leave.endDate);
    if (!start || !end || start > end) return slices;

    const rules = options.dateHandlingRules || {};
    const calendarsByYear = options.calendarsByYear || null;
    const portions = [];
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    const lastMonth = new Date(end.getFullYear(), end.getMonth(), 1);

    while (cursor <= lastMonth) {
        const year = cursor.getFullYear();
        const monthIndex = cursor.getMonth();
        const monthStart = new Date(year, monthIndex, 1);
        const monthEnd = new Date(year, monthIndex + 1, 0);
        monthEnd.setHours(0, 0, 0, 0);
        const overlapStart = start > monthStart ? start : monthStart;
        const overlapEnd = end < monthEnd ? end : monthEnd;
        const counted = overlapStart <= overlapEnd
            ? countPolicyLeaveDays(overlapStart, overlapEnd, rules, calendarsByYear)
            : 0;
        portions.push({ key: `${year}-${monthIndex}`, counted });
        cursor.setMonth(cursor.getMonth() + 1);
    }

    const totalCounted = portions.reduce((sum, portion) => sum + portion.counted, 0);
    if (portions.length === 1 || totalCounted <= 0) {
        slices.set(`${start.getFullYear()}-${start.getMonth()}`, roundLeaveDays(duration));
        return slices;
    }

    const lastCountedIndex = portions.reduce(
        (found, portion, index) => (portion.counted > 0 ? index : found),
        -1
    );
    let allocated = 0;
    portions.forEach((portion, index) => {
        if (portion.counted <= 0) return;
        const isLastCounted = index === lastCountedIndex;
        const slice = isLastCounted
            ? roundLeaveDays(Math.max(0, duration - allocated))
            : roundLeaveDays(duration * (portion.counted / totalCounted));
        allocated = roundLeaveDays(allocated + slice);
        if (slice > 0) {
            slices.set(portion.key, roundLeaveDays((slices.get(portion.key) || 0) + slice));
        }
    });

    return slices;
}
