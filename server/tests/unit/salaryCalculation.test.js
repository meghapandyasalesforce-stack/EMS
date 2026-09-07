import { describe, it, expect } from '@jest/globals';
import {
    computeEarningsFromGross,
    computeSalaryStructureCoreEarnings,
    computeEsiStatutoryWages,
    isEsiEligibleByStatutoryWages,
    applyStatutoryDeductionFlags,
    employeeDeductsPf,
    employeeDeductsEsi,
    ESI_GROSS_WAGE_LIMIT,
} from '../../helpers/salaryCalculation.js';

describe('salaryCalculation', () => {
    describe('computeEarningsFromGross', () => {
        it('splits gross with HRA as 40% of basic', () => {
            const result = computeEarningsFromGross(2100000);
            expect(result.basicWage).toBe(1050000);
            expect(result.houseRentAllowance).toBe(420000);
            expect(result.specialAllowance).toBe(630000);
            expect(result.totalEarnings).toBe(2100000);
        });
    });

    describe('computeSalaryStructureCoreEarnings', () => {
        const structure = {
            earnings: {
                basicWage: { percentage: 50, isPercentage: true },
                houseRentAllowance: { percentage: 40, isPercentage: true },
                transportAllowance: { percentage: 0, isPercentage: true },
                medicalAllowance: { percentage: 0, isPercentage: true }
            }
        };

        it('uses HRA as % of basic on full-month gross', () => {
            const result = computeSalaryStructureCoreEarnings(structure, 2100000);
            expect(result.basicWage).toBe(1050000);
            expect(result.houseRentAllowance).toBe(420000);
            expect(result.specialAllowance).toBe(630000);
        });

        it('uses HRA as % of prorated basic on earned gross', () => {
            const result = computeSalaryStructureCoreEarnings(structure, 1610000);
            expect(result.basicWage).toBe(805000);
            expect(result.houseRentAllowance).toBe(322000);
            expect(result.specialAllowance).toBe(483000);
        });

        it('subtracts transport and medical from special allowance balance', () => {
            const withExtras = {
                earnings: {
                    basicWage: { percentage: 50, isPercentage: true },
                    houseRentAllowance: { percentage: 40, isPercentage: true },
                    transportAllowance: { percentage: 10, isPercentage: true },
                    medicalAllowance: { percentage: 5, isPercentage: true }
                }
            };
            const result = computeSalaryStructureCoreEarnings(withExtras, 100000);
            expect(result.basicWage).toBe(50000);
            expect(result.houseRentAllowance).toBe(20000);
            expect(result.transportAllowance).toBe(5000);
            expect(result.medicalAllowance).toBe(2500);
            expect(result.specialAllowance).toBe(22500);
        });
    });

    describe('computeEsiStatutoryWages', () => {
        it('uses Basic when excluded components are within 50% of gross', () => {
            const result = computeEsiStatutoryWages({
                basicWage: 15000,
                houseRentAllowance: 5000,
                specialAllowance: 0,
            });
            expect(result.includedWages).toBe(15000);
            expect(result.excludedWages).toBe(5000);
            expect(result.totalRemuneration).toBe(20000);
            expect(result.fiftyPercentCap).toBe(10000);
            expect(result.fiftyPercentAddBack).toBe(0);
            expect(result.statutoryWages).toBe(15000);
        });

        it('adds excess excluded components back when over 50% of gross', () => {
            const result = computeEsiStatutoryWages({
                basicWage: 8000,
                houseRentAllowance: 12000,
                specialAllowance: 20000,
            });
            expect(result.includedWages).toBe(8000);
            expect(result.excludedWages).toBe(32000);
            expect(result.totalRemuneration).toBe(40000);
            expect(result.fiftyPercentCap).toBe(20000);
            expect(result.fiftyPercentAddBack).toBe(12000);
            expect(result.statutoryWages).toBe(20000);
        });

        it('includes DA and retaining allowance in the starting wage base', () => {
            const result = computeEsiStatutoryWages({
                basicWage: 10000,
                dearnessAllowance: 2000,
                retainingAllowance: 1000,
                houseRentAllowance: 4000,
            });
            expect(result.includedWages).toBe(13000);
            expect(result.excludedWages).toBe(4000);
            expect(result.statutoryWages).toBe(13000);
        });
    });

    describe('isEsiEligibleByStatutoryWages', () => {
        it('uses statutory wages for the ₹21,000 ceiling, not payroll gross', () => {
            expect(isEsiEligibleByStatutoryWages(ESI_GROSS_WAGE_LIMIT)).toBe(true);
            expect(isEsiEligibleByStatutoryWages(18000)).toBe(true);
            expect(isEsiEligibleByStatutoryWages(ESI_GROSS_WAGE_LIMIT + 1)).toBe(false);

            // Gross 28k but statutory wages 18k → still eligible
            const highGross = computeEsiStatutoryWages({
                basicWage: 16000,
                dearnessAllowance: 2000,
                houseRentAllowance: 6000,
                specialAllowance: 4000,
            });
            expect(highGross.totalRemuneration).toBe(28000);
            expect(highGross.statutoryWages).toBe(18000);
            expect(isEsiEligibleByStatutoryWages(highGross.statutoryWages)).toBe(true);
        });
    });

    describe('statutory deduction flags', () => {
        it('defaults to deducting PF and ESI when flags are unset', () => {
            expect(employeeDeductsPf({})).toBe(true);
            expect(employeeDeductsEsi({ financialDetails: {} })).toBe(true);
        });

        it('zeros PF/ESI components when employee opts out', () => {
            const earnings = { pfEmployer: 1800, esiEmployer: 500, basicWage: 15000 };
            const deductions = { pfEmployee: 1800, esiEmployee: 200 };
            const emp = { financialDetails: { deductPf: false, deductEsi: false } };

            applyStatutoryDeductionFlags(emp, earnings, deductions);

            expect(earnings.pfEmployer).toBe(0);
            expect(earnings.esiEmployer).toBe(0);
            expect(deductions.pfEmployee).toBe(0);
            expect(deductions.esiEmployee).toBe(0);
        });
    });
});
