/**
 * Canonical leave balance rules (monthly rolling + year-end carry forward).
 *
 * Monthly accrual: add 1.5 first, then subtract approved leave used this month.
 * Current Balance = Previous Balance + 1.5 − Leave Used (approved)
 * Each month continues from the prior month's closing balance (never reset to January).
 */

import { DEFAULT_MONTHLY_LEAVE_DAYS, LEAVE_HISTORY_MIN_YEAR } from '../constants/leaveDefaults.js';

export function roundLeaveDays(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
}

/**
 * Opening balance for a calendar year = prior year's December closing (never reset to 0).
 * Example: Dec 2016 closing 18 → Jan 2017 opening 18.
 */
export function resolveYearOpeningBalance(ledgerByYear, endYear, joinYear) {
    if (!Number.isInteger(endYear) || !Number.isInteger(joinYear) || endYear <= joinYear) {
        return 0;
    }

    const priorYear = endYear - 1;
    const priorRows = ledgerByYear?.[priorYear];
    if (!priorRows?.length) {
        return 0;
    }

    const decRow =
        priorRows.find((row) => row.month === 12) || priorRows[priorRows.length - 1];
    return roundLeaveDays(decRow?.available ?? 0);
}

/**
 * Step 1 — credit monthly accrual onto the prior month's closing balance.
 */
export function applyMonthlyAccrualCredit(
    previousBalance,
    monthlyCredit = DEFAULT_MONTHLY_LEAVE_DAYS
) {
    return roundLeaveDays(roundLeaveDays(previousBalance) + roundLeaveDays(monthlyCredit));
}

/**
 * Step 2 — subtract approved leave used this month (after accrual is applied).
 */
export function applyApprovedLeaveDeduction(balanceAfterAccrual, approvedLeaveUsed = 0) {
    const used = roundLeaveDays(approvedLeaveUsed);
    return Math.max(0, roundLeaveDays(roundLeaveDays(balanceAfterAccrual) - used));
}

/**
 * Apply monthly accrual then approved-leave deduction for one calendar month.
 * Returns closing balance chained forward into the next month.
 */
export function applyMonthlyLeaveBalanceUpdate(
    previousBalance,
    monthlyCredit = DEFAULT_MONTHLY_LEAVE_DAYS,
    approvedLeaveUsed = 0
) {
    const credit = roundLeaveDays(monthlyCredit);
    const used = roundLeaveDays(approvedLeaveUsed);
    const balanceAfterAccrual = applyMonthlyAccrualCredit(previousBalance, credit);
    const closingBalance = applyApprovedLeaveDeduction(balanceAfterAccrual, used);
    return {
        previousBalance: roundLeaveDays(previousBalance),
        credit,
        used,
        balanceAfterAccrual,
        closingBalance,
    };
}

/**
 * @deprecated Use applyMonthlyLeaveBalanceUpdate — kept for callers expecting a scalar.
 */
export function applyMonthlyAccrualToBalance(
    previousBalance,
    monthlyCredit = DEFAULT_MONTHLY_LEAVE_DAYS,
    usedThisMonth = 0
) {
    return applyMonthlyLeaveBalanceUpdate(previousBalance, monthlyCredit, usedThisMonth)
        .closingBalance;
}

/** True when the employee earns monthly accrual in this calendar month. */
export function isMonthlyAccrualMonth(joinYear, joinMonthIndex, year, monthIndex) {
    return year > joinYear || (year === joinYear && monthIndex >= joinMonthIndex);
}

/** Compare calendar position: -1 before, 0 same month, 1 after */
export function compareCalendarMonth(year, monthIndex, anchorYear, anchorMonth) {
    const anchorIndex = Number(anchorMonth) - 1;
    if (year < anchorYear) return -1;
    if (year > anchorYear) return 1;
    if (monthIndex < anchorIndex) return -1;
    if (monthIndex > anchorIndex) return 1;
    return 0;
}

/** When joining date is missing, accrual starts from January 2016 (never from the view year). */
export function getEffectiveJoiningDate(employee) {
    if (employee?.joiningDate) {
        const parsed = new Date(employee.joiningDate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }
    return new Date(LEAVE_HISTORY_MIN_YEAR, 0, 1);
}

/** Month index range (0–11) for accrual within a calendar year up to asOfDate. */
export function getAccrualMonthRange(employee, year, asOfDate = new Date()) {
    const joiningDate = getEffectiveJoiningDate(employee);
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    if (asOfDate < yearStart) {
        return { startMonth: 0, endMonth: -1, monthsCompleted: 0 };
    }

    const endDate = asOfDate > yearEnd ? yearEnd : asOfDate;
    const startMonth = joiningDate.getFullYear() === year ? joiningDate.getMonth() : 0;
    const endMonth = endDate.getMonth();

    if (endMonth < startMonth) {
        return { startMonth, endMonth: startMonth - 1, monthsCompleted: 0 };
    }

    return {
        startMonth,
        endMonth,
        monthsCompleted: endMonth - startMonth + 1,
    };
}

/**
 * Apply month-by-month rolling balance.
 * @param {object} params
 * @param {number} params.openingBalance - Previous year closing / Jan opening (carry forward)
 * @param {number[]} params.monthlyCredits - Credit per month index 0–11 (0 if not an accrual month)
 * @param {number[]} params.usedPerMonth - Approved leave used per month index 0–11
 * @param {number} params.endMonth - Last month index to process (0–11)
 * @param {number} params.startMonth - First month index (0–11)
 */
export function applyMonthlyLeaveBalanceRules({
    openingBalance = 0,
    monthlyCredits = [],
    usedPerMonth = [],
    startMonth = 0,
    endMonth = 11,
}) {
    let previousBalance = roundLeaveDays(openingBalance);
    let cumulativeEarned = 0;
    let cumulativeUsed = 0;
    const ledger = [];

    for (let m = startMonth; m <= endMonth; m += 1) {
        const credit = roundLeaveDays(monthlyCredits[m] || 0);
        const usedThisMonth = roundLeaveDays(usedPerMonth[m] || 0);

        cumulativeEarned = roundLeaveDays(cumulativeEarned + credit);
        cumulativeUsed = roundLeaveDays(cumulativeUsed + usedThisMonth);

        const monthUpdate = applyMonthlyLeaveBalanceUpdate(previousBalance, credit, usedThisMonth);

        ledger.push({
            month: m + 1,
            previousBalance: monthUpdate.previousBalance,
            credit: monthUpdate.credit,
            used: monthUpdate.used,
            balanceAfterAccrual: monthUpdate.balanceAfterAccrual,
            cumulativeEarned,
            cumulativeUsed,
            available: monthUpdate.closingBalance,
        });

        previousBalance = monthUpdate.closingBalance;
    }

    const monthsWithCredit = endMonth >= startMonth ? endMonth - startMonth + 1 : 0;
    const totalEarned = cumulativeEarned;
    const totalUsed = cumulativeUsed;
    const yearEndBalance = roundLeaveDays(previousBalance);

    return {
        totalEarned,
        totalUsed,
        available: previousBalance,
        yearEndBalance,
        monthsCompleted: monthsWithCredit,
        ledger,
        monthlyRate: monthlyCredits.find((c) => c > 0) || DEFAULT_MONTHLY_LEAVE_DAYS,
    };
}

/**
 * Roll leave balance from accrual start month through end month (cross-year, no reset).
 * Closing = Previous closing + monthlyRate − used (approved leave only).
 *
 * @param {object} [params.periodOpeningBalance] - Migrated opening balance at openingYear/openingMonth
 * @param {number} params.periodOpeningBalance.openingYear
 * @param {number} params.periodOpeningBalance.openingMonth - 1-12
 * @param {number} params.periodOpeningBalance.balance
 */
export function rollLeaveBalanceThroughPeriod({
    joinYear,
    joinMonthIndex,
    endYear,
    endMonthIndex,
    monthlyRate = DEFAULT_MONTHLY_LEAVE_DAYS,
    getUsedForMonth = () => 0,
    shouldCreditMonth = null,
    balanceAnchor = null,
    periodOpeningBalance = null,
}) {
    if (
        endYear < joinYear ||
        (endYear === joinYear && endMonthIndex < joinMonthIndex)
    ) {
        return {
            totalEarned: 0,
            totalUsed: 0,
            available: 0,
            yearEndBalance: 0,
            yearOpeningBalance: 0,
            monthsCompleted: 0,
            ledger: [],
            ledgerByYear: {},
            monthlyRate,
            lifetimeEarned: 0,
            lifetimeUsed: 0,
        };
    }

    const creditForMonth = (year, monthIndex) => {
        if (!isMonthlyAccrualMonth(joinYear, joinMonthIndex, year, monthIndex)) {
            return 0;
        }
        if (shouldCreditMonth) {
            return roundLeaveDays(shouldCreditMonth(year, monthIndex) || 0);
        }
        return roundLeaveDays(monthlyRate);
    };

    let cursorYear = joinYear;
    let cursorMonth = joinMonthIndex;
    let previousBalance = 0;
    let lifetimeEarned = 0;
    let lifetimeUsed = 0;
    let yearEarned = 0;
    let yearUsed = 0;
    const ledgerByYear = {};

    while (cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonthIndex)) {
        const credit = creditForMonth(cursorYear, cursorMonth);
        const used = roundLeaveDays(getUsedForMonth(cursorYear, cursorMonth) || 0);

        const anchorPosition =
            balanceAnchor?.anchorYear != null && balanceAnchor?.anchorMonth != null
                ? compareCalendarMonth(
                      cursorYear,
                      cursorMonth,
                      balanceAnchor.anchorYear,
                      balanceAnchor.anchorMonth
                  )
                : null;

        const openingPosition =
            periodOpeningBalance?.openingYear != null && periodOpeningBalance?.openingMonth != null
                ? compareCalendarMonth(
                      cursorYear,
                      cursorMonth,
                      periodOpeningBalance.openingYear,
                      periodOpeningBalance.openingMonth
                  )
                : null;

        let monthUpdate;
        if (openingPosition === 0) {
            const closing = roundLeaveDays(periodOpeningBalance.balance);
            monthUpdate = {
                previousBalance: roundLeaveDays(previousBalance),
                credit: 0,
                used: 0,
                balanceAfterAccrual: closing,
                closingBalance: closing,
            };
        } else if (anchorPosition === 0) {
            const closing = roundLeaveDays(balanceAnchor.anchorBalance);
            monthUpdate = {
                previousBalance: roundLeaveDays(previousBalance),
                credit: 0,
                used: 0,
                balanceAfterAccrual: closing,
                closingBalance: closing,
            };
        } else {
            monthUpdate = applyMonthlyLeaveBalanceUpdate(previousBalance, credit, used);
        }

        lifetimeEarned = roundLeaveDays(lifetimeEarned + monthUpdate.credit);
        lifetimeUsed = roundLeaveDays(lifetimeUsed + monthUpdate.used);

        if (cursorYear === endYear) {
            yearEarned = roundLeaveDays(yearEarned + monthUpdate.credit);
            yearUsed = roundLeaveDays(yearUsed + monthUpdate.used);
        }

        if (!ledgerByYear[cursorYear]) {
            ledgerByYear[cursorYear] = [];
        }
        ledgerByYear[cursorYear].push({
            month: cursorMonth + 1,
            previousBalance: monthUpdate.previousBalance,
            credit: monthUpdate.credit,
            used: monthUpdate.used,
            balanceAfterAccrual: monthUpdate.balanceAfterAccrual,
            cumulativeEarned: lifetimeEarned,
            cumulativeUsed: lifetimeUsed,
            available: monthUpdate.closingBalance,
        });

        previousBalance = monthUpdate.closingBalance;
        cursorMonth += 1;
        if (cursorMonth > 11) {
            cursorMonth = 0;
            cursorYear += 1;
        }
    }

    const yearOpeningBalance = resolveYearOpeningBalance(ledgerByYear, endYear, joinYear);

    return {
        totalEarned: yearEarned,
        totalUsed: yearUsed,
        available: previousBalance,
        yearEndBalance: previousBalance,
        yearOpeningBalance,
        monthsCompleted: ledgerByYear[endYear]?.length ?? 0,
        ledger: ledgerByYear[endYear] || [],
        ledgerByYear,
        monthlyRate,
        lifetimeEarned,
        lifetimeUsed,
    };
}
