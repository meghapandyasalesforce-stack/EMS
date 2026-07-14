import { computeEarningsFromGross, computeSalaryStructureCoreEarnings, employeePfFromBasicWage } from './salaryCalculation.js';
import {
    getCalendarYearForFyMonth,
    getFyMonthIndex,
    getFyStartYear
} from './fyCalendarHelper.js';

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

function monthStartDate(month, year) {
    const yearNum = typeof year === 'number' ? year : parseInt(String(year), 10);
    const idx = getFyMonthIndex(month, yearNum);
    const fyStart = getFyStartYear(month, yearNum);
    const calYear = getCalendarYearForFyMonth(fyStart, idx);
    const calendarMonth = [3, 4, 5, 6, 7, 8, 9, 10, 11, 0, 1, 2][idx];
    return new Date(calYear, calendarMonth, 1);
}

function normalizeRevisionList(emp) {
    const revisions = Array.isArray(emp?.salaryRevisions) ? emp.salaryRevisions : [];
    return revisions
        .map((row) => ({
            salary: Math.max(0, asNumber(row?.salary, 0)),
            effectiveFrom: row?.effectiveFrom ? new Date(row.effectiveFrom) : null,
            note: row?.note ? String(row.note) : ''
        }))
        .filter((row) => row.effectiveFrom && !Number.isNaN(row.effectiveFrom.getTime()))
        .sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());
}

/** Effective monthly gross for a payroll month from revision history (fallback: emp.salary). */
export function getEffectiveSalaryForMonth(emp, month, year) {
    const revisions = normalizeRevisionList(emp);
    const target = monthStartDate(month, year);
    target.setHours(23, 59, 59, 999);

    if (!revisions.length) {
        return Math.max(0, asNumber(emp?.salary, 0));
    }

    let effective = revisions[0].salary;
    for (const rev of revisions) {
        if (rev.effectiveFrom.getTime() <= target.getTime()) {
            effective = rev.salary;
        } else {
            break;
        }
    }

    return Math.max(0, effective);
}

export function buildSalaryRevisionEntries({ previousSalary, newSalary, joiningDate, effectiveFrom, note }) {
    const entries = [];
    const effectiveDate = effectiveFrom ? new Date(effectiveFrom) : new Date();
    if (Number.isNaN(effectiveDate.getTime())) {
        throw new Error('Invalid salary effective date');
    }

    const oldSalary = Math.max(0, asNumber(previousSalary, 0));
    const nextSalary = Math.max(0, asNumber(newSalary, 0));

    if (oldSalary > 0) {
        entries.push({
            salary: oldSalary,
            effectiveFrom: joiningDate ? new Date(joiningDate) : effectiveDate,
            note: 'Initial CTC'
        });
    }

    entries.push({
        salary: nextSalary,
        effectiveFrom: effectiveDate,
        note: note ? String(note).trim() : 'Salary revision'
    });

    return entries;
}

/**
 * Project remaining FY months at this payroll month's effective CTC.
 * Future-dated revisions are NOT applied early — the hike lands in the
 * payroll month it becomes effective (keeps Apr–Jun at pre-hike rate when
 * raise is July, then July+ projects at the new CTC).
 */
export function sumProjectedRemainingSalary(emp, month, year, monthsRemaining) {
    const count = Math.max(0, Number(monthsRemaining) || 0);
    if (count <= 0) return 0;
    const rate = getEffectiveSalaryForMonth(emp, month, year);
    return rate * count;
}

export function sumProjectedRemainingPf(emp, month, year, monthsRemaining) {
    const count = Math.max(0, Number(monthsRemaining) || 0);
    if (count <= 0) return 0;
    const salary = getEffectiveSalaryForMonth(emp, month, year);
    const basic = computeEarningsFromGross(salary).basicWage;
    return employeePfFromBasicWage(basic) * count;
}

export function projectFullMonthBreakdownForMonth(emp, salaryStructure, month, year) {
    const fullGross = getEffectiveSalaryForMonth(emp, month, year);
    if (!salaryStructure) {
        const formula = computeEarningsFromGross(fullGross);
        return {
            basicWage: formula.basicWage,
            houseRentAllowance: formula.houseRentAllowance,
            monthlySalary: fullGross
        };
    }

    const core = computeSalaryStructureCoreEarnings(salaryStructure, fullGross);
    return {
        basicWage: core.basicWage,
        houseRentAllowance: core.houseRentAllowance,
        monthlySalary: fullGross
    };
}
