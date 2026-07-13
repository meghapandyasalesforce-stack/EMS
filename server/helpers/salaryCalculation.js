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
