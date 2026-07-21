/**
 * Canonical leave balance rules (monthly rolling + year-end carry forward).
 *
 * Monthly credit is always passed from the active Leave Policy (accrual.amount).
 * No hardcoded 1.5/18 defaults — callers must supply policy-driven monthlyRate.
 */

import { LEAVE_HISTORY_MIN_YEAR } from '../constants/leaveDefaults.js';

export function roundLeaveDays(value) {
    return Math.round((Number(value) || 0) * 1000) / 1000;
}

/** Remaining carry-forward after approved leave (carry is consumed before accrual). */
export function computeRemainingPreJoinCarryForward(initialCarry, usedSinceJoinStart) {
    const carry = roundLeaveDays(initialCarry);
    const used = roundLeaveDays(usedSinceJoinStart);
    if (carry <= 0) {
        return 0;
    }
    return Math.max(0, roundLeaveDays(carry - Math.min(used, carry)));
}

/** Available balance from an active manual override (accrued + carried forward − used). */
export function manualAvailableFromOverride(override) {
    if (!override) {
        return 0;
    }
    if (override.available != null && !Number.isNaN(Number(override.available))) {
        return roundLeaveDays(Number(override.available));
    }
    return Math.max(
        0,
        roundLeaveDays(
            (Number(override.accrued) || 0) +
                (Number(override.carriedForward) || 0) -
                (Number(override.used) || 0)
        )
    );
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
    monthlyCredit = 0
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
    monthlyCredit = 0,
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
    monthlyCredit = 0,
    usedThisMonth = 0
) {
    return applyMonthlyLeaveBalanceUpdate(previousBalance, monthlyCredit, usedThisMonth)
        .closingBalance;
}

/** True when the employee earns monthly accrual in this calendar month. */
export function isMonthlyAccrualMonth(joinYear, joinMonthIndex, year, monthIndex) {
    return year > joinYear || (year === joinYear && monthIndex >= joinMonthIndex);
}

/** Sortable key for a calendar month (year + month 1–12). */
export function calendarMonthSortKey(year, month) {
    return Number(year) * 12 + (Number(month) - 1);
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
export function getAccrualMonthRange(employee, year, asOfDate = new Date(), periodOpeningBalance = null) {
    const joiningDate = getEffectiveJoiningDate(employee);
    const joinYear = joiningDate.getFullYear();
    const joinMonthIndex = joiningDate.getMonth();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    if (asOfDate < yearStart || joinYear > year) {
        return { startMonth: 0, endMonth: -1, monthsCompleted: 0 };
    }

    // If asOfDate is before the joining date, no accrual yet
    if (asOfDate < joiningDate) {
        return { startMonth: 0, endMonth: -1, monthsCompleted: 0 };
    }

    const endDate = asOfDate > yearEnd ? yearEnd : asOfDate;
    const endMonth = endDate.getMonth();
    
    // If active opening balance exists in this year, accrual starts from month AFTER opening month (not opening month itself)
    if (
        periodOpeningBalance?.openingYear != null &&
        periodOpeningBalance?.openingMonth != null &&
        Number(periodOpeningBalance.openingYear) === year
    ) {
        const openingMonthIndex = Number(periodOpeningBalance.openingMonth) - 1;
        if (openingMonthIndex > endMonth) {
            return { startMonth: 0, endMonth: -1, monthsCompleted: 0 };
        }
        // Accrual starts from the month after opening month
        const accrualStartMonth = openingMonthIndex + 1;
        if (accrualStartMonth > endMonth) {
            // Opening month is the only month in range - no accrual yet
            return { startMonth: 0, endMonth: -1, monthsCompleted: 0 };
        }
        return {
            startMonth: accrualStartMonth,
            endMonth,
            monthsCompleted: endMonth - accrualStartMonth + 1,
        };
    }
    
    // If opening balance is in a different year (earlier), accrual starts from January of this year
    // (the opening balance was already applied in a previous year)
    if (
        periodOpeningBalance?.openingYear != null &&
        Number(periodOpeningBalance.openingYear) < year
    ) {
        return {
            startMonth: 0,
            endMonth,
            monthsCompleted: endMonth - 0 + 1,
        };
    }

    // If employee joined in or before this year, accrual starts from join month
    // If employee joined after this year, no accrual
    let startMonth;
    if (joinYear === year) {
        // Employee joined this year - start from join month
        startMonth = joinMonthIndex;
    } else if (joinYear < year) {
        // Employee joined before this year - start from January
        startMonth = 0;
    } else {
        // Employee joined after this year - no accrual
        return { startMonth: 0, endMonth: -1, monthsCompleted: 0 };
    }

    if (startMonth > 11 || endMonth < startMonth) {
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
        monthlyRate: monthlyCredits.find((c) => c > 0) || 0,
    };
}

/**
 * Roll leave balance from accrual start month through end month (cross-year, no reset).
 * Closing = Previous closing + monthlyRate − used (approved leave only).
 *
 * When periodOpeningBalance is set, rolling ALWAYS starts at openingYear/openingMonth —
 * never at joinYear/joinMonthIndex and never before the imported HRMS month.
 *
 * @param {object} [params.periodOpeningBalance] - Migrated opening balance at openingYear/openingMonth
 * @param {number} params.periodOpeningBalance.openingYear
 * @param {number} params.periodOpeningBalance.openingMonth - 1-12
 * @param {number} params.periodOpeningBalance.balance
 */
export function resolveRollStartPeriod(periodOpeningBalance, joinYear, joinMonthIndex) {
    const hasActiveOpening =
        periodOpeningBalance?.openingYear != null &&
        periodOpeningBalance?.openingMonth != null;

    if (hasActiveOpening) {
        const openingYear = Number(periodOpeningBalance.openingYear);
        const openingMonth = Number(periodOpeningBalance.openingMonth);
        const openingSortKey = calendarMonthSortKey(openingYear, openingMonth);
        const joinSortKey = calendarMonthSortKey(joinYear, joinMonthIndex + 1);

        // Only use opening balance if it's on or after the join date
        // Stale openings (before join date) are ignored
        if (openingSortKey >= joinSortKey) {
            return {
                rollStartYear: openingYear,
                rollStartMonthIndex: openingMonth - 1,
                hasImportedOpening: true,
                openingYear,
                openingMonth,
            };
        }
    }

    // No valid opening balance — use joining month
    const rollStartYear = joinYear;
    const rollStartMonthIndex = joinMonthIndex;

    return {
        rollStartYear,
        rollStartMonthIndex,
        hasImportedOpening: false,
        openingYear: null,
        openingMonth: null,
    };
}

export function rollLeaveBalanceThroughPeriod({
    joinYear,
    joinMonthIndex,
    endYear,
    endMonthIndex,
    monthlyRate = 0,
    getUsedForMonth = () => 0,
    shouldCreditMonth = null,
    balanceAnchor = null,
    periodOpeningBalance = null,
    initialBalance = 0,
    manualCarryForwards = [],
    manualCarryForwardReductions = [],
}) {
    const rollStart = resolveRollStartPeriod(periodOpeningBalance, joinYear, joinMonthIndex);
    const { rollStartYear, rollStartMonthIndex } = rollStart;

    if (
        endYear < rollStartYear ||
        (endYear === rollStartYear && endMonthIndex < rollStartMonthIndex)
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
            calculationStartYear: rollStartYear,
            calculationStartMonth: rollStartMonthIndex + 1,
            openingYear: rollStart.openingYear,
            openingMonth: rollStart.openingMonth,
            firstProcessedMonth: null,
            firstClosingBalance: null,
        };
    }

    const creditForMonth = (year, monthIndex) => {
        // If opening balance exists, skip accrual in the opening month itself
        if (rollStart.hasImportedOpening && year === rollStartYear && monthIndex === rollStartMonthIndex) {
            return 0;
        }
        // Accrual starts from roll start month (join month or later)
        if (!isMonthlyAccrualMonth(rollStartYear, rollStartMonthIndex, year, monthIndex)) {
            return 0;
        }
        let credit = roundLeaveDays(monthlyRate);
        if (shouldCreditMonth) {
            credit = roundLeaveDays(shouldCreditMonth(year, monthIndex) || 0);
        }
        return credit;
    };

    let cursorYear = rollStartYear;
    let cursorMonth = rollStartMonthIndex;
    let previousBalance = roundLeaveDays(initialBalance);
    let lifetimeEarned = 0;
    let lifetimeUsed = 0;
    let yearEarned = 0;
    let yearUsed = 0;
    const ledgerByYear = {};

    while (cursorYear < endYear || (cursorYear === endYear && cursorMonth <= endMonthIndex)) {
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
            // Opening month: use exact opening balance, NO accrual, NO deductions
            const closing = roundLeaveDays(periodOpeningBalance.balance);
            // For opening month, previousBalance should be the opening balance itself
            previousBalance = closing;

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
            // Normal month: apply accrual and deductions
            const credit = creditForMonth(cursorYear, cursorMonth);
            monthUpdate = applyMonthlyLeaveBalanceUpdate(previousBalance, credit, used);
        }

        // Add manual carry forwards effective this month to the balance (not to credit)
        let manualCarryForwardThisMonth = 0;
        for (const mcf of manualCarryForwards) {
            if (mcf.effectiveYear === cursorYear && mcf.effectiveMonth === cursorMonth + 1) {
                manualCarryForwardThisMonth = roundLeaveDays(mcf.amount);
                break;
            }
        }

        if (manualCarryForwardThisMonth > 0) {
            monthUpdate = {
                ...monthUpdate,
                balanceAfterAccrual: roundLeaveDays(monthUpdate.balanceAfterAccrual + manualCarryForwardThisMonth),
                closingBalance: roundLeaveDays(monthUpdate.closingBalance + manualCarryForwardThisMonth),
            };
        }

        // Apply separate manual reductions (does not change add path above)
        let manualReductionThisMonth = 0;
        for (const reduction of manualCarryForwardReductions) {
            if (
                reduction.effectiveYear === cursorYear &&
                reduction.effectiveMonth === cursorMonth + 1
            ) {
                manualReductionThisMonth = roundLeaveDays(
                    manualReductionThisMonth + (Number(reduction.amount) || 0)
                );
            }
        }

        if (manualReductionThisMonth > 0) {
            monthUpdate = {
                ...monthUpdate,
                balanceAfterAccrual: Math.max(
                    0,
                    roundLeaveDays(monthUpdate.balanceAfterAccrual - manualReductionThisMonth)
                ),
                closingBalance: Math.max(
                    0,
                    roundLeaveDays(monthUpdate.closingBalance - manualReductionThisMonth)
                ),
            };
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

    const firstYearLedger = ledgerByYear[rollStartYear] || [];
    const firstProcessedRow = firstYearLedger[0] ?? null;
    const allLedgerRows = Object.keys(ledgerByYear)
        .map((y) => Number(y))
        .filter((y) => Number.isInteger(y))
        .sort((a, b) => a - b)
        .flatMap((y) => ledgerByYear[y] || []);
    const lastProcessedRow = allLedgerRows[allLedgerRows.length - 1] ?? null;

    const yearOpeningBalance = resolveYearOpeningBalance(ledgerByYear, endYear, rollStartYear);

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
        calculationStartYear: rollStartYear,
        calculationStartMonth: rollStartMonthIndex + 1,
        loopStartYear: rollStartYear,
        loopStartMonth: rollStartMonthIndex + 1,
        openingYear: rollStart.openingYear,
        openingMonth: rollStart.openingMonth,
        firstProcessedMonth: firstProcessedRow?.month ?? null,
        firstClosingBalance: firstProcessedRow?.available ?? null,
        lastProcessedYear: lastProcessedRow
            ? allLedgerRows.length > 0
                ? Object.keys(ledgerByYear)
                      .map((y) => Number(y))
                      .filter((y) => ledgerByYear[y]?.includes(lastProcessedRow))
                      .sort((a, b) => b - a)[0]
                : endYear
            : null,
        lastProcessedMonth: lastProcessedRow?.month ?? null,
    };
}
