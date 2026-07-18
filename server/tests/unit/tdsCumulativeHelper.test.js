import { describe, it, expect } from '@jest/globals';
import {
    getFyMonthIndex,
    getFyStartYear,
    listFyMonthsBefore,
    getFyEmploymentWindow,
    extractEmployeeTaxableGross,
    computeCumulativeMonthlyIncomeTax,
    normalizeTdsCalculationMode,
    computeCumulativeModeMonthlyTds,
    computeIndependentModeMonthlyTds,
    TDS_CALCULATION_MODE
} from '../../helpers/tdsCumulativeHelper.js';
import { getExitFyMonthIndex } from '../../helpers/fyCalendarHelper.js';
import { computeAnnualIncomeTax, resolveTaxDeclaration } from '../../helpers/incomeTaxCalculation.js';
import { getEffectiveSalaryForMonth, sumProjectedRemainingSalary } from '../../helpers/salaryRevisionHelper.js';

describe('tdsCumulativeHelper', () => {
    describe('FY utilities', () => {
        it('maps May 2026 to FY 2026-27 month index 1', () => {
            expect(getFyStartYear('May', 2026)).toBe(2026);
            expect(getFyMonthIndex('May', 2026)).toBe(1);
        });

        it('lists prior FY months before May 2026', () => {
            expect(listFyMonthsBefore('May', 2026)).toEqual([{ month: 'April', year: 2026 }]);
        });

        it('March 2026 is last month of FY 2025-26', () => {
            expect(getFyStartYear('March', 2026)).toBe(2025);
            expect(getFyMonthIndex('March', 2026)).toBe(11);
        });
    });

    describe('lastWorkingDate in employment window', () => {
        const TZ = 'Asia/Kolkata';

        it('sets monthsRemaining to 0 on exit month', () => {
            const emp = { lastWorkingDate: new Date('2027-01-31T00:00:00.000Z') };
            const window = getFyEmploymentWindow(emp, 'January', 2027, TZ);
            expect(window.monthsRemaining).toBe(0);
            expect(getExitFyMonthIndex(emp, TZ)).toBe(9);
        });

        it('limits remaining months before exit', () => {
            const emp = { lastWorkingDate: new Date('2027-01-31T00:00:00.000Z') };
            const window = getFyEmploymentWindow(emp, 'December', 2026, TZ);
            expect(window.monthsRemaining).toBe(1);
        });

        it('returns zero employment after exit month', () => {
            const emp = { lastWorkingDate: new Date('2027-01-31T00:00:00.000Z') };
            const window = getFyEmploymentWindow(emp, 'February', 2027, TZ);
            expect(window.monthsElapsed).toBe(0);
            expect(window.monthsRemaining).toBe(0);
        });

        it('uses org TZ so IST midnight join is not shifted to previous month', () => {
            // 2026-06-30T18:30:00.000Z = 1 July 2026 00:00 IST
            const emp = { joiningDate: new Date('2026-06-30T18:30:00.000Z') };
            const window = getFyEmploymentWindow(emp, 'July', 2026, TZ);
            expect(window.startIdx).toBe(3); // July
            expect(window.monthsElapsed).toBe(1);
            expect(window.monthsRemaining).toBe(8);
        });
    });

    describe('extractEmployeeTaxableGross', () => {
        it('excludes employer PF from taxable gross', () => {
            expect(
                extractEmployeeTaxableGross({
                    basicWage: 50000,
                    houseRentAllowance: 20000,
                    specialAllowance: 30000,
                    pfEmployer: 1800,
                    totalEarnings: 103800
                })
            ).toBe(100000);
        });
    });

    describe('normalizeTdsCalculationMode', () => {
        it('defaults unknown values to cumulative', () => {
            expect(normalizeTdsCalculationMode(undefined)).toBe(TDS_CALCULATION_MODE.CUMULATIVE);
            expect(normalizeTdsCalculationMode('')).toBe(TDS_CALCULATION_MODE.CUMULATIVE);
            expect(normalizeTdsCalculationMode('weird')).toBe(TDS_CALCULATION_MODE.CUMULATIVE);
        });

        it('accepts independent', () => {
            expect(normalizeTdsCalculationMode('independent')).toBe(TDS_CALCULATION_MODE.INDEPENDENT);
            expect(normalizeTdsCalculationMode('INDEPENDENT')).toBe(TDS_CALCULATION_MODE.INDEPENDENT);
        });
    });

    describe('computeCumulativeMonthlyIncomeTax', () => {
        const taxParamsBase = { taxRegime: 'old', section80C: {}, section80D: {}, section80E: 0, section24b: 0, monthlyRent: 0, metroCity: false };

        it('returns lower TDS than flat annual/12 on LOP month with no YTD', () => {
            const fullMonthly = 150000;
            const lopMonthGross = 100000;
            const fullAnnualTax = computeAnnualIncomeTax({
                taxRegime: 'old',
                annualGrossIncome: fullMonthly * 12,
                annualPfEmployee: 1800 * 12
            });
            const flatMonthly = Math.round(fullAnnualTax / 12);

            const cumulative = computeCumulativeMonthlyIncomeTax({
                taxParamsBase,
                ytdTaxableGross: 0,
                ytdTdsDeducted: 0,
                currentMonthTaxableGross: lopMonthGross,
                currentMonthPf: 1800,
                projectedRemainingGross: 11 * fullMonthly,
                projectedRemainingPf: 11 * 1800,
                fullMonthlySalary: fullMonthly,
                fullMonthlyBasic: 75000,
                fullMonthlyHra: 30000,
                monthsElapsedInFy: 1,
                tdsCalculationMode: 'cumulative'
            });

            expect(cumulative).toBeLessThan(flatMonthly);
        });

        it('uses reduced projection when employee exits same month', () => {
            const taxWithExit = computeCumulativeMonthlyIncomeTax({
                taxParamsBase,
                ytdTaxableGross: 1350000,
                ytdTdsDeducted: 200000,
                currentMonthTaxableGross: 150000,
                currentMonthPf: 1800,
                projectedRemainingGross: 0,
                projectedRemainingPf: 0,
                fullMonthlySalary: 150000,
                fullMonthlyBasic: 75000,
                fullMonthlyHra: 30000,
                monthsElapsedInFy: 10,
                tdsCalculationMode: 'cumulative'
            });

            const taxWithoutExit = computeCumulativeMonthlyIncomeTax({
                taxParamsBase,
                ytdTaxableGross: 1350000,
                ytdTdsDeducted: 200000,
                currentMonthTaxableGross: 150000,
                currentMonthPf: 1800,
                projectedRemainingGross: 300000,
                projectedRemainingPf: 3600,
                fullMonthlySalary: 150000,
                fullMonthlyBasic: 75000,
                fullMonthlyHra: 30000,
                monthsElapsedInFy: 10,
                tdsCalculationMode: 'cumulative'
            });

            expect(taxWithExit).toBeLessThanOrEqual(taxWithoutExit);
        });

        it('independent mode spreads remaining tax over current + future months', () => {
            const baseArgs = {
                taxParamsBase,
                ytdTaxableGross: 2100000,
                currentMonthTaxableGross: 1610000,
                currentMonthPf: 1800,
                projectedRemainingGross: 9 * 2100000,
                projectedRemainingPf: 9 * 1800,
                fullMonthlySalary: 2100000,
                fullMonthlyBasic: 1050000,
                fullMonthlyHra: 420000,
                monthsElapsedInFy: 3,
                monthsRemainingAfterCurrent: 9,
                tdsCalculationMode: 'independent'
            };

            const withZeroPastTds = computeCumulativeMonthlyIncomeTax({
                ...baseArgs,
                ytdTdsDeducted: 0
            });
            const withPartialPastTds = computeCumulativeMonthlyIncomeTax({
                ...baseArgs,
                ytdTdsDeducted: Math.round(withZeroPastTds / 2)
            });

            expect(withZeroPastTds).toBeGreaterThan(0);
            // Higher YTD TDS → lower remaining balance to spread this month.
            expect(withPartialPastTds).toBeLessThan(withZeroPastTds);
            expect(withPartialPastTds).toBeGreaterThan(0);
        });

        it('cumulative mode reduces TDS when past deductions are high', () => {
            const baseArgs = {
                taxParamsBase,
                ytdTaxableGross: 2100000,
                currentMonthTaxableGross: 1610000,
                currentMonthPf: 1800,
                projectedRemainingGross: 9 * 2100000,
                projectedRemainingPf: 9 * 1800,
                fullMonthlySalary: 2100000,
                fullMonthlyBasic: 1050000,
                fullMonthlyHra: 420000,
                monthsElapsedInFy: 3,
                tdsCalculationMode: 'cumulative'
            };

            const withHighPastTds = computeCumulativeMonthlyIncomeTax({
                ...baseArgs,
                ytdTdsDeducted: 5_000_000
            });
            const withZeroPastTds = computeCumulativeMonthlyIncomeTax({
                ...baseArgs,
                ytdTdsDeducted: 0
            });

            expect(withHighPastTds).toBe(0);
            expect(withZeroPastTds).toBeGreaterThan(0);
        });

        it('independent mode charges more per month when fewer months remain', () => {
            const baseArgs = {
                taxParamsBase,
                ytdTaxableGross: 2100000,
                ytdTdsDeducted: 0,
                currentMonthTaxableGross: 2100000,
                currentMonthPf: 1800,
                // Keep annual projection identical; only the collection window changes.
                projectedRemainingGross: 8 * 2100000,
                projectedRemainingPf: 8 * 1800,
                fullMonthlySalary: 2100000,
                fullMonthlyBasic: 1050000,
                fullMonthlyHra: 420000,
                monthsElapsedInFy: 4,
                tdsCalculationMode: 'independent'
            };

            const nineMonthsLeft = computeCumulativeMonthlyIncomeTax({
                ...baseArgs,
                monthsRemainingAfterCurrent: 8 // current + 8 = 9
            });
            const twelveMonthsLeft = computeCumulativeMonthlyIncomeTax({
                ...baseArgs,
                monthsRemainingAfterCurrent: 11 // current + 11 = 12
            });

            expect(nineMonthsLeft).toBeGreaterThan(twelveMonthsLeft);
            // Same remaining annual tax: monthly ≈ total/9 vs total/12.
            expect(nineMonthsLeft).toBe(Math.round((twelveMonthsLeft * 12) / 9));
        });
    });

    describe('mode helpers', () => {
        it('computeIndependentModeMonthlyTds spreads remaining tax over months left', () => {
            expect(
                computeIndependentModeMonthlyTds({
                    annualTax: 90000,
                    ytdTdsDeducted: 0,
                    monthsRemainingIncludingCurrent: 9,
                    currentMonthTaxableGross: 100000
                })
            ).toBe(10000);

            expect(
                computeIndependentModeMonthlyTds({
                    annualTax: 90000,
                    ytdTdsDeducted: 30000,
                    monthsRemainingIncludingCurrent: 6,
                    currentMonthTaxableGross: 100000
                })
            ).toBe(10000);

            expect(
                computeIndependentModeMonthlyTds({
                    annualTax: 90000,
                    ytdTdsDeducted: 0,
                    monthsRemainingIncludingCurrent: 9,
                    currentMonthTaxableGross: 0
                })
            ).toBe(0);
        });

        it('computeCumulativeModeMonthlyTds subtracts YTD', () => {
            expect(
                computeCumulativeModeMonthlyTds({
                    annualTax: 120000,
                    monthsElapsedInFy: 3,
                    ytdTdsDeducted: 15000,
                    employmentMonthsInFy: 12
                })
            ).toBe(15000);
        });

        it('computeCumulativeModeMonthlyTds uses employment span not always 12', () => {
            // Mid-year joiner: 9 employment months; month 1 should be annual/9 not annual/12
            expect(
                computeCumulativeModeMonthlyTds({
                    annualTax: 90000,
                    monthsElapsedInFy: 1,
                    ytdTdsDeducted: 0,
                    employmentMonthsInFy: 9
                })
            ).toBe(10000);

            expect(
                computeCumulativeModeMonthlyTds({
                    annualTax: 90000,
                    monthsElapsedInFy: 9,
                    ytdTdsDeducted: 80000,
                    employmentMonthsInFy: 9
                })
            ).toBe(10000);
        });
    });
});

describe('salaryRevisionHelper', () => {
    it('projects remaining months at this payroll month CTC (no early hike foresight)', () => {
        const emp = {
            salary: 125000,
            salaryRevisions: [
                { salary: 100000, effectiveFrom: new Date('2026-04-01') },
                { salary: 125000, effectiveFrom: new Date('2026-09-01') }
            ]
        };

        expect(getEffectiveSalaryForMonth(emp, 'August', 2026)).toBe(100000);
        expect(getEffectiveSalaryForMonth(emp, 'September', 2026)).toBe(125000);

        // August run does not pull September's hike into the annual estimate early.
        const remaining = sumProjectedRemainingSalary(emp, 'August', 2026, 4);
        expect(remaining).toBe(100000 * 4);

        const afterHike = sumProjectedRemainingSalary(emp, 'September', 2026, 3);
        expect(afterHike).toBe(125000 * 3);
    });
});

describe('resolveTaxDeclaration FY enforcement', () => {
    it('ignores declaration when financial year does not match payroll month', () => {
        const emp = {
            financialDetails: {
                taxDeclaration: {
                    financialYear: '2025-26',
                    section80C: { lic: 50000 },
                    hra: { monthlyRent: 20000 }
                }
            }
        };

        const mismatch = resolveTaxDeclaration(emp, { month: 'April', year: 2026 });
        expect(mismatch.section80C).toEqual({});
        expect(mismatch.monthlyRent).toBe(0);

        const emp2728 = {
            financialDetails: {
                taxDeclaration: {
                    financialYear: '2026-27',
                    section80C: { lic: 50000 },
                    hra: { monthlyRent: 20000 }
                }
            }
        };
        const match = resolveTaxDeclaration(emp2728, { month: 'April', year: 2026 });
        expect(match.section80C.lic).toBe(50000);
        expect(match.monthlyRent).toBe(20000);
    });
});
