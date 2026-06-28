import Attendance from '../models/attendance.model.js';
import Leave from '../models/leave.model.js';
import Calendar from '../models/calendar.model.js';
import Employee from '../models/employee.model.js';
import SalaryStructure from '../models/salaryStructure.model.js';
import { computeEarningsFromGross, employeePfFromBasicWage, employerPfFromBasicWage, pfWageFromBasicWage } from './salaryCalculation.js';
import { computeRegimeIncomeTaxCumulative } from './tdsCumulativeHelper.js';

// Cache calendar docs during a single Node process run to avoid
// repeated DB reads for every employee in the same month/year.
const calendarCache = new Map();
const salaryStructureByIdCache = new Map();
const salaryStructureByApplicabilityCache = new Map();

export function clearPayrollGenerationCaches({ organizationId, structureId } = {}) {
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
    const terminationOrLastWorking = emp?.lastWorkingDate || emp?.terminationDate;

    void mode;
    void asOf;
    // Monthly payroll must always be computed on the full month's calendar window.
    // Keep `mode` for record state/workflow, but do not cap payroll math by asOf date.
    let effEnd = endOfMonth;
    if (terminationOrLastWorking) {
        const empEnd = endOfDay(new Date(terminationOrLastWorking));
        if (!Number.isNaN(empEnd.getTime())) {
            effEnd = new Date(Math.min(endOfMonth.getTime(), empEnd.getTime()));
        }
    }

    if (effStart > effEnd) {
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

    const orgId = emp.organizationId || organizationId;
    const calendarKey = `${String(orgId)}-${String(yearNum)}`;
    let calendar = calendarCache.get(calendarKey);
    if (!calendar) {
        calendar = await Calendar.findOne({ organizationId: orgId, year: yearNum }).lean();
        // Cache null too (so we don't keep querying if calendar doesn't exist).
        calendarCache.set(calendarKey, calendar || null);
    }
    const isWorkingDayFn = buildIsWorkingDayFn(calendar);

    // Working-day metric for attendance dashboards/reports (excludes weekends/holidays).
    const attendanceWorkingDays = Math.max(0, countWorkingDaysInclusive(effStart, effEnd, isWorkingDayFn));
    // Full calendar month length (e.g. April → 30) — used for a stable "one day" rate (G/D), including for terminated staff.
    const fullMonthCalDays = Math.max(1, countCalendarDaysInclusive(startOfMonth, endOfMonth));
    // Proration window: days employed in this month (join through last working/termination, capped at month end).
    const serviceWindowCalDays = Math.max(1, countCalendarDaysInclusive(effStart, effEnd));

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
    // Weekend/holiday days are paid by default under calendar-day proration.
    // Only missing paid credit on working days reduces monthly payout.
    const unpaidWorkingDays = Math.max(0, attendanceWorkingDays - effectivePresent);
    const paidPayrollDays = Math.max(0, serviceWindowCalDays - unpaidWorkingDays);
    const effectiveGross =
        fullMonthCalDays > 0
            ? Math.round((fullGross * paidPayrollDays) / fullMonthCalDays)
            : 0;
    const salaryStructure = await resolveSalaryStructureForEmployee(emp, orgId);
    // Overtime / "one day" value: always monthly gross ÷ full month calendar days, not ÷ (join→term) window.
    const perDayRate = fullGross / fullMonthCalDays;
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
        const overtimeRatePerHour = (perDayRate / 8) * asNumber(overtimeRules.rate, 1.5);
        const overtimePay = overtimeEnabled ? Math.round(cappedOvertimeHours * overtimeRatePerHour) : 0;

        const basicWage = computeConfiguredComponent(salaryStructure?.earnings?.basicWage, effectiveGross);
        const houseRentAllowance = computeConfiguredComponent(salaryStructure?.earnings?.houseRentAllowance, effectiveGross);
        // SPA is always the residual balance, independent of configured SPA %/fixed values.
        const specialAllowance = Math.max(0, Math.round(effectiveGross - basicWage - houseRentAllowance));

        earnings = {
            basicWage,
            houseRentAllowance,
            transportAllowance: computeConfiguredComponent(salaryStructure?.earnings?.transportAllowance, effectiveGross),
            medicalAllowance: computeConfiguredComponent(salaryStructure?.earnings?.medicalAllowance, effectiveGross),
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
        earnings.esiEmployer = computeConfiguredComponent(salaryStructure?.earnings?.esiEmployer, basicSalary);
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
            esiEmployee: computeConfiguredComponent(salaryStructure?.deductions?.esiEmployee, basicSalary),
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
        const overtimeRatePerHour = perDayRate / 8;
        const overtimePay = Math.round(totalOvertimeHours * overtimeRatePerHour);

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
            attendanceBonus: unpaidDays === 0 ? 0 : 0,
            pfEmployer: employerPfFromBasicWage(basicSalary),
            esiEmployer: Math.round(basicSalary * 0.0325)
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
            esiEmployee: Math.round(basicSalary * 0.0075),
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
    const empId = payroll.employeeId?._id || payroll.employeeId;
    if (!empId) return base;
    const emp = await Employee.findById(empId)
        .select('salary salaryRevisions organizationId joiningDate department position roleLevel salaryStructure status terminationDate lastWorkingDate financialDetails')
        .lean();
    if (!emp) return base;
    const orgId = organizationId || emp.organizationId;
    const yearNum = typeof payroll.year === 'number' ? payroll.year : parseInt(String(payroll.year), 10);
    const monthIndex = new Date(`${payroll.month} 1, ${yearNum}`).getMonth();
    const endOfMonth = new Date(yearNum, monthIndex + 1, 0);
    endOfMonth.setHours(23, 59, 59, 999);
    const payload = await buildGeneratedPayrollPayload({
        emp,
        month: payroll.month,
        year: yearNum,
        organizationId: orgId,
        mode: 'final',
        asOf: endOfMonth
    });
    return {
        workingDays: payload.workingDays ?? base.workingDays,
        presentDays: payload.presentDays ?? base.presentDays,
        unpaidLeave: payload.unpaidLeave ?? base.unpaidLeave
    };
}
