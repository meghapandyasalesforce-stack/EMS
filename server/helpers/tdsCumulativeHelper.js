import Payroll from '../models/payroll.model.js';
import Organization from '../models/organization.model.js';
import {
    buildIncomeTaxParamsFromEmployee,
    computeAnnualIncomeTax,
    normalizeTaxRegime,
    resolveEmployeeTaxRegime,
    TAX_REGIME
} from './incomeTaxCalculation.js';
import {
    FY_MONTHS,
    getCalendarPartsInTimezone,
    getExitFyMonthIndex,
    getFyMonthIndex,
    getFyStartYear,
    listFyMonthsBefore,
    normalizeMonthName
} from './fyCalendarHelper.js';
import {
    getEffectiveSalaryForMonth,
    projectFullMonthBreakdownForMonth,
    sumProjectedRemainingPf,
    sumProjectedRemainingSalary
} from './salaryRevisionHelper.js';
import { getCachedEffectiveTimezone } from './orgContextCache.js';

/** Org-scoped TDS monthly cut modes (SaaS setting). */
export const TDS_CALCULATION_MODE = Object.freeze({
    /** Tax due through employment months elapsed / employment span in FY (catch-up). */
    CUMULATIVE: 'cumulative',
    /** Remaining annual tax spread evenly over current + future FY months (cannot reopen past slips). */
    INDEPENDENT: 'independent'
});

export const DEFAULT_TDS_CALCULATION_MODE = TDS_CALCULATION_MODE.CUMULATIVE;

const tdsModeCache = new Map();

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/**
 * Normalize org setting to a known TDS mode. Unknown / missing → cumulative (safe default).
 */
export function normalizeTdsCalculationMode(value) {
    const v = String(value || '').trim().toLowerCase();
    if (v === TDS_CALCULATION_MODE.INDEPENDENT) return TDS_CALCULATION_MODE.INDEPENDENT;
    return TDS_CALCULATION_MODE.CUMULATIVE;
}

export function clearTdsCalculationModeCache(organizationId) {
    if (!organizationId) {
        tdsModeCache.clear();
        return;
    }
    tdsModeCache.delete(String(organizationId));
}

/**
 * Resolve org TDS mode with short-lived in-process cache (bulk payroll safe).
 */
export async function resolveOrgTdsCalculationMode(organizationId) {
    if (!organizationId) return DEFAULT_TDS_CALCULATION_MODE;

    const key = String(organizationId);
    if (tdsModeCache.has(key)) {
        return tdsModeCache.get(key);
    }

    const org = await Organization.findById(organizationId)
        .select('settings.tdsCalculationMode')
        .lean();

    const mode = normalizeTdsCalculationMode(org?.settings?.tdsCalculationMode);
    tdsModeCache.set(key, mode);
    return mode;
}

export { FY_MONTHS, normalizeMonthName, getFyMonthIndex, getFyStartYear, listFyMonthsBefore };

export function projectFullMonthBreakdown(emp, salaryStructure, month, year) {
    return projectFullMonthBreakdownForMonth(emp, salaryStructure, month, year);
}

/**
 * Employment window within the Indian FY for TDS pacing.
 * Join / exit calendar months are resolved in `timezone` (org IANA TZ).
 */
export function getFyEmploymentWindow(emp, month, year, timezone) {
    const fyStartYear = getFyStartYear(month, year);
    const currentIdx = getFyMonthIndex(month, year);
    let startIdx = 0;

    if (emp?.joiningDate) {
        const joinParts = getCalendarPartsInTimezone(emp.joiningDate, timezone);
        if (joinParts) {
            const joinFyStart = getFyStartYear(joinParts.monthName, joinParts.year);
            if (joinFyStart > fyStartYear) {
                return { startIdx: 12, currentIdx, monthsElapsed: 0, monthsRemaining: 0 };
            }
            if (joinFyStart === fyStartYear) {
                startIdx = getFyMonthIndex(joinParts.monthName, joinParts.year);
            }
        }
    }

    if (currentIdx < startIdx) {
        return { startIdx, currentIdx, monthsElapsed: 0, monthsRemaining: 0 };
    }

    const exitIdx = getExitFyMonthIndex(emp, timezone);
    if (exitIdx != null && currentIdx > exitIdx) {
        return { startIdx, currentIdx, monthsElapsed: 0, monthsRemaining: 0 };
    }

    const monthsElapsed = currentIdx - startIdx + 1;
    let monthsRemaining = Math.max(0, FY_MONTHS.length - 1 - currentIdx);

    if (exitIdx != null) {
        monthsRemaining = Math.max(0, exitIdx - currentIdx);
    }

    return { startIdx, currentIdx, monthsElapsed, monthsRemaining };
}

/** Employee taxable gross for a month (excludes employer PF/ESI). */
export function extractEmployeeTaxableGross(earnings) {
    if (!earnings || typeof earnings !== 'object') return 0;

    return Math.round(
        (Number(earnings.basicWage) || 0) +
        (Number(earnings.houseRentAllowance) || 0) +
        (Number(earnings.specialAllowance) || 0) +
        (Number(earnings.transportAllowance) || 0) +
        (Number(earnings.medicalAllowance) || 0) +
        (Number(earnings.overtime) || 0) +
        (Number(earnings.performanceBonus) || 0) +
        (Number(earnings.projectBonus) || 0) +
        (Number(earnings.attendanceBonus) || 0)
    );
}

function aggregateYtdFromPayrolls(payrolls) {
    return payrolls.reduce(
        (acc, row) => {
            acc.taxableGross += extractEmployeeTaxableGross(row.earnings);
            acc.tdsDeducted += Number(row.deductions?.incomeTax) || 0;
            acc.pfEmployee += Number(row.deductions?.pfEmployee) || 0;
            acc.professionalTax += Number(row.deductions?.professionalTax) || 0;
            return acc;
        },
        { taxableGross: 0, tdsDeducted: 0, pfEmployee: 0, professionalTax: 0 }
    );
}

export async function fetchYtdPayrollStats({ employeeId, organizationId, month, year }) {
    const priorMonths = listFyMonthsBefore(month, year);
    if (!priorMonths.length || !employeeId) {
        return { taxableGross: 0, tdsDeducted: 0, pfEmployee: 0, professionalTax: 0 };
    }

    const rows = await Payroll.find({
        employeeId,
        organizationId,
        type: 'monthly',
        isVisible: { $ne: false },
        status: { $nin: ['Cancelled'] },
        $or: priorMonths.map((m) => ({ month: m.month, year: m.year }))
    })
        .select('earnings deductions month year updatedAt')
        .lean();

    const byKey = new Map();
    for (const row of rows) {
        const key = `${normalizeMonthName(row.month)}-${row.year}`;
        const existing = byKey.get(key);
        if (!existing || new Date(row.updatedAt || 0) > new Date(existing.updatedAt || 0)) {
            byKey.set(key, row);
        }
    }

    return aggregateYtdFromPayrolls([...byKey.values()]);
}

/**
 * Build projected annual figures + annual tax shared by both TDS modes.
 */
export function buildProjectedAnnualTaxContext({
    taxParamsBase,
    ytdTaxableGross = 0,
    ytdPfEmployee = 0,
    ytdProfessionalTax = 0,
    currentMonthTaxableGross = 0,
    currentMonthPf = 0,
    currentMonthProfessionalTax = 0,
    projectedRemainingGross = 0,
    projectedRemainingPf = 0,
    projectedRemainingPt = 0,
    fullMonthlySalary = 0,
    fullMonthlyBasic = 0,
    fullMonthlyHra = 0
}) {
    const projectedAnnualGross = Math.max(
        0,
        Math.round(ytdTaxableGross + currentMonthTaxableGross + projectedRemainingGross)
    );

    const projectedAnnualPf = Math.max(
        0,
        Math.round(ytdPfEmployee + currentMonthPf + projectedRemainingPf)
    );

    const projectedAnnualPt = Math.max(
        0,
        Math.round(ytdProfessionalTax + currentMonthProfessionalTax + projectedRemainingPt)
    );

    const fullAnnualGross = Math.max(0, fullMonthlySalary) * 12;
    const scale = fullAnnualGross > 0 ? projectedAnnualGross / fullAnnualGross : 1;

    const annualTax = computeAnnualIncomeTax({
        ...taxParamsBase,
        annualGrossIncome: projectedAnnualGross,
        annualBasic: Math.round(Math.max(0, fullMonthlyBasic) * 12 * scale),
        annualHra: Math.round(Math.max(0, fullMonthlyHra) * 12 * scale),
        annualPfEmployee: projectedAnnualPf,
        annualProfessionalTax: projectedAnnualPt
    });

    return {
        projectedAnnualGross,
        projectedAnnualPf,
        projectedAnnualPt,
        annualTax,
        currentMonthTaxableGross: Math.max(0, Math.round(asNumber(currentMonthTaxableGross, 0)))
    };
}

/**
 * Cumulative mode: tax due through employment months elapsed minus YTD TDS.
 * Divisor is employment span in the FY (join→exit/March), not always 12 —
 * so mid-year joiners are not stuck at elapsed/12 of annual tax.
 */
export function computeCumulativeModeMonthlyTds({
    annualTax,
    monthsElapsedInFy = 1,
    ytdTdsDeducted = 0,
    employmentMonthsInFy = 12
}) {
    if (monthsElapsedInFy <= 0) return 0;
    const divisor = Math.max(1, Math.round(asNumber(employmentMonthsInFy, 12)));
    const taxDueThroughCurrentMonth = Math.round((annualTax * monthsElapsedInFy) / divisor);
    return Math.max(0, taxDueThroughCurrentMonth - Math.max(0, ytdTdsDeducted));
}

/**
 * Independent mode: spread remaining annual tax over current + future FY months.
 * Past payslips are not reopened; already-deducted YTD TDS is subtracted, then the
 * balance is divided by months left including this month (e.g. July → March = 9).
 */
export function computeIndependentModeMonthlyTds({
    annualTax,
    ytdTdsDeducted = 0,
    monthsRemainingIncludingCurrent = 1,
    currentMonthTaxableGross = 0
}) {
    const annual = Math.max(0, asNumber(annualTax, 0));
    const months = Math.max(0, Math.round(asNumber(monthsRemainingIncludingCurrent, 0)));
    const ytd = Math.max(0, asNumber(ytdTdsDeducted, 0));
    const current = Math.max(0, asNumber(currentMonthTaxableGross, 0));
    // No earnings this month → nothing to deduct from.
    if (annual <= 0 || months <= 0 || current <= 0) return 0;
    const remainingTax = Math.max(0, annual - ytd);
    return Math.max(0, Math.round(remainingTax / months));
}

/**
 * Monthly TDS from projected annual tax using org-selected mode.
 * @param {object} args
 * @param {'cumulative'|'independent'} [args.tdsCalculationMode]
 */
export function computeCumulativeMonthlyIncomeTax({
    taxParamsBase,
    ytdTaxableGross = 0,
    ytdTdsDeducted = 0,
    ytdPfEmployee = 0,
    ytdProfessionalTax = 0,
    currentMonthTaxableGross = 0,
    currentMonthPf = 0,
    currentMonthProfessionalTax = 0,
    projectedRemainingGross = 0,
    projectedRemainingPf = 0,
    projectedRemainingPt = 0,
    fullMonthlySalary = 0,
    fullMonthlyBasic = 0,
    fullMonthlyHra = 0,
    monthsElapsedInFy = 1,
    /** FY months after the current payroll month (Aug–Mar when current is July → 8). Omit to assume 12 − elapsed. */
    monthsRemainingAfterCurrent,
    tdsCalculationMode = DEFAULT_TDS_CALCULATION_MODE
}) {
    if (monthsElapsedInFy <= 0) return 0;

    const ctx = buildProjectedAnnualTaxContext({
        taxParamsBase,
        ytdTaxableGross,
        ytdPfEmployee,
        ytdProfessionalTax,
        currentMonthTaxableGross,
        currentMonthPf,
        currentMonthProfessionalTax,
        projectedRemainingGross,
        projectedRemainingPf,
        projectedRemainingPt,
        fullMonthlySalary,
        fullMonthlyBasic,
        fullMonthlyHra
    });

    const mode = normalizeTdsCalculationMode(tdsCalculationMode);

    const monthsAfter =
        monthsRemainingAfterCurrent === undefined || monthsRemainingAfterCurrent === null
            ? Math.max(0, 12 - monthsElapsedInFy)
            : Math.max(0, Math.round(asNumber(monthsRemainingAfterCurrent, 0)));

    if (mode === TDS_CALCULATION_MODE.INDEPENDENT) {
        const monthsRemainingIncludingCurrent = Math.max(1, monthsAfter + 1);
        return computeIndependentModeMonthlyTds({
            annualTax: ctx.annualTax,
            ytdTdsDeducted,
            monthsRemainingIncludingCurrent,
            currentMonthTaxableGross: ctx.currentMonthTaxableGross
        });
    }

    const employmentMonthsInFy = Math.max(1, monthsElapsedInFy + monthsAfter);
    return computeCumulativeModeMonthlyTds({
        annualTax: ctx.annualTax,
        monthsElapsedInFy,
        ytdTdsDeducted,
        employmentMonthsInFy
    });
}

export async function computeRegimeIncomeTaxCumulative({
    emp,
    salaryStructure,
    deductions,
    earnings,
    month,
    year,
    organizationId
}) {
    const fullMonthlySalary = getEffectiveSalaryForMonth(emp, month, year);
    if (!fullMonthlySalary) return 0;

    if (normalizeTaxRegime(resolveEmployeeTaxRegime(emp)) === TAX_REGIME.NA) return 0;

    const breakdown = projectFullMonthBreakdown(emp, salaryStructure, month, year);
    const taxParamsBase = buildIncomeTaxParamsFromEmployee(emp, {
        annualGross: fullMonthlySalary * 12,
        annualBasic: breakdown.basicWage * 12,
        annualHra: breakdown.houseRentAllowance * 12,
        annualPfEmployee: (deductions.pfEmployee || 0) * 12,
        annualProfessionalTax: (deductions.professionalTax || 0) * 12,
        month,
        year
    });

    const [ytd, tdsCalculationMode, orgTimezone] = await Promise.all([
        fetchYtdPayrollStats({
            employeeId: emp._id,
            organizationId,
            month,
            year
        }),
        resolveOrgTdsCalculationMode(organizationId),
        getCachedEffectiveTimezone(organizationId)
    ]);

    const { monthsElapsed, monthsRemaining } = getFyEmploymentWindow(
        emp,
        month,
        year,
        orgTimezone
    );
    if (monthsElapsed <= 0) return 0;

    const projectedRemainingGross = sumProjectedRemainingSalary(emp, month, year, monthsRemaining);
    const projectedRemainingPf = sumProjectedRemainingPf(emp, month, year, monthsRemaining);
    const ptPerMonth = deductions.professionalTax || 0;

    return computeCumulativeMonthlyIncomeTax({
        taxParamsBase,
        ytdTaxableGross: ytd.taxableGross,
        ytdTdsDeducted: ytd.tdsDeducted,
        ytdPfEmployee: ytd.pfEmployee,
        ytdProfessionalTax: ytd.professionalTax,
        currentMonthTaxableGross: extractEmployeeTaxableGross(earnings),
        currentMonthPf: deductions.pfEmployee || 0,
        currentMonthProfessionalTax: ptPerMonth,
        projectedRemainingGross,
        projectedRemainingPf,
        projectedRemainingPt: ptPerMonth * monthsRemaining,
        fullMonthlySalary,
        fullMonthlyBasic: breakdown.basicWage,
        fullMonthlyHra: breakdown.houseRentAllowance,
        monthsElapsedInFy: monthsElapsed,
        monthsRemainingAfterCurrent: monthsRemaining,
        tdsCalculationMode
    });
}
