import { DateTime } from 'luxon';
import { normalizeTimezone } from './timezoneHelper.js';

/** Indian FY order: April → March */
export const FY_MONTHS = [
    'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December', 'January', 'February', 'March'
];

export function normalizeMonthName(month) {
    const raw = String(month || '').trim();
    if (!raw) return '';
    return raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
}

/** Calendar year + English month name for a Date in an IANA timezone (SaaS-safe). */
export function getCalendarPartsInTimezone(dateInput, timezone) {
    const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
    if (Number.isNaN(d.getTime())) return null;
    const dt = DateTime.fromJSDate(d, { zone: normalizeTimezone(timezone) });
    if (!dt.isValid) return null;
    return {
        year: dt.year,
        monthName: dt.setLocale('en-US').toFormat('MMMM'),
        monthIndex0: dt.month - 1
    };
}

export function getFyMonthIndex(month, year) {
    const normalized = normalizeMonthName(month);
    const idx = FY_MONTHS.findIndex((m) => m.toLowerCase() === normalized.toLowerCase());
    if (idx >= 0) return idx;
    const parsed = new Date(`${month} 1, ${year}`);
    if (Number.isNaN(parsed.getTime())) return 0;
    const calendarIdx = parsed.getMonth();
    const map = { 3: 0, 4: 1, 5: 2, 6: 3, 7: 4, 8: 5, 9: 6, 10: 7, 11: 8, 0: 9, 1: 10, 2: 11 };
    return map[calendarIdx] ?? 0;
}

export function getFyStartYear(month, year) {
    const yearNum = typeof year === 'number' ? year : parseInt(String(year), 10);
    const monthIndex = new Date(`${month} 1, ${yearNum}`).getMonth();
    return monthIndex >= 3 ? yearNum : yearNum - 1;
}

export function getCalendarYearForFyMonth(fyStartYear, fyMonthIndex) {
    return fyMonthIndex <= 8 ? fyStartYear : fyStartYear + 1;
}

export function listFyMonthsBefore(month, year) {
    const fyStartYear = getFyStartYear(month, year);
    const currentIdx = getFyMonthIndex(month, year);
    const result = [];

    for (let i = 0; i < currentIdx; i += 1) {
        result.push({
            month: FY_MONTHS[i],
            year: getCalendarYearForFyMonth(fyStartYear, i)
        });
    }

    return result;
}

export function listFyMonthsAfter(month, year, count) {
    if (count <= 0) return [];

    const fyStartYear = getFyStartYear(month, year);
    const currentIdx = getFyMonthIndex(month, year);
    const result = [];

    for (let i = 1; i <= count; i += 1) {
        const fyIdx = currentIdx + i;
        if (fyIdx >= FY_MONTHS.length) break;
        result.push({
            month: FY_MONTHS[fyIdx],
            year: getCalendarYearForFyMonth(fyStartYear, fyIdx)
        });
    }

    return result;
}

/**
 * FY month index (0=April … 11=March) of last working / termination date.
 * @param {object} emp
 * @param {string} [timezone] org IANA TZ — defaults via normalizeTimezone (UTC if missing)
 */
export function getExitFyMonthIndex(emp, timezone) {
    const exitRaw = emp?.lastWorkingDate || emp?.terminationDate;
    if (!exitRaw) return null;

    const parts = getCalendarPartsInTimezone(exitRaw, timezone);
    if (!parts) return null;
    return getFyMonthIndex(parts.monthName, parts.year);
}
