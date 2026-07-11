import { describe, it, expect } from '@jest/globals';
import {
    computeEarningsFromGross,
    computeSalaryStructureCoreEarnings
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
});
