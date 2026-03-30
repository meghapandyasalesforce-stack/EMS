import Attendance from '../models/attendance.model.js';
import Leave from '../models/leave.model.js';
import Calendar from '../models/calendar.model.js';
import { computeEarningsFromGross } from './salaryCalculation.js';

// Cache calendar docs during a single Node process run to avoid
// repeated DB reads for every employee in the same month/year.
const calendarCache = new Map();

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

function dateKey(date) {
    // Stable day key independent of time (local timezone).
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function buildIsWorkingDayFn(calendar) {
    if (!calendar) return null;

    const holidayDates = new Set(
        (calendar.holidays || [])
            .filter((h) => h && h.isActive !== false)
            .map((h) => {
                const hd = new Date(h.date);
                return Number.isNaN(hd.getTime()) ? null : dateKey(hd);
            })
            .filter(Boolean)
    );

    return (date) => {
        const dayName = getDayName(date);
        const isWorkingByWeek =
            calendar?.workingDays && typeof calendar.workingDays[dayName] === 'boolean'
                ? calendar.workingDays[dayName]
                : date.getDay() !== 0 && date.getDay() !== 6; // fallback: Mon–Fri

        if (!isWorkingByWeek) return false;
        return !holidayDates.has(dateKey(date));
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

function attendanceHoursWorked(record) {
    const eff = Number(record.effectiveHours);
    const gross = Number(record.grossHours);
    if (Number.isFinite(eff) && eff > 0) return eff;
    if (Number.isFinite(gross) && gross > 0) return gross;
    return 0;
}

/**
 * Paid-day credit (0–1) from one attendance row using worked hours.
 * present/loggedOut with 0 effective and 0 gross hours → 0 (treat as no paid time).
 */
function attendanceDayCredit(record) {
    const status = (record.status || '').toLowerCase();
    const h = attendanceHoursWorked(record);
    if (h <= 0) return 0;
    if (status === 'half-day') return Math.min(0.5, h / STANDARD_FULL_DAY_HOURS);
    if (status === 'present' || status === 'loggedout') return Math.min(1, h / STANDARD_FULL_DAY_HOURS);
    return 0;
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
function buildPaidLeaveByDayMap(approvedLeaves, effStart, effEnd, isWorkingDayFn) {
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
                const key = dateKey(day);
                paidLeaveByDay.set(key, Math.min(1, (paidLeaveByDay.get(key) || 0) + 0.5));
                break;
            }
            continue;
        }

        for (let d = new Date(overlapStart); d <= overlapEnd; d.setDate(d.getDate() + 1)) {
            const day = new Date(d);
            if (!isWorkingDayForPayroll(day, isWorkingDayFn)) continue;
            const key = dateKey(day);
            paidLeaveByDay.set(key, Math.min(1, (paidLeaveByDay.get(key) || 0) + 1));
        }
    }

    return paidLeaveByDay;
}

/** Sum daily credits over working days in [walkStart, walkEnd]: each day min(1, attendance + paid leave). */
function sumEffectivePresentDays(walkStart, walkEnd, attByDay, paidLeaveByDay, isWorkingDayFn) {
    let total = 0;
    const a = startOfDay(new Date(walkStart));
    const b = startOfDay(new Date(walkEnd));
    if (a > b) return 0;
    for (let d = new Date(a); d <= b; d.setDate(d.getDate() + 1)) {
        const day = new Date(d);
        if (!isWorkingDayForPayroll(day, isWorkingDayFn)) continue;
        const key = dateKey(day);
        const att = attByDay.get(key) || 0;
        const lev = paidLeaveByDay.get(key) || 0;
        total += Math.min(1, att + lev);
    }
    return total;
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

/** True when final monthly run is allowed (last calendar day of target month or later, or past months). */
export function isFinalGenerationAllowedForPeriod(now, targetYear, targetMonthIndex) {
    const y = now.getFullYear();
    const m = now.getMonth();
    if (y > targetYear || (y === targetYear && m > targetMonthIndex)) return true;
    if (y === targetYear && m === targetMonthIndex) {
        const lastDay = new Date(targetYear, targetMonthIndex + 1, 0).getDate();
        return now.getDate() >= lastDay;
    }
    return false;
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
    const startOfMonth = new Date(yearNum, monthIndex, 1);
    const endOfMonth = new Date(yearNum, monthIndex + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);

    const join = emp.joiningDate ? startOfDay(new Date(emp.joiningDate)) : null;
    const effStart = join && join > startOfMonth ? join : startOfMonth;

    const asOfDate = asOf instanceof Date ? asOf : new Date(asOf);
    const asOfCap = endOfDay(asOfDate);
    const effEnd =
        mode === 'preview'
            ? new Date(Math.min(endOfMonth.getTime(), asOfCap.getTime()))
            : endOfMonth;

    const orgId = emp.organizationId || organizationId;
    const calendarKey = `${String(orgId)}-${String(yearNum)}`;
    let calendar = calendarCache.get(calendarKey);
    if (!calendar) {
        calendar = await Calendar.findOne({ organizationId: orgId, year: yearNum }).lean();
        // Cache null too (so we don't keep querying if calendar doesn't exist).
        calendarCache.set(calendarKey, calendar || null);
    }
    const isWorkingDayFn = buildIsWorkingDayFn(calendar);

    const workingDenom = Math.max(1, countWorkingDaysInclusive(effStart, endOfMonth, isWorkingDayFn));

    const attendanceRecords =
        effStart <= effEnd
            ? await Attendance.find({
                  userId: emp._id,
                  organizationId: orgId,
                  date: { $gte: effStart, $lte: effEnd }
              })
            : [];

    // If a calendar exists, only count attendance on working days.
    // This keeps the proration denominator and numerator consistent for holidays/weekends.
    const attendanceRecordsForCounting =
        typeof isWorkingDayFn === 'function'
            ? attendanceRecords.filter((r) => {
                  const d = r?.date ? new Date(r.date) : null;
                  return d && !Number.isNaN(d.getTime()) ? isWorkingDayFn(d) : false;
              })
            : attendanceRecords;

    const attByDay = new Map();
    for (const r of attendanceRecordsForCounting) {
        const d = r?.date ? new Date(r.date) : null;
        if (!d || Number.isNaN(d.getTime())) continue;
        const key = dateKey(d);
        const c = attendanceDayCredit(r);
        attByDay.set(key, Math.min(1, Math.max(attByDay.get(key) || 0, c)));
    }

    const totalOvertimeHours = attendanceRecords.reduce((sum, r) => sum + (r.overtimeHours || 0), 0);

    const approvedLeaves =
        effStart <= effEnd
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
            const overlapWorkingDays = leaveWorkingDaysInRange(lv, effStart, effEnd, isWorkingDayFn);
            if (!overlapWorkingDays) return null;

            // Half-day leave: the leave document marks it with `isHalfDay` and `duration: 0.5`.
            // `leaveWorkingDaysInRange()` counts whole working days, so we convert it to 0.5 here.
            let days = overlapWorkingDays;
            if (lv?.isHalfDay === true || Number(lv?.duration) === 0.5) {
                // `leaveWorkingDaysInRange()` counts whole working days (1 per day).
                // Half-day leaves should contribute half of a day per overlapped working day.
                days = overlapWorkingDays * 0.5;
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

    const paidLeaveByDay = buildPaidLeaveByDayMap(approvedLeaves, effStart, effEnd, isWorkingDayFn);
    // Paid days = per working day in payroll window: min(1, attendance credit + approved paid leave), fractional OK.
    const effectivePresent = sumEffectivePresentDays(effStart, effEnd, attByDay, paidLeaveByDay, isWorkingDayFn);
    const fullGross = emp.salary || 0;
    const effectiveGross =
        workingDenom > 0 ? Math.round((fullGross * effectivePresent) / workingDenom) : 0;
    const formula = computeEarningsFromGross(effectiveGross);
    // PF/ESI/tax should be based on earned (prorated) basic wage, not full-month salary.
    const basicSalary = formula.basicWage;
    const perDayRate = fullGross / workingDenom;
    const overtimeRatePerHour = perDayRate / 8;
    const overtimePay = Math.round(totalOvertimeHours * overtimeRatePerHour);
    const unpaidDays = Math.max(0, workingDenom - effectivePresent);

    const earnings = {
        basicWage: formula.basicWage,
        houseRentAllowance: formula.houseRentAllowance,
        transportAllowance: 0,
        medicalAllowance: 0,
        overtime: overtimePay,
        gratuity: formula.gratuity,
        specialAllowance: formula.specialAllowance,
        performanceBonus: 0,
        projectBonus: 0,
        attendanceBonus: unpaidDays === 0 ? 0 : 0,
        pfEmployer: Math.round(basicSalary * 0.12),
        esiEmployer: Math.round(basicSalary * 0.0325)
    };
    earnings.totalEarnings =
        formula.totalEarnings +
        (earnings.transportAllowance || 0) +
        (earnings.medicalAllowance || 0) +
        (earnings.overtime || 0) +
        (earnings.pfEmployer || 0) +
        (earnings.esiEmployer || 0);

    const deductions = {
        pfEmployee: Math.round(basicSalary * 0.12),
        esiEmployee: Math.round(basicSalary * 0.0075),
        professionalTax: 200,
        incomeTax: Math.round(basicSalary * 0.1),
        advanceSalary: 0,
        loanDeduction: 0,
        otherDeductions: 0
    };
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
        // Store leaves without internal flags
        leaves: payrollLeaves.map(({ isLossOfPay: _ignored, ...rest }) => rest)
    };
}
