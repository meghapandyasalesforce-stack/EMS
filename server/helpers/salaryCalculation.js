/**
 * Salary calculation helper
 * Rule: Gross = employee salary (CTC)
 *   Basic = 50% of Gross
 *   HRA = 40% of Basic
 *   Special Allowance = Balance (Gross - Basic - HRA)
 * Gratuity is not part of this monthly split (kept 0 for stored shape / legacy).
 */

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

/** Employee PF deduction: 12% of basic wage (rounded). */
export function employeePfFromBasicWage(basicWage) {
    return Math.round((Number(basicWage) || 0) * 0.12);
}
