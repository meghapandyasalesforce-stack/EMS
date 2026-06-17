import { describe, it, expect } from '@jest/globals';
import {
    TAX_REGIME,
    normalizeTaxRegime,
    computeHraExemption,
    computeSection80CTotal,
    computeSection80D,
    computeAnnualIncomeTax,
    computeMonthlyIncomeTax,
    getIndianFinancialYear
} from '../../helpers/incomeTaxCalculation.js';

describe('incomeTaxCalculation', () => {
    describe('normalizeTaxRegime', () => {
        it('maps old regime variants', () => {
            expect(normalizeTaxRegime('Old')).toBe(TAX_REGIME.OLD);
            expect(normalizeTaxRegime('old regime')).toBe(TAX_REGIME.OLD);
        });

        it('maps new regime variants and defaults empty to new', () => {
            expect(normalizeTaxRegime('New')).toBe(TAX_REGIME.NEW);
            expect(normalizeTaxRegime('')).toBe(TAX_REGIME.NEW);
        });
    });

    describe('getIndianFinancialYear', () => {
        it('returns FY starting April', () => {
            expect(getIndianFinancialYear(new Date('2026-06-10'))).toBe('2026-27');
            expect(getIndianFinancialYear(new Date('2026-02-10'))).toBe('2025-26');
        });
    });

    describe('computeSection80CTotal', () => {
        it('caps combined PF and declared investments at 1.5L', () => {
            expect(
                computeSection80CTotal({
                    annualPfEmployee: 21600,
                    section80C: { lic: 30000, elss: 100000 }
                })
            ).toBe(150000);
        });
    });

    describe('computeSection80D', () => {
        it('applies senior citizen caps', () => {
            expect(
                computeSection80D({
                    selfFamilyPremium: 60000,
                    parentsPremium: 60000,
                    selfSeniorCitizen: true,
                    parentsSeniorCitizen: true
                })
            ).toBe(100000);
        });
    });

    describe('computeHraExemption', () => {
        it('returns 0 when rent is not declared', () => {
            expect(
                computeHraExemption({
                    annualHra: 240000,
                    annualBasic: 600000,
                    rentPaidAnnual: 0
                })
            ).toBe(0);
        });
    });

    describe('computeAnnualIncomeTax', () => {
        it('applies zero tax for eligible income under new regime rebate', () => {
            const tax = computeAnnualIncomeTax({
                taxRegime: 'new',
                annualGrossIncome: 1000000
            });
            expect(tax).toBe(0);
        });

        it('uses declared 80C under old regime', () => {
            const withDeclarations = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: 1500000,
                annualPfEmployee: 21600,
                section80C: { lic: 30000, elss: 50000 }
            });

            const pfOnly = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: 1500000,
                annualPfEmployee: 21600,
                section80C: {}
            });

            expect(withDeclarations).toBeLessThan(pfOnly);
        });

        it('charges less under new than old without deductions', () => {
            const oldTax = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: 1800000
            });
            const newTax = computeAnnualIncomeTax({
                taxRegime: 'new',
                annualGrossIncome: 1800000
            });
            expect(newTax).toBeLessThan(oldTax);
        });
    });

    describe('computeMonthlyIncomeTax', () => {
        it('returns one twelfth of annual tax rounded', () => {
            const annual = computeAnnualIncomeTax({
                taxRegime: 'new',
                annualGrossIncome: 2000000
            });
            const monthly = computeMonthlyIncomeTax({
                taxRegime: 'new',
                annualGrossIncome: 2000000
            });
            expect(monthly).toBe(Math.round(annual / 12));
        });
    });
});
