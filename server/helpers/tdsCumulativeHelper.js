import Payroll from '../models/payroll.model.js';
import Organization from '../models/organization.model.js';
import {
    buildIncomeTaxParamsFromEmployee,
    computeAnnualIncomeTax
} from './incomeTaxCalculation.js';
import {
    FY_MONTHS,
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

/** Org-scoped TDS monthly cut modes (SaaS setting). */
export const TDS_CALCULATION_MODE = Object.freeze({
    /** Tax due through FY month N minus YTD TDS already deducted (catch-up). */
    CUMULATIVE: 'cumulative',
    /** This month's proportional share only; no past TDS adjustment. */
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

export function getFyEmploymentWindow(emp, month, year) {
    const fyStartYear = getFyStartYear(month, year);
    const currentIdx = getFyMonthIndex(month, year);
    let startIdx = 0;

    if (emp?.joiningDate) {
        const join = new Date(emp.joiningDate);
        if (!Number.isNaN(join.getTime())) {
            const joinMonth = join.toLocaleString('en-US', { month: 'long' });
            const joinFyStart = getFyStartYear(joinMonth, join.getFullYear());
            if (joinFyStart > fyStartYear) {
                return { startIdx: 12, currentIdx, monthsElapsed: 0, monthsRemaining: 0 };
            }
            if (joinFyStart === fyStartYear) {
                startIdx = getFyMonthIndex(joinMonth, join.getFullYear());
            }
        }
    }

    if (currentIdx < startIdx) {
        return { startIdx, currentIdx, monthsElapsed: 0, monthsRemaining: 0 };
    }

    const exitIdx = getExitFyMonthIndex(emp);
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
 * Cumulative mode: tax due through FY month N minus YTD TDS (catch-up / adjustment).
 */
export function computeCumulativeModeMonthlyTds({
    annualTax,
    monthsElapsedInFy = 1,
    ytdTdsDeducted = 0
}) {
    if (monthsElapsedInFy <= 0) return 0;
    const taxDueThroughCurrentMonth = Math.round((annualTax * monthsElapsedInFy) / 12);
    return Math.max(0, taxDueThroughCurrentMonth - Math.max(0, ytdTdsDeducted));
}

/**
 * Independent mode: this month's proportional share of annual tax.
 * Current month uses present/earned gross; future months stay full in the annual estimate.
 * Does NOT subtract past TDS deductions.
 */
export function computeIndependentModeMonthlyTds({
    annualTax,
    projectedAnnualGross = 0,
    currentMonthTaxableGross = 0
}) {
    const annual = Math.max(0, asNumber(annualTax, 0));
    const projected = Math.max(0, asNumber(projectedAnnualGross, 0));
    const current = Math.max(0, asNumber(currentMonthTaxableGross, 0));
    if (annual <= 0 || projected <= 0 || current <= 0) return 0;
    return Math.max(0, Math.round((annual * current) / projected));
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

    if (mode === TDS_CALCULATION_MODE.INDEPENDENT) {
        return computeIndependentModeMonthlyTds({
            annualTax: ctx.annualTax,
            projectedAnnualGross: ctx.projectedAnnualGross,
            currentMonthTaxableGross: ctx.currentMonthTaxableGross
        });
    }

    return computeCumulativeModeMonthlyTds({
        annualTax: ctx.annualTax,
        monthsElapsedInFy,
        ytdTdsDeducted
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

    const { monthsElapsed, monthsRemaining } = getFyEmploymentWindow(emp, month, year);
    if (monthsElapsed <= 0) return 0;

    const [ytd, tdsCalculationMode] = await Promise.all([
        fetchYtdPayrollStats({
            employeeId: emp._id,
            organizationId,
            month,
            year
        }),
        resolveOrgTdsCalculationMode(organizationId)
    ]);

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
        tdsCalculationMode
    });
}
