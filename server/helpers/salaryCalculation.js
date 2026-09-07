/**
 * Salary calculation helper
 * Rule: Gross = employee salary (CTC)
 *   Basic = 50% of Gross
 *   HRA = 40% of Basic
 *   Special Allowance = Balance (Gross - Basic - HRA)
 * Gratuity is not part of this monthly split (kept 0 for stored shape / legacy).
 *
 * Salary structure: Basic (and bonuses) use % of gross; HRA/transport/medical use % of basic.
 */

function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
}

/** Percentage or fixed component from a salary-structure field config. */
export function computeConfiguredComponent(config, baseAmount) {
    const cfg = config && typeof config === 'object' ? config : {};
    const base = Math.max(0, asNumber(baseAmount, 0));
    const percentage = asNumber(cfg.percentage, 0);
    const fixedAmount = asNumber(cfg.fixedAmount, 0);
    const isPercentage = cfg.isPercentage !== false;
    const raw = isPercentage ? (base * percentage) / 100 : fixedAmount;
    return Math.round(Math.max(0, raw));
}

/**
 * Core monthly earnings split from a salary structure and gross/CTC amount.
 * @param {object} salaryStructure
 * @param {number} gross
 */
export function computeSalaryStructureCoreEarnings(salaryStructure, gross) {
    const g = Math.max(0, asNumber(gross, 0));
    const earningsCfg = (salaryStructure && salaryStructure.earnings) || {};

    const basicWage = computeConfiguredComponent(earningsCfg.basicWage, g);
    const houseRentAllowance = computeConfiguredComponent(earningsCfg.houseRentAllowance, basicWage);
    const transportAllowance = computeConfiguredComponent(earningsCfg.transportAllowance, basicWage);
    const medicalAllowance = computeConfiguredComponent(earningsCfg.medicalAllowance, basicWage);
    const specialAllowance = Math.max(
        0,
        Math.round(g - basicWage - houseRentAllowance - transportAllowance - medicalAllowance)
    );

    return {
        basicWage,
        houseRentAllowance,
        transportAllowance,
        medicalAllowance,
        specialAllowance
    };
}

/**
 * Compute earnings breakdown from gross salary using the standard formula.
 * @param {number} gross - Gross salary (total CTC for the period)
 * @returns {{ basicWage: number, houseRentAllowance: number, gratuity: number, specialAllowance: number, totalEarnings: number }}
 */
export function computeEarningsFromGross(gross) {
    const g = Number(gross) || 0;
    const basicWage = Math.round(0.5 * g);
    const houseRentAllowance = Math.round(0.4 * basicWage);
    const gratuity = 0;
    const specialAllowance = Math.round(g - basicWage - houseRentAllowance);
    const totalEarnings = basicWage + houseRentAllowance + specialAllowance;
    return {
        basicWage,
        houseRentAllowance,
        gratuity,
        specialAllowance,
        totalEarnings
    };
}

export const PF_WAGE_CAP = 15000;

/** ESI wage ceiling (₹21,000) — applied to statutory ESI wages, not payroll gross. */
export const ESI_GROSS_WAGE_LIMIT = 21000;
/** @deprecated Use ESI_GROSS_WAGE_LIMIT — same ₹21,000 statutory-wage ceiling. */
export const ESI_STATUTORY_WAGE_LIMIT = ESI_GROSS_WAGE_LIMIT;

/** Default ESI contribution rates when salary structure % is not used (fallback path). */
export const ESI_EMPLOYEE_RATE = 0.0075;
export const ESI_EMPLOYER_RATE = 0.0325;

export function pfWageFromBasicWage(basicWage) {
    const basic = Math.max(0, Number(basicWage) || 0);
    return Math.min(basic, PF_WAGE_CAP);
}

/** Employee PF deduction: 12% of capped PF wage (rounded). */
export function employeePfFromBasicWage(basicWage) {
    return Math.round(pfWageFromBasicWage(basicWage) * 0.12);
}

/** Employer PF contribution: 12% of capped PF wage (rounded). */
export function employerPfFromBasicWage(basicWage) {
    return Math.round(pfWageFromBasicWage(basicWage) * 0.12);
}

/**
 * ESI statutory wages under Code on Social Security wage definition + 50% rule.
 *
 * Included (start): Basic + DA + Retaining Allowance.
 * Excluded (initially): HRA, conveyance/transport, medical, special allowance,
 * overtime, bonuses, etc. Employer PF/ESI are not part of employee remuneration.
 *
 * If excluded > 50% of total remuneration, the excess is added back into wages.
 *
 * @param {object} components
 * @returns {{
 *   includedWages: number,
 *   excludedWages: number,
 *   fiftyPercentCap: number,
 *   fiftyPercentAddBack: number,
 *   totalRemuneration: number,
 *   statutoryWages: number
 * }}
 */
export function computeEsiStatutoryWages(components = {}) {
    const basicWage = Math.max(0, asNumber(components.basicWage, 0));
    const dearnessAllowance = Math.max(0, asNumber(components.dearnessAllowance, 0));
    const retainingAllowance = Math.max(0, asNumber(components.retainingAllowance, 0));

    const houseRentAllowance = Math.max(0, asNumber(components.houseRentAllowance, 0));
    const transportAllowance = Math.max(0, asNumber(components.transportAllowance, 0));
    const medicalAllowance = Math.max(0, asNumber(components.medicalAllowance, 0));
    const specialAllowance = Math.max(0, asNumber(components.specialAllowance, 0));
    const overtime = Math.max(0, asNumber(components.overtime, 0));
    const performanceBonus = Math.max(0, asNumber(components.performanceBonus, 0));
    const projectBonus = Math.max(0, asNumber(components.projectBonus, 0));
    const attendanceBonus = Math.max(0, asNumber(components.attendanceBonus, 0));
    const otherExcluded = Math.max(0, asNumber(components.otherExcluded, 0));

    const includedWages = Math.round(basicWage + dearnessAllowance + retainingAllowance);
    const excludedWages = Math.round(
        houseRentAllowance +
            transportAllowance +
            medicalAllowance +
            specialAllowance +
            overtime +
            performanceBonus +
            projectBonus +
            attendanceBonus +
            otherExcluded
    );

    const explicitGross = components.gross != null ? asNumber(components.gross, NaN) : NaN;
    const totalRemuneration = Number.isFinite(explicitGross) && explicitGross >= 0
        ? Math.round(explicitGross)
        : Math.round(includedWages + excludedWages);

    const fiftyPercentCap = Math.round(totalRemuneration * 0.5);
    const fiftyPercentAddBack = Math.max(0, Math.round(excludedWages - fiftyPercentCap));
    const statutoryWages = Math.max(0, Math.round(includedWages + fiftyPercentAddBack));

    return {
        includedWages,
        excludedWages,
        fiftyPercentCap,
        fiftyPercentAddBack,
        totalRemuneration,
        statutoryWages,
    };
}

/**
 * True when ESI statutory wages are within the ₹21,000 ceiling.
 * Eligibility uses the Code wage definition (after 50% rule), not payroll gross.
 */
export function isEsiEligibleByStatutoryWages(statutoryWages) {
    return Math.max(0, asNumber(statutoryWages, 0)) <= ESI_GROSS_WAGE_LIMIT;
}

/**
 * @deprecated Use {@link isEsiEligibleByStatutoryWages}. Kept for older call sites;
 * argument is treated as statutory wages (not gross).
 */
export function isEsiEligibleByGross(wagesOrGross) {
    return isEsiEligibleByStatutoryWages(wagesOrGross);
}

/** True when employee PF should be deducted (default true for legacy rows). */
export function employeeDeductsPf(emp) {
    return emp?.financialDetails?.deductPf !== false;
}

/** True when employee ESI should be deducted (default true for legacy rows). */
export function employeeDeductsEsi(emp) {
    return emp?.financialDetails?.deductEsi !== false;
}

/**
 * Zero PF/ESI employee and employer components when employee flags opt out.
 * Mutates earnings and deductions in place.
 */
export function applyStatutoryDeductionFlags(emp, earnings, deductions) {
    if (!earnings || !deductions) return { earnings, deductions };
    if (!employeeDeductsPf(emp)) {
        deductions.pfEmployee = 0;
        earnings.pfEmployer = 0;
    }
    if (!employeeDeductsEsi(emp)) {
        deductions.esiEmployee = 0;
        earnings.esiEmployer = 0;
    }
    return { earnings, deductions };
}
