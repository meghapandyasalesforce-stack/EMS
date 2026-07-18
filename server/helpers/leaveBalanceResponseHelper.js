import Leave from '../models/leave.model.js';
import LeaveBalance from '../models/leaveBalance.model.js';
import Employee from '../models/employee.model.js';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import { getLeaveTypeVariantsForBalance } from './leaveTypeHelper.js';
import {
    getEffectiveEntitlementAmount,
    getEffectiveCarryForwardConfig,
    DEFAULT_LEAVE_ENTITLEMENT_DAYS,
} from '../constants/leaveDefaults.js';
import {
    getRollingAccrualMonthlyRate,
    getDisplayYearlyAccrualCap,
} from './leavePolicyAccrualHelper.js';
import {
    getEmployeeLeaveYearBounds,
    clampLeaveViewPeriod,
    isLeaveYearAllowed,
} from './leaveYearBoundsHelper.js';
import {
    calendarMonthSortKey,
    getAccrualMonthRange,
    manualAvailableFromOverride,
    roundLeaveDays,
} from './leaveBalanceRulesHelper.js';
import { LEAVE_HISTORY_MIN_YEAR } from '../constants/leaveDefaults.js';
import { resolveLeaveBalanceOrganizationId } from './leaveBalanceAccessHelper.js';
import logger from './logger.js';

function buildYearSummaries(ledgerByYear = {}, monthlyRate = 1.5) {
    return Object.keys(ledgerByYear)
        .map((y) => Number(y))
        .filter((y) => Number.isInteger(y))
        .sort((a, b) => a - b)
        .map((year) => {
            const rows = ledgerByYear[year] || [];
            const decRow = rows.find((r) => r.month === 12) || rows[rows.length - 1];
            const yearEarned = roundLeaveDays(rows.reduce((sum, r) => sum + (Number(r.credit) || 0), 0));
            const yearUsed = roundLeaveDays(rows.reduce((sum, r) => sum + (Number(r.used) || 0), 0));
            return {
                year,
                monthsCredited: rows.filter((r) => Number(r.credit) > 0).length,
                yearEarned,
                yearUsed,
                yearEndBalance: decRow ? roundLeaveDays(decRow.available) : 0,
                monthlyRate,
                fullYearCredit: roundLeaveDays(monthlyRate * 12),
            };
        });
}

export { manualAvailableFromOverride } from './leaveBalanceRulesHelper.js';

/**
 * Latest active manual override anchored at or before the view month (carry-forward safe).
 */
export function pickBestManualOverrideAtView(overrides, viewYear, viewMonth) {
    const viewSortKey = calendarMonthSortKey(viewYear, viewMonth);
    let best = null;

    for (const entry of overrides) {
        const { anchorYear, anchorMonth, adjustedAt = 0, ...fields } = entry;
        const anchorSortKey = calendarMonthSortKey(anchorYear, anchorMonth);
        if (anchorSortKey > viewSortKey) {
            continue;
        }
        if (
            !best ||
            anchorSortKey > best.anchorSortKey ||
            (anchorSortKey === best.anchorSortKey && adjustedAt >= best.adjustedAt)
        ) {
            best = { anchorYear, anchorMonth, anchorSortKey, adjustedAt, ...fields };
        }
    }

    return best;
}

async function resolveApplicableManualOverrideAtView(employeeId, organizationId, viewYear, viewMonth) {
    const docs = await LeaveBalance.find({
        organizationId,
        employee: employeeId,
        'employeeLeaveSummary.manualOverride.active': true,
    })
        .select('year employeeLeaveSummary')
        .lean();

    const candidates = docs
        .map((doc) => {
            const mo = doc.employeeLeaveSummary?.manualOverride;
            if (!mo?.active) {
                return null;
            }
            const anchorYear = Number(mo.anchorYear ?? doc.year);
            const anchorMonth = Number(mo.anchorMonth ?? 1);
            if (!Number.isInteger(anchorYear) || !Number.isInteger(anchorMonth)) {
                return null;
            }
            return {
                anchorYear,
                anchorMonth,
                adjustedAt: mo.adjustedAt ? new Date(mo.adjustedAt).getTime() : 0,
                accrued: mo.accrued,
                used: mo.used,
                carriedForward: mo.carriedForward,
                available: mo.available,
            };
        })
        .filter(Boolean);

    return pickBestManualOverrideAtView(candidates, viewYear, viewMonth);
}

function sortLedgerByYear(ledgerByYear = {}) {
    const sorted = {};
    Object.keys(ledgerByYear)
        .map((y) => Number(y))
        .filter((y) => Number.isInteger(y))
        .sort((a, b) => a - b)
        .forEach((year) => {
            sorted[year] = ledgerByYear[year];
        });
    return sorted;
}

/**
 * Calculate and enrich leave balance for an employee (used by admin + employee endpoints).
 * @param {object} [options]
 * @param {number} [options.month] - 1-12; balance as of end of this month (defaults to current month)
 */
export async function buildEmployeeLeaveBalanceResponse(employeeId, year, organizationId, options = {}) {
    const now = new Date();
    const employee = await Employee.findById(employeeId).select('joiningDate organizationId').lean();
    const resolvedOrganizationId = await resolveLeaveBalanceOrganizationId(employeeId, organizationId);
    const bounds = getEmployeeLeaveYearBounds(employee, now);

    const requestedYear = year ?? now.getFullYear();
    const requestedMonth = options.month ?? now.getMonth() + 1;

    if (!isLeaveYearAllowed(requestedYear, bounds)) {
        return null;
    }

    const { year: viewYear, month: viewMonth } = clampLeaveViewPeriod(
        requestedYear,
        requestedMonth,
        bounds
    );

    const isCurrentPeriod =
        viewYear === bounds.currentYear && viewMonth === bounds.currentMonth;
    let asOfDate = isCurrentPeriod
        ? now
        : leaveBalanceEngine.endOfMonthDate(viewYear, viewMonth - 1);
    if (asOfDate > now) {
        asOfDate = now;
    }

    const balance = await leaveBalanceEngine.calculateBalance(employeeId, viewYear, resolvedOrganizationId, {
        asOfDate,
    });

    if (!balance) {
        return null;
    }

    await balance.populate('policy', 'policyName leaveTypes');

    const monthStart = new Date(viewYear, viewMonth - 1, 1);
    const monthEnd = new Date(viewYear, viewMonth, 0, 23, 59, 59);

    const balanceObj = balance.toObject();
    balanceObj.viewPeriod = { year: viewYear, month: viewMonth };
    balanceObj.employeeContext = {
        joiningDate: bounds.joiningDate,
        joiningYear: bounds.joiningYear,
        joiningMonth: bounds.joiningMonth,
        minYear: bounds.minYear,
        maxYear: bounds.maxYear,
        defaultYearlyEntitlement: DEFAULT_LEAVE_ENTITLEMENT_DAYS,
    };

    const persistedOpening = await leaveBalanceEngine.resolvePersistedOpeningLeaveBalance(
        employeeId,
        resolvedOrganizationId
    );

    logger.info('[OpeningLeaveBalance] buildEmployeeLeaveBalanceResponse', {
        employeeId: String(employeeId),
        viewYear,
        viewMonth,
        openingLeaveBalance: persistedOpening
            ? {
                  openingYear: persistedOpening.openingYear,
                  openingMonth: persistedOpening.openingMonth,
                  balance: persistedOpening.balance,
              }
            : null,
    });

    const pooledAvailable = await leaveBalanceEngine.computePooledAvailableLeave(
        employee || { joiningDate: bounds.joiningDate, _id: employeeId },
        balanceObj.policy,
        resolvedOrganizationId,
        asOfDate,
        await leaveBalanceEngine.resolveEmployeeBalanceAnchor(
            employeeId,
            resolvedOrganizationId,
            persistedOpening
        ),
        persistedOpening
    );

    logger.info('[OpeningLeaveBalance] buildEmployeeLeaveBalanceResponse result', {
        employeeId: String(employeeId),
        accrualStartYear: pooledAvailable.calculationStartYear,
        accrualStartMonth: pooledAvailable.calculationStartMonth,
        loopStartYear: pooledAvailable.loopStartYear,
        loopStartMonth: pooledAvailable.loopStartMonth,
        firstProcessedMonth: pooledAvailable.firstProcessedMonth,
        lastProcessedMonth: pooledAvailable.lastProcessedMonth,
        finalAvailableBalance: pooledAvailable.available,
    });

    const periodOpeningBalance = persistedOpening;

    const accrualStartSortKey =
        (pooledAvailable.calculationStartYear ?? bounds.joiningYear) * 12 +
        ((pooledAvailable.calculationStartMonth ?? bounds.joiningMonth) - 1);
    const viewSortKey = viewYear * 12 + (viewMonth - 1);
    const isBeforeAccrualStart = viewSortKey < accrualStartSortKey;
    const manualOverrideAtView = await resolveApplicableManualOverrideAtView(
        employeeId,
        resolvedOrganizationId,
        viewYear,
        viewMonth
    );
    const hasManualOverrideAtView = Boolean(manualOverrideAtView);
    const zeroPreAccrualSummary = isBeforeAccrualStart && !hasManualOverrideAtView;

    const pooledTypeSet = new Set(
        leaveBalanceEngine
            .getPooledLeaveTypeConfigs(balanceObj.policy || {})
            .map((lt) => lt.type)
    );

    let totalPendingPooled = 0;

    balanceObj.balances = await Promise.all(balanceObj.balances.map(async (b) => {
        const types = getLeaveTypeVariantsForBalance(b.leaveType);
        const policyType = balanceObj.policy?.leaveTypes?.find((lt) => lt.type === b.leaveType);
        const entitlement = getEffectiveEntitlementAmount(policyType || {});
        const monthlyRate =
            getRollingAccrualMonthlyRate(policyType || { type: b.leaveType }) ??
            Math.round((entitlement / 12) * 100) / 100;
        const yearlyCap = getDisplayYearlyAccrualCap(policyType || { type: b.leaveType }) ?? entitlement;
        const effectiveConfig = {
            ...(policyType || { type: b.leaveType }),
            carryForward: getEffectiveCarryForwardConfig(policyType || { type: b.leaveType }),
        };

        b.monthlyRate = monthlyRate;
        b.yearlyCap = yearlyCap;
        b.usedDays = Number(b.used) || 0;
        b.pendingDays = Number(b.pending) || 0;
        const isPooledType = pooledTypeSet.has(b.leaveType);
        const hasTypeOverride = Boolean(b.manualOverride?.active);
        if (hasTypeOverride) {
            const mo = b.manualOverride;
            b.accrued = Number(mo.accrued) || Number(b.accrued) || 0;
            b.used = Number(mo.used) || Number(b.used) || 0;
            b.carriedForward = Number(mo.carriedForward) || Number(b.carriedForward) || 0;
            b.usedDays = b.used;
            b.carriedDays = b.carriedForward;
            b.earnedToDate = b.accrued;
            b.isPooledCategory = false;
            b.hasTypeManualOverride = true;
            const overrideAvailable = Math.max(
                0,
                roundLeaveDays(b.accrued - b.used)
            );
            b.available = overrideAvailable;
            b.availableDays = overrideAvailable;
        } else if (isPooledType) {
            // Shared leave wallet — per-type Available is assigned after pooledClosing is known.
            b.isPooledCategory = true;
            b.carriedForward = 0;
            b.carriedDays = 0;
            b.accrued = 0;
            b.earnedToDate = 0;
            totalPendingPooled += b.pendingDays;
        } else {
            b.carriedDays = 0;
            b.carriedForward = 0;
            b.earnedToDate = Number(b.accrued) || 0;
            b.isPooledCategory = false;
        }

        const accrualRange = getAccrualMonthRange(
            employee || { joiningDate: bounds.joiningDate },
            viewYear,
            asOfDate,
            periodOpeningBalance
        );
        b.monthsCompleted = accrualRange.monthsCompleted;
        b.monthsWithCredit = accrualRange.monthsCompleted;

        if (hasTypeOverride) {
            b.monthlyLedger = [];
            b.accrualHistoryByYear = {};
            b.yearSummaries = [];
        } else if (isPooledType) {
            const pooledLedgerAtViewEarly = pooledAvailable.ledger || [];
            const pooledLedgerFull = sortLedgerByYear(pooledAvailable.ledgerByYear || {});
            b.monthlyLedger = pooledLedgerAtViewEarly;
            b.accrualHistoryByYear = pooledLedgerFull;
            b.yearSummaries = buildYearSummaries(b.accrualHistoryByYear, monthlyRate);
        } else {
            const rollingAtView = await leaveBalanceEngine.computeRollingMonthlyBalance(
                effectiveConfig,
                employee || { joiningDate: bounds.joiningDate, _id: employeeId },
                resolvedOrganizationId,
                asOfDate,
                periodOpeningBalance
            );

            const historyEnd = now;
            const rollingFull = await leaveBalanceEngine.computeRollingMonthlyBalance(
                effectiveConfig,
                employee || { joiningDate: bounds.joiningDate, _id: employeeId },
                resolvedOrganizationId,
                historyEnd,
                periodOpeningBalance
            );

            b.monthlyLedger = rollingAtView.ledger || [];
            b.accrualHistoryByYear = sortLedgerByYear(rollingFull.ledgerByYear || {});
            b.yearSummaries = buildYearSummaries(b.accrualHistoryByYear, b.monthlyRate);
        }

        b.leaveTypeDisplayName =
            policyType?.displayName ||
            (b.leaveType
                ? String(b.leaveType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
                : 'Leave');

        if (hasTypeOverride) {
            b.earnedThisMonth = monthlyRate;
            b.lifetimeEarned = b.earnedToDate;
            b.lifetimeUsed = b.usedDays;
        } else if (isPooledType) {
            const pooledLedgerAtViewEarly = pooledAvailable.ledger || [];
            const viewRow =
                pooledLedgerAtViewEarly.find((row) => row.month === viewMonth) ||
                pooledLedgerAtViewEarly[pooledLedgerAtViewEarly.length - 1];
            // Available assigned once below from shared wallet (not per-type rolling).
            b.availableDays = 0;
            b.available = 0;
            b.earnedThisMonth = monthlyRate;
            b.lifetimeEarned = viewRow?.cumulativeEarned ?? 0;
            b.lifetimeUsed = viewRow?.cumulativeUsed ?? b.usedDays;
        } else {
            const viewLedgerRow = b.monthlyLedger.find((row) => row.month === viewMonth);
            const lastLedgerRow = b.monthlyLedger[b.monthlyLedger.length - 1];
            const balanceAsOfView = viewLedgerRow ?? lastLedgerRow;

            if (balanceAsOfView) {
                b.availableDays = Math.max(
                    0,
                    roundLeaveDays(balanceAsOfView.available) - b.pendingDays
                );
                b.available = b.availableDays;
                b.earnedThisMonth = monthlyRate;
                b.lifetimeEarned = balanceAsOfView.cumulativeEarned ?? b.earnedToDate;
                b.lifetimeUsed = balanceAsOfView.cumulativeUsed ?? b.usedDays;
            } else {
                b.availableDays = Math.max(0, roundLeaveDays(Number(b.available) || 0) - b.pendingDays);
                b.available = b.availableDays;
                b.lifetimeEarned = b.earnedToDate;
                b.lifetimeUsed = b.usedDays;
                b.earnedThisMonth =
                    viewMonth - 1 >= accrualRange.startMonth && viewMonth - 1 <= accrualRange.endMonth
                        ? monthlyRate
                        : 0;
            }
        }

        const monthLeaves = await Leave.find({
            organizationId: resolvedOrganizationId,
            employee: employeeId,
            leaveType: { $in: types },
            startDate: { $gte: monthStart, $lte: monthEnd },
            status: { $in: ['approved', 'pending'] },
        });
        b.usedThisMonth = monthLeaves.reduce((sum, l) => sum + (l.duration || 0), 0);

        return b;
    }));

    // Employee Leave Summary uses the shared monthly leave wallet (1.5 for a July joiner),
    // not the sum of every leave-type card. After per-type Balance Adjustment, sum overrides.
    const allTypesAvailableSum = balanceObj.balances.reduce(
        (sum, row) => sum + (Number(row.availableDays ?? row.available) || 0),
        0
    );
    const hasTypeOverrides = balanceObj.balances.some((row) => row.hasTypeManualOverride);

    const overrideAnchorSortKey = hasManualOverrideAtView
        ? calendarMonthSortKey(manualOverrideAtView.anchorYear, manualOverrideAtView.anchorMonth)
        : null;
    const useManualOverrideWallet =
        hasManualOverrideAtView &&
        (isBeforeAccrualStart || viewSortKey === overrideAnchorSortKey);

    const isOpeningMonthView =
        periodOpeningBalance?.active &&
        viewYear === periodOpeningBalance.openingYear &&
        viewMonth === Number(periodOpeningBalance.openingMonth);

    const pooledLedgerAtView = pooledAvailable.ledger || [];
    const viewPooledRow =
        pooledLedgerAtView.find((row) => row.month === viewMonth) ||
        pooledLedgerAtView[pooledLedgerAtView.length - 1];

    const pooledClosing = zeroPreAccrualSummary
        ? 0
        : useManualOverrideWallet
          ? manualAvailableFromOverride(manualOverrideAtView)
          : isOpeningMonthView
            ? roundLeaveDays(periodOpeningBalance.balance)
            : viewPooledRow
              ? roundLeaveDays(viewPooledRow.available)
              : roundLeaveDays(pooledAvailable.available ?? 0);

    if (zeroPreAccrualSummary) {
        balanceObj.totalAvailableLeave = 0;
    } else if (hasTypeOverrides) {
        balanceObj.totalAvailableLeave = Math.max(0, roundLeaveDays(allTypesAvailableSum));
    } else if (useManualOverrideWallet) {
        balanceObj.totalAvailableLeave = Math.max(0, roundLeaveDays(pooledClosing));
    } else {
        balanceObj.totalAvailableLeave = Math.max(
            0,
            roundLeaveDays(pooledClosing - totalPendingPooled)
        );
    }

    // Shared wallet: split the same policy total across pooled leave cards so they sum to 1.5
    // (not 1.5 per type). Types with a manual Balance Adjustment keep their own balance.
    if (!zeroPreAccrualSummary && !hasTypeOverrides) {
        const sharedForCards = balanceObj.totalAvailableLeave;
        const pooledRows = balanceObj.balances.filter(
            (row) => pooledTypeSet.has(row.leaveType) && !row.hasTypeManualOverride
        );
        const n = pooledRows.length;
        if (n > 0) {
            let allocated = 0;
            pooledRows.forEach((row, idx) => {
                const days =
                    idx === n - 1
                        ? roundLeaveDays(sharedForCards - allocated)
                        : roundLeaveDays(sharedForCards / n);
                allocated = roundLeaveDays(allocated + days);
                row.availableDays = days;
                row.available = days;
                row.carriedForward = 0;
                row.carriedDays = 0;
            });
        }
    }

    const totalPooledUsed = balanceObj.balances
        .filter((row) => pooledTypeSet.has(row.leaveType))
        .reduce((sum, row) => sum + (Number(row.usedDays ?? row.used) || 0), 0);

    const manualCarriedForward =
        manualOverrideAtView?.carriedForward != null &&
        !Number.isNaN(Number(manualOverrideAtView.carriedForward))
            ? roundLeaveDays(Number(manualOverrideAtView.carriedForward))
            : null;

    let totalCarriedForwardValue;
    if (zeroPreAccrualSummary) {
        totalCarriedForwardValue = 0;
    } else if (hasTypeOverrides) {
        totalCarriedForwardValue = roundLeaveDays(
            balanceObj.balances.reduce(
                (sum, row) => sum + (Number(row.carriedDays ?? row.carriedForward) || 0),
                0
            )
        );
    } else if (hasManualOverrideAtView && manualCarriedForward != null) {
        totalCarriedForwardValue = manualCarriedForward;
    } else {
        totalCarriedForwardValue = roundLeaveDays(
            isOpeningMonthView
                ? periodOpeningBalance.balance
                : viewPooledRow?.available != null
                  ? viewPooledRow.available
                  : pooledAvailable.yearOpeningBalance ?? 0
        );
    }

    balanceObj.leaveSummary = {
        totalAvailableLeave: balanceObj.totalAvailableLeave,
        totalAccrued: zeroPreAccrualSummary
            ? 0
            : hasTypeOverrides
              ? roundLeaveDays(
                    balanceObj.balances.reduce(
                        (sum, row) => sum + (Number(row.accrued ?? row.earnedToDate) || 0),
                        0
                    )
                )
              : useManualOverrideWallet && manualOverrideAtView.accrued != null
                ? roundLeaveDays(Number(manualOverrideAtView.accrued) || 0)
                : roundLeaveDays(
                      viewPooledRow?.cumulativeEarned ??
                          pooledAvailable.lifetimeEarned ??
                          pooledAvailable.totalEarned ??
                          0
                  ),
        totalUsed: zeroPreAccrualSummary
            ? 0
            : hasTypeOverrides
              ? roundLeaveDays(
                    balanceObj.balances.reduce(
                        (sum, row) => sum + (Number(row.usedDays ?? row.used) || 0),
                        0
                    )
                )
              : useManualOverrideWallet
                ? roundLeaveDays(Number(manualOverrideAtView.used) || 0)
                : roundLeaveDays(
                      viewPooledRow?.cumulativeUsed ?? pooledAvailable.lifetimeUsed ?? totalPooledUsed
                  ),
        totalCarriedForward: totalCarriedForwardValue,
        totalPending: zeroPreAccrualSummary ? 0 : totalPendingPooled,
        earnedThisMonth: zeroPreAccrualSummary ? 0 : DEFAULT_LEAVE_ENTITLEMENT_DAYS / 12,
    };

    balanceObj.accrualHistoryRange = {
        fromYear: LEAVE_HISTORY_MIN_YEAR,
        toYear: bounds.maxYear,
        monthlyRate: DEFAULT_LEAVE_ENTITLEMENT_DAYS / 12,
    };

    return balanceObj;
}
