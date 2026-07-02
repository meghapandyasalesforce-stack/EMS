import Leave from '../models/leave.model.js';
import Employee from '../models/employee.model.js';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import { getLeaveTypeVariantsForBalance } from './leaveTypeHelper.js';
import {
    getEffectiveEntitlementAmount,
    getEffectiveCarryForwardConfig,
    DEFAULT_LEAVE_ENTITLEMENT_DAYS,
} from '../constants/leaveDefaults.js';
import {
    getMonthlyEntitlementAmount,
    getRollingAccrualMonthlyRate,
    getDisplayYearlyAccrualCap,
} from './leavePolicyAccrualHelper.js';
import {
    getEmployeeLeaveYearBounds,
    clampLeaveViewPeriod,
    isLeaveYearAllowed,
} from './leaveYearBoundsHelper.js';
import { getAccrualMonthRange, roundLeaveDays } from './leaveBalanceRulesHelper.js';
import { LEAVE_HISTORY_MIN_YEAR } from '../constants/leaveDefaults.js';
import { resolveLeaveBalanceOrganizationId } from './leaveBalanceAccessHelper.js';

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

    const pooledAvailable =
        balance.$locals?.pooledAvailable ||
        (await leaveBalanceEngine.computePooledAvailableLeave(
            employee || { joiningDate: bounds.joiningDate, _id: employeeId },
            balanceObj.policy,
            resolvedOrganizationId,
            asOfDate
        ));

    const pooledTypeSet = new Set(
        leaveBalanceEngine
            .getPooledLeaveTypeConfigs(balanceObj.policy || {})
            .map((lt) => lt.type)
    );

    const pooledLedgerAtView = pooledAvailable.ledger || [];
    const pooledLedgerFull = sortLedgerByYear(pooledAvailable.ledgerByYear || {});
    const viewPooledRow =
        pooledLedgerAtView.find((row) => row.month === viewMonth) ||
        pooledLedgerAtView[pooledLedgerAtView.length - 1];

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
        if (isPooledType) {
            b.earnedToDate = 0;
            b.accrued = 0;
            b.carriedForward = 0;
            b.carriedDays = 0;
            b.isPooledCategory = true;
            totalPendingPooled += b.pendingDays;
        } else {
            b.carriedDays = Number(b.carriedForward) || 0;
            b.earnedToDate = Number(b.accrued) || 0;
            b.isPooledCategory = false;
        }

        const accrualRange = getAccrualMonthRange(
            employee || { joiningDate: bounds.joiningDate },
            viewYear,
            asOfDate
        );
        b.monthsCompleted = accrualRange.monthsCompleted;
        b.monthsWithCredit = accrualRange.monthsCompleted;

        if (isPooledType) {
            b.monthlyLedger = pooledLedgerAtView;
            b.accrualHistoryByYear = pooledLedgerFull;
            b.yearSummaries = buildYearSummaries(b.accrualHistoryByYear, monthlyRate);
        } else {
            const rollingAtView = await leaveBalanceEngine.computeRollingMonthlyBalance(
                effectiveConfig,
                employee || { joiningDate: bounds.joiningDate, _id: employeeId },
                resolvedOrganizationId,
                asOfDate
            );

            const historyEnd = now;
            const rollingFull = await leaveBalanceEngine.computeRollingMonthlyBalance(
                effectiveConfig,
                employee || { joiningDate: bounds.joiningDate, _id: employeeId },
                resolvedOrganizationId,
                historyEnd
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

        if (isPooledType && viewPooledRow) {
            b.availableDays = 0;
            b.available = 0;
            b.earnedThisMonth = viewPooledRow.credit ?? 0;
            b.lifetimeEarned = viewPooledRow.cumulativeEarned ?? 0;
            b.lifetimeUsed = viewPooledRow.cumulativeUsed ?? b.usedDays;
        } else {
            const viewLedgerRow = b.monthlyLedger.find((row) => row.month === viewMonth);
            const lastLedgerRow = b.monthlyLedger[b.monthlyLedger.length - 1];
            const balanceAsOfView = viewLedgerRow ?? lastLedgerRow;

            if (balanceAsOfView) {
                b.availableDays = Math.max(
                    0,
                    roundLeaveDays(balanceAsOfView.available) - b.pendingDays
                );
                b.earnedThisMonth = balanceAsOfView.credit ?? 0;
                b.lifetimeEarned = balanceAsOfView.cumulativeEarned ?? b.earnedToDate;
                b.lifetimeUsed = balanceAsOfView.cumulativeUsed ?? b.usedDays;
            } else {
                b.availableDays = Math.max(0, roundLeaveDays(Number(b.available) || 0) - b.pendingDays);
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

    const pooledClosing = viewPooledRow
        ? roundLeaveDays(viewPooledRow.available)
        : roundLeaveDays(pooledAvailable.available ?? 0);
    balanceObj.totalAvailableLeave = Math.max(0, roundLeaveDays(pooledClosing - totalPendingPooled));

    const totalPooledUsed = balanceObj.balances
        .filter((row) => pooledTypeSet.has(row.leaveType))
        .reduce((sum, row) => sum + (Number(row.usedDays ?? row.used) || 0), 0);

    balanceObj.leaveSummary = {
        totalAvailableLeave: balanceObj.totalAvailableLeave,
        totalAccrued: roundLeaveDays(
            viewPooledRow?.cumulativeEarned ??
                pooledAvailable.lifetimeEarned ??
                pooledAvailable.totalEarned ??
                0
        ),
        totalUsed: roundLeaveDays(
            viewPooledRow?.cumulativeUsed ?? pooledAvailable.lifetimeUsed ?? totalPooledUsed
        ),
        totalCarriedForward: roundLeaveDays(pooledAvailable.yearOpeningBalance ?? 0),
        totalPending: totalPendingPooled,
        earnedThisMonth: viewPooledRow?.credit ?? 0,
    };

    balanceObj.balances = balanceObj.balances.map((row) => {
        if (!pooledTypeSet.has(row.leaveType)) {
            return row;
        }
        row.carriedForward = 0;
        row.carriedDays = 0;
        row.availableDays = 0;
        row.available = 0;
        return row;
    });

    balanceObj.accrualHistoryRange = {
        fromYear: LEAVE_HISTORY_MIN_YEAR,
        toYear: bounds.maxYear,
        monthlyRate: DEFAULT_LEAVE_ENTITLEMENT_DAYS / 12,
    };

    return balanceObj;
}
