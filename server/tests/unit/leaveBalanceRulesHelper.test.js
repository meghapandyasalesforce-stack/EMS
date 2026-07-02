import { describe, it, expect } from '@jest/globals';
import {
    applyMonthlyLeaveBalanceRules,
    applyMonthlyAccrualToBalance,
    applyMonthlyLeaveBalanceUpdate,
    applyMonthlyAccrualCredit,
    applyApprovedLeaveDeduction,
    rollLeaveBalanceThroughPeriod,
    resolveYearOpeningBalance,
    isMonthlyAccrualMonth,
    roundLeaveDays,
    getEffectiveJoiningDate,
} from '../../helpers/leaveBalanceRulesHelper.js';

describe('leaveBalanceRulesHelper', () => {
    it('applies monthly rule: Available = Previous + 1.5 − Used', () => {
        const monthlyCredits = Array(12).fill(0);
        const usedPerMonth = Array(12).fill(0);
        monthlyCredits[3] = 1.5; // April
        monthlyCredits[4] = 1.5; // May
        monthlyCredits[5] = 1.5; // June
        monthlyCredits[6] = 1.5; // July
        usedPerMonth[4] = 0.5; // used 0.5 in May

        const result = applyMonthlyLeaveBalanceRules({
            openingBalance: 0,
            monthlyCredits,
            usedPerMonth,
            startMonth: 3,
            endMonth: 6,
        });

        expect(result.ledger[0]).toMatchObject({
            month: 4,
            previousBalance: 0,
            credit: 1.5,
            used: 0,
            available: 1.5,
        });
        expect(result.ledger[1]).toMatchObject({
            month: 5,
            previousBalance: 1.5,
            credit: 1.5,
            used: 0.5,
            available: 2.5,
        });
        expect(result.ledger[3]).toMatchObject({
            month: 7,
            previousBalance: 4,
            credit: 1.5,
            used: 0,
            available: 5.5,
        });
        expect(result.totalEarned).toBe(6);
        expect(result.totalUsed).toBe(0.5);
        expect(result.available).toBe(5.5);
    });

    it('earns monthlyRate × months completed (1.5 × 2 = 3)', () => {
        const monthlyCredits = Array(12).fill(0);
        const usedPerMonth = Array(12).fill(0);
        monthlyCredits[5] = 1.5; // June
        monthlyCredits[6] = 1.5; // July

        const result = applyMonthlyLeaveBalanceRules({
            openingBalance: 0,
            monthlyCredits,
            usedPerMonth,
            startMonth: 5,
            endMonth: 6,
        });

        expect(result.monthsCompleted).toBe(2);
        expect(result.totalEarned).toBe(3);
        expect(result.available).toBe(3);
    });

    it('full calendar year with no leave used closes at 12 × 1.5 = 18', () => {
        const monthlyCredits = Array.from({ length: 12 }, () => 1.5);
        const result = applyMonthlyLeaveBalanceRules({
            openingBalance: 0,
            monthlyCredits,
            usedPerMonth: Array(12).fill(0),
            startMonth: 0,
            endMonth: 11,
        });

        expect(result.totalEarned).toBe(18);
        expect(result.available).toBe(18);
        expect(result.monthsCompleted).toBe(12);
    });

    it('carries full year-end balance into January of next year (18 + 1.5 = 19.5)', () => {
        const monthlyCredits = Array(12).fill(0);
        monthlyCredits[0] = 1.5;

        const result = applyMonthlyLeaveBalanceRules({
            openingBalance: 18,
            monthlyCredits,
            usedPerMonth: Array(12).fill(0),
            startMonth: 0,
            endMonth: 0,
        });

        expect(result.ledger[0]).toMatchObject({
            month: 1,
            previousBalance: 18,
            credit: 1.5,
            available: 19.5,
        });
        expect(result.available).toBe(19.5);
    });

    it('January opens with prior-year balance + monthly credit', () => {
        const monthlyCredits = Array(12).fill(0);
        monthlyCredits[0] = 1.5;

        const result = applyMonthlyLeaveBalanceRules({
            openingBalance: 3,
            monthlyCredits,
            usedPerMonth: Array(12).fill(0),
            startMonth: 0,
            endMonth: 0,
        });

        expect(result.ledger[0]).toMatchObject({
            month: 1,
            previousBalance: 3,
            credit: 1.5,
            used: 0,
            available: 4.5,
        });
        expect(result.available).toBe(4.5);
    });

    it('uses January 2016 start when joining date is missing (not view year)', () => {
        const join = getEffectiveJoiningDate(null);
        expect(join.getFullYear()).toBe(2016);
        expect(join.getMonth()).toBe(0);
        expect(join.getDate()).toBe(1);

        const join2026 = getEffectiveJoiningDate({ joiningDate: null });
        expect(join2026.getFullYear()).toBe(2016);
    });

    it('Example 1 – 2016 closes at 18; Jan–Jun 2017 reaches 27 with no leave used', () => {
        const year2016 = applyMonthlyLeaveBalanceRules({
            openingBalance: 0,
            monthlyCredits: Array.from({ length: 12 }, () => 1.5),
            usedPerMonth: Array(12).fill(0),
            startMonth: 0,
            endMonth: 11,
        });
        expect(year2016.available).toBe(18);

        const year2017 = applyMonthlyLeaveBalanceRules({
            openingBalance: year2016.available,
            monthlyCredits: Array.from({ length: 12 }, () => 1.5),
            usedPerMonth: Array(12).fill(0),
            startMonth: 0,
            endMonth: 5,
        });

        expect(year2017.ledger[0].available).toBe(19.5);
        expect(year2017.ledger[1].available).toBe(21);
        expect(year2017.ledger[2].available).toBe(22.5);
        expect(year2017.ledger[3].available).toBe(24);
        expect(year2017.ledger[4].available).toBe(25.5);
        expect(year2017.ledger[5].available).toBe(27);
        expect(year2017.available).toBe(27);
    });

    it('Example 2 – 1 day used in Jan 2017; Jun balance is 26', () => {
        const usedPerMonth = Array(12).fill(0);
        usedPerMonth[0] = 1;

        const year2017 = applyMonthlyLeaveBalanceRules({
            openingBalance: 18,
            monthlyCredits: Array.from({ length: 12 }, () => 1.5),
            usedPerMonth,
            startMonth: 0,
            endMonth: 5,
        });

        expect(year2017.ledger[0]).toMatchObject({
            previousBalance: 18,
            credit: 1.5,
            used: 1,
            available: 18.5,
        });
        expect(year2017.ledger[1].available).toBe(20);
        expect(year2017.ledger[5].available).toBe(26);
        expect(year2017.available).toBe(26);
    });

    it('year-end balance equals opening + earned − used', () => {
        const monthlyCredits = Array.from({ length: 12 }, () => 1.5);
        const usedPerMonth = Array(12).fill(0);
        usedPerMonth[11] = 2;

        const result = applyMonthlyLeaveBalanceRules({
            openingBalance: 1,
            monthlyCredits,
            usedPerMonth,
            startMonth: 0,
            endMonth: 11,
        });

        expect(result.totalEarned).toBe(18);
        expect(result.totalUsed).toBe(2);
        expect(result.yearEndBalance).toBe(roundLeaveDays(1 + 18 - 2));
        expect(result.available).toBe(result.yearEndBalance);
    });

    it('Example 3 – five full years without usage (18 per year, no reset)', () => {
        let opening = 0;
        const expectedByYear = { 2016: 18, 2017: 36, 2018: 54, 2019: 72, 2020: 90 };

        for (const year of [2016, 2017, 2018, 2019, 2020]) {
            const result = applyMonthlyLeaveBalanceRules({
                openingBalance: opening,
                monthlyCredits: Array.from({ length: 12 }, () => 1.5),
                usedPerMonth: Array(12).fill(0),
                startMonth: 0,
                endMonth: 11,
            });
            expect(result.available).toBe(expectedByYear[year]);
            opening = result.available;
        }
    });

    it('rollLeaveBalanceThroughPeriod – Jan 2016 join through Jun 2017 equals 27', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 5,
            monthlyRate: 1.5,
        });

        expect(result.lifetimeEarned).toBe(27);
        expect(result.available).toBe(27);
        expect(result.ledger[0]).toMatchObject({
            month: 1,
            previousBalance: 18,
            credit: 1.5,
            available: 19.5,
        });
        expect(result.ledger[5].available).toBe(27);
    });

    it('rollLeaveBalanceThroughPeriod – Example 2 with 1 day used in Jan 2017', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 5,
            monthlyRate: 1.5,
            getUsedForMonth: (year, monthIndex) =>
                year === 2017 && monthIndex === 0 ? 1 : 0,
        });

        expect(result.ledger.find((row) => row.month === 1)).toMatchObject({
            previousBalance: 18,
            credit: 1.5,
            used: 1,
            available: 18.5,
        });
        expect(result.available).toBe(26);
    });

    it('carries 8 days from December into January then adds 1.5 (8 + 1.5 = 9.5)', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2025,
            joinMonthIndex: 0,
            endYear: 2026,
            endMonthIndex: 0,
            monthlyRate: 1.5,
            getUsedForMonth: (year, monthIndex) =>
                year === 2025 && monthIndex === 11 ? 10 : 0,
        });

        expect(result.ledgerByYear[2025][11].available).toBe(8);
        expect(result.ledgerByYear[2026][0]).toMatchObject({
            month: 1,
            previousBalance: 8,
            credit: 1.5,
            available: 9.5,
        });
    });

    it('deducts approved leave after monthly accrual (Previous + 1.5 − Used)', () => {
        expect(applyMonthlyAccrualCredit(18, 1.5)).toBe(19.5);
        expect(applyApprovedLeaveDeduction(19.5, 1)).toBe(18.5);

        const jan = applyMonthlyLeaveBalanceUpdate(18, 1.5, 1);
        expect(jan).toMatchObject({
            previousBalance: 18,
            credit: 1.5,
            balanceAfterAccrual: 19.5,
            used: 1,
            closingBalance: 18.5,
        });

        const feb = applyMonthlyLeaveBalanceUpdate(jan.closingBalance, 1.5, 0);
        expect(feb.closingBalance).toBe(20);

        const mar = applyMonthlyLeaveBalanceUpdate(feb.closingBalance, 1.5, 0);
        expect(mar.closingBalance).toBe(21.5);
    });

    it('chains each month from the latest closing balance through June (26 after 1 day in Jan)', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 5,
            monthlyRate: 1.5,
            getUsedForMonth: (year, monthIndex) =>
                year === 2017 && monthIndex === 0 ? 1 : 0,
        });

        expect(result.ledgerByYear[2016][11].available).toBe(18);
        expect(result.ledgerByYear[2017][0]).toMatchObject({
            month: 1,
            previousBalance: 18,
            balanceAfterAccrual: 19.5,
            used: 1,
            available: 18.5,
        });
        expect(result.ledgerByYear[2017][1].available).toBe(20);
        expect(result.ledgerByYear[2017][2].available).toBe(21.5);
        expect(result.ledgerByYear[2017][5].available).toBe(26);
        expect(result.available).toBe(26);
    });

    it('pooled available leave accrues 1.5 once and deducts combined approved usage', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2026,
            joinMonthIndex: 0,
            endYear: 2026,
            endMonthIndex: 3,
            monthlyRate: 1.5,
            getUsedForMonth: (_year, monthIndex) => (monthIndex === 2 ? 1 : 0),
        });

        expect(result.ledgerByYear[2026][0].available).toBe(1.5);
        expect(result.ledgerByYear[2026][1].available).toBe(3);
        expect(result.ledgerByYear[2026][2]).toMatchObject({
            month: 3,
            previousBalance: 3,
            credit: 1.5,
            used: 1,
            available: 3.5,
        });
        expect(result.ledgerByYear[2026][3].available).toBe(5);
        expect(result.available).toBe(5);
    });

    it('applyMonthlyAccrualToBalance adds 1.5 each month (Previous + 1.5)', () => {
        expect(applyMonthlyAccrualToBalance(18, 1.5, 0)).toBe(19.5);
        expect(applyMonthlyAccrualToBalance(19.5, 1.5, 0)).toBe(21);
        expect(applyMonthlyAccrualToBalance(21, 1.5, 0)).toBe(22.5);
    });

    it('accrues 1.5 every month through Mar 2017 after Dec 2016 closing of 18', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 2,
            monthlyRate: 1.5,
        });

        expect(result.ledgerByYear[2016][11].available).toBe(18);
        expect(result.ledgerByYear[2017][0]).toMatchObject({
            month: 1,
            previousBalance: 18,
            credit: 1.5,
            available: 19.5,
        });
        expect(result.ledgerByYear[2017][1]).toMatchObject({
            month: 2,
            previousBalance: 19.5,
            credit: 1.5,
            available: 21,
        });
        expect(result.ledgerByYear[2017][2]).toMatchObject({
            month: 3,
            previousBalance: 21,
            credit: 1.5,
            available: 22.5,
        });
        expect(result.available).toBe(22.5);
    });

    it('isMonthlyAccrualMonth respects join date', () => {
        expect(isMonthlyAccrualMonth(2016, 5, 2016, 4)).toBe(false);
        expect(isMonthlyAccrualMonth(2016, 5, 2016, 5)).toBe(true);
        expect(isMonthlyAccrualMonth(2016, 5, 2017, 0)).toBe(true);
    });

    it('December 2016 closing equals January 2017 opening (18) — no year reset', () => {
        const throughDec2016 = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2016,
            endMonthIndex: 11,
            monthlyRate: 1.5,
        });

        expect(throughDec2016.ledgerByYear[2016][11].available).toBe(18);
        expect(throughDec2016.yearOpeningBalance).toBe(0);

        const jan2017 = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 0,
            monthlyRate: 1.5,
        });

        expect(jan2017.yearOpeningBalance).toBe(18);
        expect(jan2017.ledgerByYear[2017][0].previousBalance).toBe(18);
        expect(jan2017.ledgerByYear[2016][11].available).toBe(18);
        expect(jan2017.ledgerByYear[2017][0].available).toBe(19.5);
    });

    it('resolveYearOpeningBalance reads prior December closing from ledger', () => {
        const ledgerByYear = {
            2016: [{ month: 12, available: 18 }],
        };
        expect(resolveYearOpeningBalance(ledgerByYear, 2017, 2016)).toBe(18);
        expect(resolveYearOpeningBalance(ledgerByYear, 2016, 2016)).toBe(0);
    });

    it('credits 1.5 each month Jan–Apr from zero (1.5, 3, 4.5, 6)', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2016,
            endMonthIndex: 3,
            monthlyRate: 1.5,
        });

        expect(result.ledgerByYear[2016][0].available).toBe(1.5);
        expect(result.ledgerByYear[2016][1].available).toBe(3);
        expect(result.ledgerByYear[2016][2].available).toBe(4.5);
        expect(result.ledgerByYear[2016][3].available).toBe(6);
    });

    it('year-end 2016 at 18 flows to Jan 2017 then Feb–Apr (19.5, 21, 22.5, 24)', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 3,
            monthlyRate: 1.5,
        });

        expect(result.ledgerByYear[2016][11].available).toBe(18);
        expect(result.ledgerByYear[2017][0].available).toBe(19.5);
        expect(result.ledgerByYear[2017][1].available).toBe(21);
        expect(result.ledgerByYear[2017][2].available).toBe(22.5);
        expect(result.ledgerByYear[2017][3].available).toBe(24);
    });

    it('manual anchor Jan 2016 = 3 rolls forward through years without reset', () => {
        const anchor = { anchorYear: 2016, anchorMonth: 1, anchorBalance: 3 };
        const through2016 = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2016,
            endMonthIndex: 11,
            monthlyRate: 1.5,
            balanceAnchor: anchor,
        });

        expect(through2016.ledgerByYear[2016][0].available).toBe(3);
        expect(through2016.ledgerByYear[2016][1].available).toBe(4.5);
        expect(through2016.ledgerByYear[2016][2].available).toBe(6);
        expect(through2016.ledgerByYear[2016][3].available).toBe(7.5);
        expect(through2016.ledgerByYear[2016][11].available).toBe(19.5);

        const through2017 = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 2,
            monthlyRate: 1.5,
            balanceAnchor: anchor,
        });

        expect(through2017.ledgerByYear[2017][0].available).toBe(21);
        expect(through2017.ledgerByYear[2017][1].available).toBe(22.5);
        expect(through2017.ledgerByYear[2017][2].available).toBe(24);
    });

    it('manual anchor continues accrual through January 2026', () => {
        const anchor = { anchorYear: 2016, anchorMonth: 1, anchorBalance: 3 };
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2026,
            endMonthIndex: 0,
            monthlyRate: 1.5,
            balanceAnchor: anchor,
        });

        // Feb 2016 through Jan 2026 = 120 monthly credits of 1.5 after anchor month
        expect(result.available).toBe(183);
        expect(result.ledgerByYear[2026][0].previousBalance).toBe(181.5);
        expect(result.ledgerByYear[2026][0].available).toBe(183);
    });

    it('manual anchor still deducts approved leave after anchor month', () => {
        const anchor = { anchorYear: 2016, anchorMonth: 1, anchorBalance: 3 };
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 5,
            monthlyRate: 1.5,
            balanceAnchor: anchor,
            getUsedForMonth: (year, monthIndex) =>
                year === 2017 && monthIndex === 0 ? 1 : 0,
        });

        expect(result.ledgerByYear[2017][0].available).toBe(20);
        expect(result.ledgerByYear[2017][5].available).toBe(27.5);
    });

    it('December 2017 closing is 35 after 1 day used in January 2017', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2017,
            endMonthIndex: 11,
            monthlyRate: 1.5,
            getUsedForMonth: (year, monthIndex) =>
                year === 2017 && monthIndex === 0 ? 1 : 0,
        });

        expect(result.available).toBe(35);
    });

    it('period opening balance Jan 2016 = 3 rolls forward through January 2026', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2026,
            endMonthIndex: 0,
            monthlyRate: 1.5,
            periodOpeningBalance: { openingYear: 2016, openingMonth: 1, balance: 3 },
        });

        expect(result.ledgerByYear[2016][0].available).toBe(3);
        expect(result.available).toBe(183);
    });

    it('period opening balance deducts approved leave after opening month', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2016,
            endMonthIndex: 3,
            monthlyRate: 1.5,
            periodOpeningBalance: { openingYear: 2016, openingMonth: 1, balance: 3 },
            getUsedForMonth: (_year, monthIndex) => (monthIndex === 2 ? 2 : 0),
        });

        expect(result.ledgerByYear[2016][2].available).toBe(4);
        expect(result.ledgerByYear[2016][3].available).toBe(5.5);
    });

    it('adjustment anchor overrides opening at same month but opening persists for earlier roll', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2026,
            endMonthIndex: 6,
            monthlyRate: 1.5,
            periodOpeningBalance: { openingYear: 2016, openingMonth: 1, balance: 3 },
            balanceAnchor: { anchorYear: 2026, anchorMonth: 7, anchorBalance: 21 },
        });

        expect(result.ledgerByYear[2016][0].available).toBe(3);
        expect(result.ledgerByYear[2026][6].available).toBe(21);
    });

    it('opening balance at month uses HR value and rolls forward (opening=10)', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2016,
            endMonthIndex: 2,
            monthlyRate: 1.5,
            periodOpeningBalance: { openingYear: 2016, openingMonth: 1, balance: 10 },
        });

        expect(result.ledgerByYear[2016][0].available).toBe(10);
        expect(result.ledgerByYear[2016][1].available).toBe(11.5);
        expect(result.ledgerByYear[2016][2].available).toBe(13);
    });

    it('opening month takes precedence over adjustment anchor at the same month', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2016,
            endMonthIndex: 1,
            monthlyRate: 1.5,
            periodOpeningBalance: { openingYear: 2016, openingMonth: 1, balance: 3 },
            balanceAnchor: { anchorYear: 2016, anchorMonth: 1, anchorBalance: 99 },
        });

        expect(result.ledgerByYear[2016][0].available).toBe(3);
        expect(result.ledgerByYear[2016][1].available).toBe(4.5);
    });

    it('opening Jan 2016 = 3 with July 2026 adjustment = 40 continues through August 2026', () => {
        const result = rollLeaveBalanceThroughPeriod({
            joinYear: 2016,
            joinMonthIndex: 0,
            endYear: 2026,
            endMonthIndex: 7,
            monthlyRate: 1.5,
            periodOpeningBalance: { openingYear: 2016, openingMonth: 1, balance: 3 },
            balanceAnchor: { anchorYear: 2026, anchorMonth: 7, anchorBalance: 40 },
        });

        expect(result.ledgerByYear[2016][0].available).toBe(3);
        expect(result.ledgerByYear[2026][5].available).toBe(3 + 125 * 1.5);
        expect(result.ledgerByYear[2026][6].available).toBe(40);
        expect(result.ledgerByYear[2026][7].available).toBe(41.5);
    });
});
