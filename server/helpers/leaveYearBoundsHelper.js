/**
 * Leave year/month bounds for selectors and API validation.
 * UI range: 2016 through current year, all calendar months.
 * Accrual still respects employee joining date inside the balance engine.
 */

import { LEAVE_HISTORY_MIN_YEAR } from '../constants/leaveDefaults.js';

export function getEmployeeLeaveYearBounds(employee, referenceDate = new Date()) {
    const ref = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
    const currentYear = ref.getFullYear();
    const currentMonth = ref.getMonth() + 1;

    let joiningDate = null;
    if (employee?.joiningDate) {
        const parsed = new Date(employee.joiningDate);
        if (!Number.isNaN(parsed.getTime())) {
            joiningDate = parsed;
        }
    }

    const joiningYear = joiningDate ? joiningDate.getFullYear() : LEAVE_HISTORY_MIN_YEAR;
    const joiningMonth = joiningDate ? joiningDate.getMonth() + 1 : 1;

    return {
        joiningDate,
        joiningYear,
        joiningMonth,
        minYear: LEAVE_HISTORY_MIN_YEAR,
        maxYear: currentYear,
        currentYear,
        currentMonth,
    };
}

export function isLeaveYearAllowed(viewYear, bounds) {
    const y = Number(viewYear);
    if (!Number.isInteger(y)) return false;
    return y >= LEAVE_HISTORY_MIN_YEAR && y <= bounds.maxYear;
}

/**
 * Clamp view month/year — years 2016..now; all months 1–12 (future capped to today).
 */
export function clampLeaveViewPeriod(viewYear, viewMonth, bounds) {
    let year = Number(viewYear);
    let month = Number(viewMonth);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return { year: bounds.maxYear, month: bounds.currentMonth, clamped: true };
    }

    let clamped = false;

    if (year < LEAVE_HISTORY_MIN_YEAR) {
        year = LEAVE_HISTORY_MIN_YEAR;
        clamped = true;
    }
    if (year > bounds.maxYear) {
        year = bounds.maxYear;
        clamped = true;
    }

    if (month < 1) {
        month = 1;
        clamped = true;
    }
    if (month > 12) {
        month = 12;
        clamped = true;
    }

    if (year === bounds.maxYear && month > bounds.currentMonth) {
        month = bounds.currentMonth;
        clamped = true;
    }

    return { year, month, clamped };
}

/**
 * Earliest period for recalculation — January 2016 unless later than selected.
 */
export function clampLeavePeriodStart(fromYear, fromMonth, bounds) {
    let year = Number(fromYear);
    let month = Number(fromMonth);

    if (!Number.isInteger(year) || !Number.isInteger(month)) {
        return { year: LEAVE_HISTORY_MIN_YEAR, month: 1, clamped: true };
    }

    const startValue = year * 12 + month;
    const minValue = LEAVE_HISTORY_MIN_YEAR * 12 + 1;

    if (startValue < minValue) {
        return { year: LEAVE_HISTORY_MIN_YEAR, month: 1, clamped: true };
    }

    const currentValue = bounds.currentYear * 12 + bounds.currentMonth;
    if (startValue > currentValue) {
        return { year: bounds.currentYear, month: bounds.currentMonth, clamped: true };
    }

    return { year, month, clamped: false };
}

export function buildYearRange(minYear, maxYear) {
    const years = [];
    for (let y = minYear; y <= maxYear; y += 1) {
        years.push(y);
    }
    return years;
}
