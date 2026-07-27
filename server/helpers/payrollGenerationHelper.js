import { DateTime } from 'luxon';
import Attendance from '../models/attendance.model.js';
import Leave from '../models/leave.model.js';
import Calendar from '../models/calendar.model.js';
import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import SalaryStructure from '../models/salaryStructure.model.js';
import logger from './logger.js';
import { computeEarningsFromGross, computeSalaryStructureCoreEarnings, employeePfFromBasicWage, employerPfFromBasicWage, pfWageFromBasicWage } from './salaryCalculation.js';
import { getEffectiveSalaryForMonth } from './salaryRevisionHelper.js';
import { computeRegimeIncomeTaxCumulative, clearTdsCalculationModeCache } from './tdsCumulativeHelper.js';
import { getCachedEffectiveTimezone } from './orgContextCache.js';
import { getDateKeyInTimezone, getEndOfDayInTimezone, getPayrollMonthUtcBounds, normalizeTimezone } from './timezoneHelper.js';
import { buildAttendancePeriodFilter, parseDateKeyInTimezone } from './attendanceDayHelper.js';
import { DEFAULT_TIMEZONE } from '../constants/timezoneOptions.js';

export { getPayrollMonthUtcBounds };

const WEEKDAY_NAMES = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Default overtime multiplier when salary structure does not specify a rate. */
export const DEFAULT_OVERTIME_RATE = 1.5;

/** ESI applies only when monthly gross is at or below this statutory limit (₹21,000). */
export const ESI_GROSS_WAGE_LIMIT = 21000;

// Cache calendar docs during a single Node process run to avoid
// repeated DB reads for every employee in the same month/year.
const calendarCache = new Map();
const salaryStructureByIdCache = new Map();
const salaryStructureByApplicabilityCache = new Map();

export function clearPayrollGenerationCaches({ organizationId, structureId } = {}) {
    clearTdsCalculationModeCache(organizationId);

    const orgKey = organizationId ? `${String(organizationId)}:` : null;
    const structureKey = structureId && organizationId ? `${String(organizationId)}:${String(structureId)}` : null;

    if (!orgKey) {
        salaryStructureByIdCache.clear();
        salaryStructureByApplicabilityCache.clear();
        return;
    }

    for (const key of salaryStructureByIdCache.keys()) {
        if (structureKey ? key === structureKey : key.startsWith(orgKey)) {
            salaryStructureByIdCache.delete(key);
        }
    }

    for (const key of salaryStructureByApplicabilityCache.keys()) {
        if (key.startsWith(orgKey)) {
            salaryStructureByApplicabilityCache.delete(key);
        }
    }
}

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function computeConfiguredComponent(config, baseAmount) {
    const cfg = config && typeof config === 'object' ? config : {};
    const base = Math.max(0, asNumber(baseAmount, 0));
    const percentage = asNumber(cfg.percentage, 0);
    const fixedAmount = asNumber(cfg.fixedAmount, 0);
    const isPercentage = cfg.isPercentage !== false;
    const raw = isPercentage ? (base * percentage) / 100 : fixedAmount;
    return Math.round(Math.max(0, raw));
}

async function computeRegimeIncomeTax(emp, salaryStructure, deductions, earnings, month, year, organizationId) {
    return computeRegimeIncomeTaxCumulative({
        emp,
        salaryStructure,
        deductions,
        earnings,
        month,
        year,
        organizationId
    });
}

function bonusFromRule(rule, baseAmount) {
    const r = rule && typeof rule === 'object' ? rule : {};
    if (!r.enabled) return 0;
    const pct = asNumber(r.percentage, 0);
    const maxAmount = asNumber(r.maxAmount, 0);
    let computed = Math.round((Math.max(0, asNumber(baseAmount, 0)) * pct) / 100);
    if (maxAmount > 0) computed = Math.min(computed, Math.round(maxAmount));
    return Math.max(0, computed);
}

async function resolveSalaryStructureForEmployee(emp, organizationId) {
    const orgId = String(organizationId || '');
    if (!orgId) return null;

    const assignedStructureId = emp?.salaryStructure ? String(emp.salaryStructure) : '';
    if (assignedStructureId) {
        const byIdCacheKey = `${orgId}:${assignedStructureId}`;
        if (salaryStructureByIdCache.has(byIdCacheKey)) {
            return salaryStructureByIdCache.get(byIdCacheKey);
        }

        const assigned = await SalaryStructure.findOne({
            _id: assignedStructureId,
            organizationId: organizationId,
            isActive: true
        }).lean();
        salaryStructureByIdCache.set(byIdCacheKey, assigned || null);
        if (assigned) return assigned;
    }

    const dept = (emp?.department || '').trim();
    const position = (emp?.position || '').trim();
    const level = emp?.roleLevel != null ? String(emp.roleLevel) : '';
    const applicabilityCacheKey = `${orgId}:${dept}:${position}:${level}`;
    if (salaryStructureByApplicabilityCache.has(applicabilityCacheKey)) {
        return salaryStructureByApplicabilityCache.get(applicabilityCacheKey);
    }

    const targetedFilters = [];
    if (dept) targetedFilters.push({ applicableTo: 'department', applicableValues: dept });
    if (position) targetedFilters.push({ applicableTo: 'position', applicableValues: position });
    if (level) targetedFilters.push({ applicableTo: 'level', applicableValues: level });

    let matched = null;
    if (targetedFilters.length > 0) {
        matched = await SalaryStructure.findOne({
            organizationId: organizationId,
            isActive: true,
            $or: targetedFilters
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();
    }

    if (!matched) {
        matched = await SalaryStructure.findOne({
            organizationId: organizationId,
            isActive: true,
            applicableTo: 'all'
        })
            .sort({ updatedAt: -1, createdAt: -1 })
            .lean();
    }

    salaryStructureByApplicabilityCache.set(applicabilityCacheKey, matched || null);
    return matched || null;
}

function startOfDay(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    return x;
}

function endOfDay(d) {
    const x = new Date(d);
    x.setHours(23, 59, 59, 999);
    return x;
}

function getDayName(date) {
    // Match keys in `calendar.workingDays`: monday..sunday
    return ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][date.getDay()];
}

/** Weekday name for yyyy-MM-dd in the org IANA timezone (SaaS-safe; no server TZ). */
export function getDayNameFromDateKey(dateKey, timezone) {
    const dt = parseDateKeyInTimezone(dateKey, timezone);
    return WEEKDAY_NAMES[dt.weekday - 1];
}

function createDayKeyFn(timezone) {
    return (date) => getDateKeyInTimezone(date, timezone);
}

function buildHolidayDateKeySet(calendar, dayKey) {
    return new Set(
        (calendar?.holidays || [])
            .filter((h) => h && h.isActive !== false)
            .map((h) => {
                const hd = new Date(h.date);
                return Number.isNaN(hd.getTime()) ? null : dayKey(hd);
            })
            .filter(Boolean)
    );
}

/**
 * Working-day predicate keyed by org calendar day (yyyy-MM-dd).
 * Use this for attendance/payroll counting across any tenant timezone.
 */
export function buildIsWorkingDayKeyFn(calendar, timezone, dayKey) {
    const holidayDates = buildHolidayDateKeySet(calendar, dayKey);

    return (dateKey) => {
        if (!dateKey) return false;
        const dayName = getDayNameFromDateKey(dateKey, timezone);
        const isWorkingByWeek =
            calendar?.workingDays && typeof calendar.workingDays[dayName] === 'boolean'
                ? calendar.workingDays[dayName]
                : !['saturday', 'sunday'].includes(dayName);

        if (!isWorkingByWeek) return false;
        return !holidayDates.has(dateKey);
    };
}

/** Resolve canonical attendance day key for payroll bucketing. */
export function resolveAttendanceRecordDateKey(record, dayKey) {
    if (record?.attendanceDateKey) {
        return String(record.attendanceDateKey).slice(0, 10);
    }
    if (record?.date) {
        const d = new Date(record.date);
        if (!Number.isNaN(d.getTime())) {
            return dayKey(d);
        }
    }
    return null;
}

/** Walk inclusive yyyy-MM-dd range in org timezone. */
export function eachDateKeyInInclusiveRange(startKey, endKey, timezone, visit) {
    if (!startKey || !endKey || startKey > endKey) return;
    let cursor = parseDateKeyInTimezone(startKey, timezone);
    const end = parseDateKeyInTimezone(endKey, timezone);
    while (cursor <= end) {
        visit(cursor.toFormat('yyyy-MM-dd'));
        cursor = cursor.plus({ days: 1 });
    }
}

/** Count working days between two org date keys (inclusive). */
export function countWorkingDaysInDateKeyRange(startKey, endKey, timezone, isWorkingDayKeyFn) {
    let working = 0;
    eachDateKeyInInclusiveRange(startKey, endKey, timezone, (key) => {
        if (isWorkingDayKeyFn(key)) working += 1;
    });
    return working;
}

/** Count calendar days between two org date keys (inclusive). */
export function countCalendarDaysInDateKeyRange(startKey, endKey, timezone) {
    let days = 0;
    eachDateKeyInInclusiveRange(startKey, endKey, timezone, () => {
        days += 1;
    });
    return days;
}

/**
 * Clamp join / termination into the payroll month using org-timezone date keys.
 * Avoids server-local Date month-end spilling into the next calendar day (e.g. UTC → IST +1).
 */
export function resolvePayrollServiceDateKeys({
    monthStartKey,
    monthEndKey,
    joiningDate,
    lastWorkingDate,
    terminationDate,
    timezone
}) {
    let effStartKey = monthStartKey;
    let effEndKey = monthEndKey;

    if (joiningDate) {
        const joinKey = getDateKeyInTimezone(new Date(joiningDate), timezone);
        if (joinKey && joinKey > effStartKey) {
            effStartKey = joinKey;
        }
    }

    const term = lastWorkingDate || terminationDate;
    if (term) {
        const endKey = getDateKeyInTimezone(new Date(term), timezone);
        if (endKey && endKey < effEndKey) {
            effEndKey = endKey;
        }
    }

    return { effStartKey, effEndKey };
}

/**
 * Build dateKey → attendance credit from raw rows using org date keys only.
 */
export function buildAttendanceCreditByDay(records, { dayKey, isWorkingDayKeyFn, creditFn }) {
    const attByDay = new Map();
    const resolvedCreditFn = typeof creditFn === 'function' ? creditFn : attendanceDayCredit;
    for (const r of records) {
        const key = resolveAttendanceRecordDateKey(r, dayKey);
        if (!key || (typeof isWorkingDayKeyFn === 'function' && !isWorkingDayKeyFn(key))) {
            continue;
        }
        const c = resolvedCreditFn(r);
        attByDay.set(key, Math.min(1, Math.max(attByDay.get(key) || 0, c)));
    }
    return attByDay;
}

export function buildIsWorkingDayFn(calendar, dayKey) {
    if (!calendar) return null;

    const holidayDates = buildHolidayDateKeySet(calendar, dayKey);

    return (date) => {
        const dayName = getDayName(date);
        const isWorkingByWeek =
            calendar?.workingDays && typeof calendar.workingDays[dayName] === 'boolean'
                ? calendar.workingDays[dayName]
                : date.getDay() !== 0 && date.getDay() !== 6; // fallback: Mon–Fri

        if (!isWorkingByWeek) return false;
        return !holidayDates.has(dayKey(date));
    };
}

/** Count inclusive working days between two calendar dates. */
export function countWorkingDaysInclusive(rangeStart, rangeEnd, isWorkingDayFn) {
    if (rangeStart > rangeEnd) return 0;
    let working = 0;
    for (let d = new Date(rangeStart); d <= rangeEnd; d.setDate(d.getDate() + 1)) {
        const isWorking = typeof isWorkingDayFn === 'function' ? isWorkingDayFn(d) : d.getDay() !== 0 && d.getDay() !== 6;
        if (isWorking) working += 1;
    }
    return working;
}

/** Count inclusive calendar days between two dates (ignores working-day rules). */
export function countCalendarDaysInclusive(rangeStart, rangeEnd) {
    if (rangeStart > rangeEnd) return 0;
    const a = startOfDay(new Date(rangeStart));
    const b = startOfDay(new Date(rangeEnd));
    const diffMs = b.getTime() - a.getTime();
    return Math.floor(diffMs / (24 * 60 * 60 * 1000)) + 1;
}

export function leaveWorkingDaysInRange(lv, rangeStart, rangeEnd, isWorkingDayFn) {
    const start = new Date(lv.startDate);
    const end = new Date(lv.endDate);
    const overlapStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
    const overlapEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
    if (overlapStart > overlapEnd) return 0;
    let working = 0;
    for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
        const isWorking = typeof isWorkingDayFn === 'function' ? isWorkingDayFn(d) : d.getDay() !== 0 && d.getDay() !== 6;
        if (isWorking) working += 1;
    }
    return working;
}

function mapLeaveTypeForPayroll(leaveType) {
    const t = (leaveType || '').toString().toLowerCase();
    if (t === 'sick') return 'Sick';
    if (t === 'casual') return 'Casual';
    if (t === 'vacation' || t === 'annual' || t === 'paid') return 'Vacation';
    return 'Other';
}

/** Full-day standard for attendance weighting (aligned with overtime divisor in this module). */
const STANDARD_FULL_DAY_HOURS = 8;

/** Hours used for payroll attendance credit: gross (in-office) first, then effective fallback. */
function attendanceHoursWorked(record) {
    const gross = Number(record.grossHours);
    const eff = Number(record.effectiveHours);
    if (Number.isFinite(gross) && gross > 0) return gross;
    if (Number.isFinite(eff) && eff > 0) return eff;
    return 0;
}

/**
 * Paid-day credit (0–1) from one attendance row using worked hours (gross, else effective).
 * present/loggedOut with 0 gross and 0 effective hours → 0 (treat as no paid time).
 */
export function attendanceDayCredit(record) {
    const status = (record.status || '').toLowerCase();
    const h = attendanceHoursWorked(record);
    if (h <= 0) return 0;
    if (status === 'half-day') return Math.min(0.5, h / STANDARD_FULL_DAY_HOURS);
    if (status === 'present' || status === 'loggedout') return Math.min(1, h / STANDARD_FULL_DAY_HOURS);
    return 0;
}

/**
 * Day-based credit: punch-in + punch-out required; credit determined by hour thresholds.
 * When markHalfDayIfLate is on and the row is a late arrival, credit is capped at 0.5.
 * @param {object} record - Attendance record
 * @param {number} minHoursForFullDay - Hours needed for full day credit
 * @param {number} minHoursForHalfDay - Hours needed for half day credit
 * @param {{ markHalfDayIfLate?: boolean }} [options]
 */
export function attendanceDayCreditDayBased(
    record,
    minHoursForFullDay = 8,
    minHoursForHalfDay = 4,
    options = {}
) {
    const status = (record.status || '').toLowerCase();
    // Must have punched out (loggedout or half-day status); pure punch-in with no checkout = 0
    if (status !== 'loggedout' && status !== 'present' && status !== 'half-day') return 0;
    // Attendance model uses clockOut (legacy alias checkOut supported)
    if (!record.clockOut && !record.checkOut) return 0;
    const h = attendanceHoursWorked(record);
    let credit = 0;
    if (h >= minHoursForFullDay) credit = 1;
    else if (h >= minHoursForHalfDay) credit = 0.5;

    if (status === 'half-day') {
        credit = Math.min(credit, 0.5);
    }
    if (options.markHalfDayIfLate && record.isLateArrival) {
        credit = Math.min(credit, 0.5);
    }
    return credit;
}

/** Sum paid-day credits over org date keys in [walkStartKey, walkEndKey]. */
export function sumEffectivePresentDaysByKeys(
    walkStartKey,
    walkEndKey,
    attByDay,
    paidLeaveByDay,
    timezone,
    isWorkingDayKeyFn
) {
    let total = 0;
    eachDateKeyInInclusiveRange(walkStartKey, walkEndKey, timezone, (key) => {
        if (typeof isWorkingDayKeyFn === 'function' && !isWorkingDayKeyFn(key)) {
            return;
        }
        const att = attByDay.get(key) || 0;
        const lev = paidLeaveByDay.get(key) || 0;
        total += Math.min(1, att + lev);
    });
    return total;
}

/**
 * Map dateKey → paid leave credit using org calendar days (timezone-safe).
 */
export function buildPaidLeaveByDayMapForOrg(
    approvedLeaves,
    walkStartKey,
    walkEndKey,
    timezone,
    isWorkingDayKeyFn
) {
    const paidLeaveByDay = new Map();

    for (const lv of approvedLeaves) {
        const isLop = (lv.leaveType || '').toString().toLowerCase() === 'loss_of_pay';
        if (isLop) continue;

        const isHalf = lv.isHalfDay === true || Number(lv.duration) === 0.5;
        const leaveStartKey = getDateKeyInTimezone(new Date(lv.startDate), timezone);
        const leaveEndKey = getDateKeyInTimezone(new Date(lv.endDate), timezone);
        const overlapStartKey = leaveStartKey > walkStartKey ? leaveStartKey : walkStartKey;
        const overlapEndKey = leaveEndKey < walkEndKey ? leaveEndKey : walkEndKey;
        if (overlapStartKey > overlapEndKey) continue;

        if (isHalf) {
            let credited = false;
            eachDateKeyInInclusiveRange(overlapStartKey, overlapEndKey, timezone, (key) => {
                if (credited) return;
                if (typeof isWorkingDayKeyFn === 'function' && !isWorkingDayKeyFn(key)) {
                    return;
                }
                paidLeaveByDay.set(key, Math.min(1, (paidLeaveByDay.get(key) || 0) + 0.5));
                credited = true;
            });
            continue;
        }

        eachDateKeyInInclusiveRange(overlapStartKey, overlapEndKey, timezone, (key) => {
            if (typeof isWorkingDayKeyFn === 'function' && !isWorkingDayKeyFn(key)) {
                return;
            }
            paidLeaveByDay.set(key, Math.min(1, (paidLeaveByDay.get(key) || 0) + 1));
        });
    }

    return paidLeaveByDay;
}

/** Count leave working days overlapping a period using org date keys. */
export function leaveWorkingDaysInDateKeyRange(lv, walkStartKey, walkEndKey, timezone, isWorkingDayKeyFn) {
    const leaveStartKey = getDateKeyInTimezone(new Date(lv.startDate), timezone);
    const leaveEndKey = getDateKeyInTimezone(new Date(lv.endDate), timezone);
    const overlapStartKey = leaveStartKey > walkStartKey ? leaveStartKey : walkStartKey;
    const overlapEndKey = leaveEndKey < walkEndKey ? leaveEndKey : walkEndKey;
    if (overlapStartKey > overlapEndKey) return 0;

    let working = 0;
    eachDateKeyInInclusiveRange(overlapStartKey, overlapEndKey, timezone, (key) => {
        if (typeof isWorkingDayKeyFn === 'function' ? isWorkingDayKeyFn(key) : true) {
            working += 1;
        }
    });
    return working;
}

function isWorkingDayForPayroll(day, isWorkingDayFn) {
    return typeof isWorkingDayFn === 'function'
        ? isWorkingDayFn(day)
        : day.getDay() !== 0 && day.getDay() !== 6;
}

/**
 * Map dateKey → paid leave credit (0–1) for approved non–loss-of-pay leaves overlapping [effStart, effEnd].
 * Half-day leave: 0.5 on the first overlapping working day only.
 */
export function buildPaidLeaveByDayMap(approvedLeaves, effStart, effEnd, isWorkingDayFn, dayKey) {
    const paidLeaveByDay = new Map();
    const rangeStart = startOfDay(new Date(effStart));
    const rangeEnd = startOfDay(new Date(effEnd));

    for (const lv of approvedLeaves) {
        const isLop = (lv.leaveType || '').toString().toLowerCase() === 'loss_of_pay';
        if (isLop) continue;

        const isHalf = lv.isHalfDay === true || Number(lv.duration) === 0.5;
        const start = new Date(lv.startDate);
        const end = new Date(lv.endDate);
        const overlapStart = new Date(Math.max(start.getTime(), rangeStart.getTime()));
        const overlapEnd = new Date(Math.min(end.getTime(), rangeEnd.getTime()));
        if (overlapStart > overlapEnd) continue;

        if (isHalf) {
            for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
                const day = new Date(d);
                if (!isWorkingDayForPayroll(day, isWorkingDayFn)) continue;
                const key = dayKey(day);
                paidLeaveByDay.set(key, Math.min(1, (paidLeaveByDay.get(key) || 0) + 0.5));
                break;
            }
            continue;
        }

        for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
            const day = new Date(d);
            if (!isWorkingDayForPayroll(day, isWorkingDayFn)) continue;
            const key = dayKey(day);
            paidLeaveByDay.set(key, Math.min(1, (paidLeaveByDay.get(key) || 0) + 1));
        }
    }

    return paidLeaveByDay;
}

/** Sum daily credits over working days in [walkStart, walkEnd]: each day min(1, attendance + paid leave). */
export function sumEffectivePresentDays(walkStart, walkEnd, attByDay, paidLeaveByDay, isWorkingDayFn, dayKey) {
    let total = 0;
    const a = startOfDay(new Date(walkStart));
    const b = startOfDay(new Date(walkEnd));
    if (a > b) return 0;
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        const day = new Date(d);
        if (!isWorkingDayForPayroll(day, isWorkingDayFn)) continue;
        const key = dayKey(day);
        const att = attByDay.get(key) || 0;
        const lev = paidLeaveByDay.get(key) || 0;
        total += Math.min(1, att + lev);
    }
    return total;
}

/** Pure proration math used by payroll generation (exported for unit tests). */
export function computePayrollProration({
    fullGross,
    fullMonthCalDays,
    serviceWindowCalDays,
    attendanceWorkingDays,
    effectivePresent
}) {
    const unpaidWorkingDays = Math.max(0, attendanceWorkingDays - effectivePresent);
    const paidPayrollDays = Math.max(0, serviceWindowCalDays - unpaidWorkingDays);
    const effectiveGross =
        fullMonthCalDays > 0
            ? Math.round((fullGross * paidPayrollDays) / fullMonthCalDays)
            : 0;
    return { unpaidWorkingDays, paidPayrollDays, effectiveGross };
}

/**
 * Calendar days salary was paid for on the payslip:
 * service window in the month (join→LWD) minus unpaid working-day absences.
 * Matches payroll proration's paidPayrollDays (not attendance workingDays).
 */
export function resolvePayslipSalaryPaidDays({
    month,
    year,
    unpaidLeave,
    joiningDate,
    lastWorkingDate,
    terminationDate,
    timezone = DEFAULT_TIMEZONE,
    fallbackWorkingDays = null
}) {
    const yearNum = parseInt(year, 10);
    const monthIndex = new Date(`${month} 1, ${yearNum}`).getMonth();
    if (Number.isNaN(monthIndex) || Number.isNaN(yearNum)) {
        return fallbackWorkingDays;
    }

    const tz = normalizeTimezone(timezone);
    const monthStartDt = DateTime.fromObject(
        { year: yearNum, month: monthIndex + 1, day: 1 },
        { zone: tz }
    );
    if (!monthStartDt.isValid) {
        return fallbackWorkingDays;
    }

    const monthEndDt = monthStartDt.endOf('month');
    const monthStartKey = monthStartDt.toFormat('yyyy-MM-dd');
    const monthEndKey = monthEndDt.toFormat('yyyy-MM-dd');

    const { effStartKey, effEndKey } = resolvePayrollServiceDateKeys({
        monthStartKey,
        monthEndKey,
        joiningDate,
        lastWorkingDate,
        terminationDate,
        timezone: tz
    });

    if (!effStartKey || !effEndKey || effStartKey > effEndKey) {
        return 0;
    }

    const serviceWindowCalDays = countCalendarDaysInDateKeyRange(effStartKey, effEndKey, tz);
    const unpaid = Number(unpaidLeave);
    if (Number.isNaN(unpaid)) {
        return serviceWindowCalDays;
    }
    return Math.max(0, serviceWindowCalDays - Math.max(0, unpaid));
}

/**
 * Prefer final (or legacy undifferentiated) payroll over preview; then latest activity.
 * @param {Array<object>} payrolls
 */
export function pickDisplayPayroll(payrolls) {
    if (!payrolls || !payrolls.length) return null;
    const finals = payrolls.filter((p) => p.generationType !== 'preview');
    const pool = finals.length ? finals : payrolls;
    return pool
        .slice()
        .sort(
            (a, b) =>
                new Date(b.updatedAt || b.createdAt || 0) - new Date(a.updatedAt || a.createdAt || 0)
        )[0];
}

/**
 * True when final monthly run is allowed (last calendar day of target month or later in org TZ).
 * @param {Date} now
 * @param {number} targetYear
 * @param {number} targetMonthIndex — 0=January … 11=December
 * @param {string} [timezone] org IANA timezone
 */
export function isFinalGenerationAllowedForPeriod(now, targetYear, targetMonthIndex, timezone) {
    const nowDt = DateTime.fromJSDate(now instanceof Date ? now : new Date(now), {
        zone: timezone || 'UTC'
    });
    if (!nowDt.isValid) return false;
    const monthEnd = DateTime.fromObject(
        { year: targetYear, month: targetMonthIndex + 1, day: 1 },
        { zone: timezone || 'UTC' }
    ).endOf('month');
    return nowDt.startOf('day') >= monthEnd.startOf('day');
}

/**
 * Attendance-based payroll numbers for one employee and period.
 * @param {object} params
 * @param {object} params.emp — Employee doc (salary, joiningDate, organizationId, _id)
 * @param {string} params.month — e.g. "March"
 * @param {number} params.year
 * @param {object} params.organizationId
 * @param {'preview'|'final'} params.mode
 * @param {Date} [params.asOf] — For preview; defaults to now
 */
export async function buildGeneratedPayrollPayload({ emp, month, year, organizationId, mode, asOf }) {
    const yearNum = typeof year === 'number' ? year : parseInt(year, 10);
    const monthIndex = new Date(`${month} 1, ${yearNum}`).getMonth();

    void mode;
    void asOf;
    // Monthly payroll must always be computed on the full month's calendar window.
    // Keep `mode` for record state/workflow, but do not cap payroll math by asOf date.

    const orgId = emp.organizationId || organizationId;
    const orgTimezone = await getCachedEffectiveTimezone(orgId);
    const dayKey = createDayKeyFn(orgTimezone);

    // Fetch org payroll settings to determine calculation mode
    const orgDoc = await Organization.findById(orgId).select('settings').lean();
    const payrollSettings = orgDoc?.settings?.payrollSettings || {};
    const calculationMode = payrollSettings.calculationMode || 'work_hours';
    const minHoursForFullDay = Number(payrollSettings.minHoursForFullDay) || 8;
    const minHoursForHalfDay = Number(payrollSettings.minHoursForHalfDay) || 4;
    const markHalfDayIfLate = !!payrollSettings.markHalfDayIfLate;
    const creditFn = calculationMode === 'day_based'
        ? (r) =>
              attendanceDayCreditDayBased(r, minHoursForFullDay, minHoursForHalfDay, {
                  markHalfDayIfLate
              })
        : attendanceDayCredit;

    // Month bounds in org IANA timezone (never use server-local Date month-end — UTC→IST spills +1 day).
    const monthStartDt = DateTime.fromObject(
        { year: yearNum, month: monthIndex + 1, day: 1 },
        { zone: orgTimezone }
    );
    const monthEndDt = monthStartDt.endOf('month');
    const monthStartKey = monthStartDt.toFormat('yyyy-MM-dd');
    const monthEndKey = monthEndDt.toFormat('yyyy-MM-dd');

    const { effStartKey, effEndKey } = resolvePayrollServiceDateKeys({
        monthStartKey,
        monthEndKey,
        joiningDate: emp?.joiningDate,
        lastWorkingDate: emp?.lastWorkingDate,
        terminationDate: emp?.terminationDate,
        timezone: orgTimezone
    });

    if (!effStartKey || !effEndKey || effStartKey > effEndKey) {
        return {
            basicSalary: 0,
            earnings: {
                basicWage: 0,
                houseRentAllowance: 0,
                transportAllowance: 0,
                medicalAllowance: 0,
                overtime: 0,
                gratuity: 0,
                specialAllowance: 0,
                performanceBonus: 0,
                projectBonus: 0,
                attendanceBonus: 0,
                pfEmployer: 0,
                esiEmployer: 0,
                totalEarnings: 0
            },
            deductions: {
                pfEmployee: 0,
                esiEmployee: 0,
                professionalTax: 0,
                incomeTax: 0,
                advanceSalary: 0,
                loanDeduction: 0,
                otherDeductions: 0,
                total: 0
            },
            ctc: 0,
            inHandSalary: 0,
            workingDays: 0,
            presentDays: 0,
            unpaidLeave: 0,
            leaves: []
        };
    }

    const effStart = parseDateKeyInTimezone(effStartKey, orgTimezone).startOf('day').toJSDate();
    const effEnd = parseDateKeyInTimezone(effEndKey, orgTimezone).endOf('day').toJSDate();

    const calendarKey = `${String(orgId)}-${String(yearNum)}`;
    let calendar = calendarCache.get(calendarKey);
    if (!calendar) {
        calendar = await Calendar.findOne({ organizationId: orgId, year: yearNum }).lean();
        // Cache null too (so we don't keep querying if calendar doesn't exist).
        calendarCache.set(calendarKey, calendar || null);
    }
    const isWorkingDayKeyFn = buildIsWorkingDayKeyFn(calendar, orgTimezone, dayKey);

    // Working-day metric for attendance dashboards/reports (excludes weekends/holidays).
    const attendanceWorkingDays = Math.max(
        0,
        countWorkingDaysInDateKeyRange(effStartKey, effEndKey, orgTimezone, isWorkingDayKeyFn)
    );
    // Full calendar month length (e.g. April → 30) — used for a stable "one day" rate (G/D), including for terminated staff.
    const fullMonthCalDays = Math.max(
        1,
        countCalendarDaysInDateKeyRange(monthStartKey, monthEndKey, orgTimezone)
    );
    // Proration window: days employed in this month (join through last working/termination, capped at month end).
    const serviceWindowCalDays = Math.max(
        1,
        countCalendarDaysInDateKeyRange(effStartKey, effEndKey, orgTimezone)
    );

    const periodStart = monthStartDt.startOf('day').toJSDate();
    const periodEnd = getEndOfDayInTimezone(monthEndDt.toJSDate(), orgTimezone);

    const attendanceRecords =
        effStartKey <= effEndKey
            ? await Attendance.find({
                  userId: emp._id,
                  organizationId: orgId,
                  ...buildAttendancePeriodFilter({
                      startDateKey: monthStartKey,
                      endDateKey: monthEndKey,
                      periodStart,
                      periodEnd
                  })
              })
            : [];

    const attByDay = buildAttendanceCreditByDay(attendanceRecords, {
        dayKey,
        isWorkingDayKeyFn,
        creditFn
    });

    const totalOvertimeHours = attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    const approvedLeaves =
        effStartKey <= effEndKey
            ? await Leave.find({
                  employee: emp._id,
                  organizationId: orgId,
                  status: 'approved',
                  startDate: { $lte: effEnd },
                  endDate: { $gte: effStart }
              })
            : [];

    const payrollLeaves = approvedLeaves
        .map((lv) => {
            const overlapWorkingDays = leaveWorkingDaysInDateKeyRange(
                lv,
                effStartKey,
                effEndKey,
                orgTimezone,
                isWorkingDayKeyFn
            );
            if (!overlapWorkingDays) return null;

            // Half-day leave: single 0.5-day event on the first overlapping working day (matches pay credit).
            let days = overlapWorkingDays;
            if (lv?.isHalfDay === true || Number(lv?.duration) === 0.5) {
                days = 0.5;
            }
            const isLossOfPay = (lv.leaveType || '').toString().toLowerCase() === 'loss_of_pay';
            return {
                type: mapLeaveTypeForPayroll(lv.leaveType),
                reason: lv.reason,
                days,
                isLossOfPay
            };
        })
        .filter(Boolean);

    const paidLeaveByDay = buildPaidLeaveByDayMapForOrg(
        approvedLeaves,
        effStartKey,
        effEndKey,
        orgTimezone,
        isWorkingDayKeyFn
    );
    // Paid days = per working day in payroll window: min(1, attendance credit + approved paid leave), fractional OK.
    const effectivePresent = sumEffectivePresentDaysByKeys(
        effStartKey,
        effEndKey,
        attByDay,
        paidLeaveByDay,
        orgTimezone,
        isWorkingDayKeyFn
    );
    // Pay this month from revision-effective CTC (not live emp.salary alone), so TDS YTD
    // and earnings stay aligned when a hike lands mid-year (e.g. 21k → 21L in July).
    const fullGross = getEffectiveSalaryForMonth(emp, month, yearNum) || 0;
    // Weekend/holiday days are paid by default under calendar-day proration.
    // Only missing paid credit on working days reduces monthly payout.
    const { unpaidWorkingDays, paidPayrollDays, effectiveGross } = computePayrollProration({
        fullGross,
        fullMonthCalDays,
        serviceWindowCalDays,
        attendanceWorkingDays,
        effectivePresent
    });
    const salaryStructure = await resolveSalaryStructureForEmployee(emp, orgId);
    // Overtime / "one day" value: always monthly gross ÷ full month calendar days, not ÷ (join→term) window.
    const perDayRate = fullGross > 0 && fullMonthCalDays > 0 ? fullGross / fullMonthCalDays : 0;
    const unpaidDays = unpaidWorkingDays;

    let basicSalary = 0;
    let earnings;
    let deductions;

    if (salaryStructure) {
        const overtimeRules = salaryStructure.overtimeRules || {};
        const overtimeEnabled = overtimeRules.enabled !== false;
        const cappedOvertimeHours = overtimeEnabled
            ? Math.max(0, Math.min(
                asNumber(totalOvertimeHours, 0),
                asNumber(overtimeRules.maxHoursPerMonth, asNumber(totalOvertimeHours, 0))
            ))
            : 0;
        const overtimeRatePerHour = (perDayRate / 8) * asNumber(overtimeRules.rate, DEFAULT_OVERTIME_RATE);
        const overtimePay = overtimeEnabled ? Math.round(cappedOvertimeHours * overtimeRatePerHour) : 0;

        const coreEarnings = computeSalaryStructureCoreEarnings(salaryStructure, effectiveGross);
        const { basicWage, houseRentAllowance, transportAllowance, medicalAllowance, specialAllowance } = coreEarnings;

        earnings = {
            basicWage,
            houseRentAllowance,
            transportAllowance,
            medicalAllowance,
            overtime: overtimePay,
            gratuity: 0,
            specialAllowance,
            performanceBonus: bonusFromRule(salaryStructure?.bonusStructure?.performanceBonus, effectiveGross),
            projectBonus: bonusFromRule(salaryStructure?.bonusStructure?.projectBonus, effectiveGross),
            attendanceBonus: bonusFromRule(salaryStructure?.bonusStructure?.attendanceBonus, effectiveGross),
            pfEmployer: computeConfiguredComponent(salaryStructure?.earnings?.pfEmployer, effectiveGross),
            esiEmployer: computeConfiguredComponent(salaryStructure?.earnings?.esiEmployer, effectiveGross)
        };
        basicSalary = earnings.basicWage;
        const pfWageBase = pfWageFromBasicWage(basicSalary);
        earnings.pfEmployer = computeConfiguredComponent(salaryStructure?.earnings?.pfEmployer, pfWageBase);
        const esiEligible = effectiveGross <= ESI_GROSS_WAGE_LIMIT;
        earnings.esiEmployer = esiEligible
            ? computeConfiguredComponent(salaryStructure?.earnings?.esiEmployer, basicSalary)
            : 0;
        earnings.totalEarnings =
            (earnings.basicWage || 0) +
            (earnings.houseRentAllowance || 0) +
            (earnings.transportAllowance || 0) +
            (earnings.medicalAllowance || 0) +
            (earnings.overtime || 0) +
            (earnings.specialAllowance || 0) +
            (earnings.performanceBonus || 0) +
            (earnings.projectBonus || 0) +
            (earnings.attendanceBonus || 0) +
            (earnings.pfEmployer || 0) +
            (earnings.esiEmployer || 0);

        deductions = {
            pfEmployee: computeConfiguredComponent(salaryStructure?.deductions?.pfEmployee, pfWageBase),
            esiEmployee: esiEligible
                ? computeConfiguredComponent(salaryStructure?.deductions?.esiEmployee, basicSalary)
                : 0,
            professionalTax: computeConfiguredComponent(salaryStructure?.deductions?.professionalTax, effectiveGross),
            incomeTax: 0,
            advanceSalary: 0,
            loanDeduction: 0,
            otherDeductions: 0
        };
        deductions.incomeTax = await computeRegimeIncomeTax(
            emp,
            salaryStructure,
            deductions,
            earnings,
            month,
            yearNum,
            orgId
        );
    } else {
        const formula = computeEarningsFromGross(effectiveGross);
        // PF/ESI/tax should be based on earned (prorated) basic wage, not full-month salary.
        basicSalary = formula.basicWage;
        const overtimeRatePerHour = (perDayRate / 8) * DEFAULT_OVERTIME_RATE;
        const overtimePay = Math.round(totalOvertimeHours * overtimeRatePerHour);

        const esiEligibleFallback = effectiveGross <= ESI_GROSS_WAGE_LIMIT;
        earnings = {
            basicWage: formula.basicWage,
            houseRentAllowance: formula.houseRentAllowance,
            transportAllowance: 0,
            medicalAllowance: 0,
            overtime: overtimePay,
            gratuity: formula.gratuity,
            specialAllowance: formula.specialAllowance,
            performanceBonus: 0,
            projectBonus: 0,
            attendanceBonus: 0,
            pfEmployer: employerPfFromBasicWage(basicSalary),
            esiEmployer: esiEligibleFallback ? Math.round(basicSalary * 0.0325) : 0
        };
        earnings.totalEarnings =
            formula.totalEarnings +
            (earnings.transportAllowance || 0) +
            (earnings.medicalAllowance || 0) +
            (earnings.overtime || 0) +
            (earnings.pfEmployer || 0) +
            (earnings.esiEmployer || 0);

        deductions = {
            pfEmployee: employeePfFromBasicWage(basicSalary),
            esiEmployee: esiEligibleFallback ? Math.round(basicSalary * 0.0075) : 0,
            professionalTax: 0,
            incomeTax: 0,
            advanceSalary: 0,
            loanDeduction: 0,
            otherDeductions: 0
        };
        deductions.incomeTax = await computeRegimeIncomeTax(
            emp,
            null,
            deductions,
            earnings,
            month,
            yearNum,
            orgId
        );
    }

    deductions.total =
        (deductions.pfEmployee || 0) +
        (deductions.esiEmployee || 0) +
        (deductions.professionalTax || 0) +
        (deductions.incomeTax || 0) +
        (deductions.advanceSalary || 0) +
        (deductions.loanDeduction || 0) +
        (deductions.otherDeductions || 0);

    const ctc = earnings.totalEarnings;
    const inHandSalary = earnings.totalEarnings - deductions.total;

    return {
        basicSalary,
        earnings,
        deductions,
        ctc,
        inHandSalary,
        // Keep this field semantics as attendance working days (excluding weekends/holidays).
        workingDays: attendanceWorkingDays,
        presentDays: effectivePresent,
        unpaidLeave: unpaidDays,
        // Store leaves without internal flags
        leaves: payrollLeaves.map(({ isLossOfPay: _ignored, ...rest }) => rest)
    };
}

/**
 * Resolve attendance metrics for payslip PDF when missing on the saved document (e.g. legacy rows).
 */
export async function enrichAttendanceMetricsForPayslip(payroll, organizationId) {
    const base = {
        workingDays: payroll.workingDays,
        presentDays: payroll.presentDays,
        unpaidLeave: payroll.unpaidLeave
    };
    if (payroll.type !== 'monthly') return base;
    if (
        payroll.workingDays != null &&
        payroll.presentDays != null &&
        payroll.unpaidLeave != null
    ) {
        return base;
    }
    try {
        const empId = payroll.employeeId?._id || payroll.employeeId;
        if (!empId) return base;
        const emp = await Employee.findById(empId)
            .select('salary salaryRevisions organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails')
            .lean();
        if (!emp) return base;
        const orgId = organizationId || emp.organizationId;
        const yearNum = typeof payroll.year === 'number' ? payroll.year : parseInt(String(payroll.year), 10);
        const payload = await buildGeneratedPayrollPayload({
            emp,
            month: payroll.month,
            year: yearNum,
            organizationId: orgId,
            mode: 'final'
        });
        return {
            workingDays: payload.workingDays ?? base.workingDays,
            presentDays: payload.presentDays ?? base.presentDays,
            unpaidLeave: payload.unpaidLeave ?? base.unpaidLeave
        };
    } catch (error) {
        logger.warn('Payslip attendance enrichment failed; using stored payroll metrics', {
            error: error.message,
            payrollId: payroll?._id,
        });
        return base;
    }
}
