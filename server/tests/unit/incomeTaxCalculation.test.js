import { describe, it, expect } from '@jest/globals';
import {
    TAX_REGIME,
    normalizeTaxRegime,
    computeHraExemption,
    computeSection80CTotal,
    computeSection80D,
    computeAnnualIncomeTax,
    computeMonthlyIncomeTax,
    getIndianFinancialYear,
    resolveSurchargeBand,
    computeSurcharge,
    computeTaxBeforeSurcharge
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

    describe('surcharge', () => {
        it('applies 0% at or below 50L', () => {
            expect(resolveSurchargeBand(5000000, 'old')).toEqual({ rate: 0, threshold: 0 });
            expect(computeSurcharge(100000, 5000000, 'old')).toBe(0);
        });

        it('applies 10% between 50L and 1Cr', () => {
            expect(resolveSurchargeBand(6000000, 'old').rate).toBe(0.1);
            expect(computeSurcharge(100000, 6000000, 'old')).toBe(10000);
        });

        it('applies 25% band between 2Cr and 5Cr, with marginal relief near threshold', () => {
            expect(resolveSurchargeBand(20703344, 'old')).toEqual({ rate: 0.25, threshold: 20000000 });
            const tax = 6023503.2;
            const surcharge = computeSurcharge(tax, 20703344, 'old');
            // Full 25% would be ~15.06L; marginal relief vs ₹2Cr caps it lower.
            expect(surcharge).toBeGreaterThan(0);
            expect(surcharge).toBeLessThan(tax * 0.25);
            expect(surcharge).toBeCloseTo(492340.8, 5);
        });

        it('applies full 25% surcharge when well above 2Cr threshold', () => {
            const income = 40000000;
            const tax = computeTaxBeforeSurcharge(income, 'old');
            const surcharge = computeSurcharge(tax, income, 'old');
            expect(surcharge).toBeCloseTo(tax * 0.25, 5);
        });

        it('applies marginal relief just above 50L', () => {
            const income = 5000100;
            const tax = computeTaxBeforeSurcharge(income, 'old');
            const surcharge = computeSurcharge(tax, income, 'old');
            const taxAt50L = computeTaxBeforeSurcharge(5000000, 'old');
            expect(tax + surcharge).toBeLessThanOrEqual(taxAt50L + (income - 5000000) + 1e-6);
            expect(surcharge).toBeLessThan(tax * 0.1);
        });

        it('caps new-regime top surcharge at 25%', () => {
            expect(resolveSurchargeBand(60000000, 'new').rate).toBe(0.25);
            expect(resolveSurchargeBand(60000000, 'old').rate).toBe(0.37);
        });

        it('raises annual tax when income crosses 50L', () => {
            const below = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: 5050000,
                annualPfEmployee: 21600
            });
            const above = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: 6000000,
                annualPfEmployee: 21600
            });
            expect(above).toBeGreaterThan(below);
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

        it('includes surcharge with marginal relief near 2Cr for old regime', () => {
            const gross = 20753344;
            const tax = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: gross,
                annualPfEmployee: 0
            });
            // taxable ≈ 2.07Cr → 25% band, but marginal relief vs tax at ₹2Cr caps it
            const taxable = gross - 50000;
            const basic = computeTaxBeforeSurcharge(taxable, 'old');
            const surcharge = computeSurcharge(basic, taxable, 'old');
            expect(surcharge).toBeGreaterThan(0);
            expect(surcharge).toBeLessThan(basic * 0.25);
            expect(tax).toBe(Math.round((basic + surcharge) * 1.04));
            expect(tax).toBeGreaterThan(Math.round(basic * 1.04));
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
