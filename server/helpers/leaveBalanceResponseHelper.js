import Leave from '../models/leave.model.js';
import LeaveBalance from '../models/leaveBalance.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import Employee from '../models/employee.model.js';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import { getLeaveTypeVariantsForBalance } from './leaveTypeHelper.js';
import {
    getEffectiveCarryForwardConfig,
} from '../constants/leaveDefaults.js';
import {
    getRollingAccrualMonthlyRate,
    getAnnualEntitlementAmount,
    getDisplayYearlyAccrualCap,
    sumPolicyAnnualEntitlement,
    sumPolicyMonthlyAccrual,
    sumPolicyMonthlyAccrualForViewMonth,
    getTypeMonthlyAccrualForViewMonth,
    roundDaysForDisplay,
    normalizePolicyLeaveTypes,
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

function buildYearSummaries(ledgerByYear = {}, monthlyRate = 0, periodsPerYear = 12) {
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
                fullYearCredit: roundLeaveDays(monthlyRate * periodsPerYear),
            };
        });
}

function getEnabledPolicyTypes(policy) {
    return (policy?.leaveTypes || []).filter((lt) => lt?.type && lt.enabled !== false);
}

async function resolvePolicyForBalanceResponse(policyRef) {
    if (!policyRef) {
        return null;
    }
    const policyId = policyRef._id || policyRef;
    if (policyRef.leaveTypes?.length) {
        return policyRef;
    }
    if (!policyId) {
        return policyRef;
    }
    return LeavePolicy.findById(policyId).select('policyName leaveTypes leaveCycle isActive').lean();
}

function sumTypeManualAdjustments(balances = []) {
    return roundLeaveDays(
        balances.reduce((sum, row) => {
            if (!row.manualOverride?.active) return sum;
            const mo = row.manualOverride;
            const baseline = roundLeaveDays((Number(mo.accrued) || 0) - (Number(mo.used) || 0));
            const available = roundLeaveDays(Number(row.availableDays ?? row.available) || 0);
            return sum + (available - baseline);
        }, 0)
    );
}

export { manualAvailableFromOverride } from './leaveBalanceRulesHelper.js';

/**
 * Net HR manual carry-forward add/reduce through the view month (display only).
 * Positive = added days, negative = reduced days. Does not change accrual math.
 */
function netManualCarryAdjustmentThroughView(adds = [], reductions = [], viewYear, viewMonth) {
    const viewKey = calendarMonthSortKey(viewYear, viewMonth);
    let net = 0;

    for (const entry of adds) {
        const y = Number(entry.effectiveYear);
        const m = Number(entry.effectiveMonth);
        if (!Number.isInteger(y) || !Number.isInteger(m)) continue;
        if (calendarMonthSortKey(y, m) > viewKey) continue;
        net = roundLeaveDays(net + (Number(entry.amount) || 0));
    }

    for (const entry of reductions) {
        const y = Number(entry.effectiveYear);
        const m = Number(entry.effectiveMonth);
        if (!Number.isInteger(y) || !Number.isInteger(m)) continue;
        if (calendarMonthSortKey(y, m) > viewKey) continue;
        net = roundLeaveDays(net - (Number(entry.amount) || 0));
    }

    return net;
}

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

    await balance.populate('policy', 'policyName leaveTypes leaveCycle');

    const monthStart = new Date(viewYear, viewMonth - 1, 1);
    const monthEnd = new Date(viewYear, viewMonth, 0, 23, 59, 59);

    const balanceObj = balance.toObject();
    balanceObj.policy = await resolvePolicyForBalanceResponse(balanceObj.policy);
    if (balanceObj.policy?.leaveTypes?.length) {
        balanceObj.policy.leaveTypes = normalizePolicyLeaveTypes(balanceObj.policy.leaveTypes);
    }
    balanceObj.viewPeriod = { year: viewYear, month: viewMonth };
    balanceObj.employeeContext = {
        joiningDate: bounds.joiningDate,
        joiningYear: bounds.joiningYear,
        joiningMonth: bounds.joiningMonth,
        minYear: bounds.minYear,
        maxYear: bounds.maxYear,
        totalAnnualEntitlement: sumPolicyAnnualEntitlement(balanceObj.policy || {}),
        totalMonthlyAccrual: sumPolicyMonthlyAccrual(balanceObj.policy || {}),
    };

    const persistedOpening = await leaveBalanceEngine.resolvePersistedOpeningLeaveBalance(
        employeeId,
        resolvedOrganizationId
    );

    const legacyGlobalOverride = await resolveApplicableManualOverrideAtView(
        employeeId,
        resolvedOrganizationId,
        viewYear,
        viewMonth
    );

    const enabledPolicyTypes = getEnabledPolicyTypes(balanceObj.policy);
    const employeeForAccrual = employee || { joiningDate: bounds.joiningDate, _id: employeeId };

    balanceObj.balances = await Promise.all(
        enabledPolicyTypes.map(async (policyType) => {
            const b =
                balanceObj.balances.find((row) => row.leaveType === policyType.type) || {
                    leaveType: policyType.type,
                    accrued: 0,
                    used: 0,
                    available: 0,
                    carriedForward: 0,
                    expired: 0,
                    pending: 0,
                };

            const types = getLeaveTypeVariantsForBalance(b.leaveType);
            const annualEntitlement = getAnnualEntitlementAmount(policyType);
            const monthlyRate = getRollingAccrualMonthlyRate(policyType);
            const yearlyCap = getDisplayYearlyAccrualCap(policyType);
            const effectiveConfig = {
                ...policyType,
                carryForward: getEffectiveCarryForwardConfig(policyType),
            };

            b.annualEntitlement = annualEntitlement;
            b.monthlyRate = monthlyRate;
            b.yearlyCap = yearlyCap;
            b.usedDays = Number(b.used) || 0;
            b.pendingDays = Number(b.pending) || 0;
            b.carriedDays = Number(b.carriedForward) || 0;
            b.hasTypeManualOverride = Boolean(b.manualOverride?.active);

            const accrualRange = getAccrualMonthRange(
                employee || { joiningDate: bounds.joiningDate },
                viewYear,
                asOfDate,
                persistedOpening
            );
            b.monthsCompleted = accrualRange.monthsCompleted;
            b.monthsWithCredit = accrualRange.monthsCompleted;

            if (b.hasTypeManualOverride) {
                const mo = b.manualOverride;
                b.accrued = Number(mo.accrued) || Number(b.accrued) || 0;
                b.used = Number(mo.used) || Number(b.used) || 0;
                b.carriedForward = Number(mo.carriedForward) || Number(b.carriedForward) || 0;
                b.usedDays = b.used;
                b.carriedDays = b.carriedForward;
                b.earnedToDate = b.accrued;
                b.available = Math.max(0, roundLeaveDays(b.accrued + b.carriedForward - b.used - b.pendingDays));
                b.availableDays = b.available;
                b.manualAdjustment = roundLeaveDays(b.available - Math.max(0, b.accrued + b.carriedForward - b.used));
                b.monthlyLedger = [];
                b.accrualHistoryByYear = {};
                b.yearSummaries = [];
                b.earnedThisMonth = getTypeMonthlyAccrualForViewMonth(
                    policyType,
                    employeeForAccrual,
                    viewYear,
                    viewMonth
                );
                b.currentMonthAccrual = b.earnedThisMonth;
                b.lifetimeEarned = b.earnedToDate;
                b.lifetimeUsed = b.usedDays;
            } else {
                const rollingAtView = await leaveBalanceEngine.computeRollingMonthlyBalance(
                    effectiveConfig,
                    employee || { joiningDate: bounds.joiningDate, _id: employeeId },
                    resolvedOrganizationId,
                    asOfDate,
                    null,
                    viewYear
                );
                const rollingFull = await leaveBalanceEngine.computeRollingMonthlyBalance(
                    effectiveConfig,
                    employee || { joiningDate: bounds.joiningDate, _id: employeeId },
                    resolvedOrganizationId,
                    now,
                    null,
                    viewYear
                );

                b.monthlyLedger = rollingAtView.ledger || [];
                b.accrualHistoryByYear = sortLedgerByYear(rollingFull.ledgerByYear || {});
                b.yearSummaries = buildYearSummaries(b.accrualHistoryByYear, b.monthlyRate, 12);

                b.earnedThisMonth = getTypeMonthlyAccrualForViewMonth(
                    policyType,
                    employeeForAccrual,
                    viewYear,
                    viewMonth
                );
                b.currentMonthAccrual = b.earnedThisMonth;
                b.earnedToDate = roundLeaveDays(Number(b.accrued) || rollingAtView.totalEarned || 0);
                b.lifetimeEarned = b.earnedToDate;
                b.lifetimeUsed = b.usedDays;
                b.availableDays = Math.max(
                    0,
                    roundLeaveDays(Number(b.available) || rollingAtView.available || 0) - b.pendingDays
                );
                b.available = b.availableDays;
                b.manualAdjustment = 0;
            }

            b.leaveTypeDisplayName =
                policyType.displayName ||
                String(b.leaveType).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

            const monthLeaves = await Leave.find({
                organizationId: resolvedOrganizationId,
                employee: employeeId,
                leaveType: { $in: types },
                startDate: { $gte: monthStart, $lte: monthEnd },
                status: { $in: ['approved', 'pending'] },
            });
            b.usedThisMonth = monthLeaves.reduce((sum, l) => sum + (l.duration || 0), 0);

            const liveApprovedUsed = await leaveBalanceEngine.calculateUsedBalance(
                employeeId,
                b.leaveType,
                viewYear,
                resolvedOrganizationId,
                asOfDate
            );
            b.usedDays = roundLeaveDays(liveApprovedUsed);
            b.used = b.usedDays;

            if (b.hasTypeManualOverride) {
                b.available = Math.max(
                    0,
                    roundLeaveDays((Number(b.accrued) || 0) + (Number(b.carriedForward) || 0) - b.usedDays - b.pendingDays)
                );
                b.availableDays = b.available;
            } else {
                b.availableDays = Math.max(0, roundLeaveDays(Number(b.available) || 0) - b.pendingDays);
                b.available = b.availableDays;
            }

            b.availableDisplay = roundDaysForDisplay(b.availableDays);
            b.annualEntitlementDisplay = roundDaysForDisplay(annualEntitlement);
            b.monthlyRateDisplay = roundDaysForDisplay(monthlyRate);

            return b;
        })
    );

    const totalAvailableLeave = roundLeaveDays(
        balanceObj.balances.reduce(
            (sum, row) => sum + (Number(row.availableDays ?? row.available) || 0),
            0
        )
    );
    const totalUsed = roundLeaveDays(
        balanceObj.balances.reduce((sum, row) => sum + (Number(row.usedDays ?? row.used) || 0), 0)
    );
    const totalCarriedForward = roundLeaveDays(
        balanceObj.balances.reduce(
            (sum, row) => sum + (Number(row.carriedDays ?? row.carriedForward) || 0),
            0
        )
    );
    const totalPending = roundLeaveDays(
        balanceObj.balances.reduce((sum, row) => sum + (Number(row.pendingDays ?? row.pending) || 0), 0)
    );
    const totalAccrued = roundLeaveDays(
        balanceObj.balances.reduce(
            (sum, row) => sum + (Number(row.accrued ?? row.earnedToDate ?? row.lifetimeEarned) || 0),
            0
        )
    );
    const perTypeCurrentMonthAccrual = roundLeaveDays(
        balanceObj.balances.reduce((sum, row) => sum + (Number(row.earnedThisMonth) || 0), 0)
    );
    const policyEarnedThisMonth = sumPolicyMonthlyAccrualForViewMonth(
        balanceObj.policy || {},
        employeeForAccrual,
        viewYear,
        viewMonth
    );
    const earnedThisMonth =
        policyEarnedThisMonth > 0 ? policyEarnedThisMonth : perTypeCurrentMonthAccrual;
    const totalAnnualEntitlement = sumPolicyAnnualEntitlement(balanceObj.policy || {});
    const totalMonthlyAccrual = sumPolicyMonthlyAccrual(balanceObj.policy || {});

    const perTypeManualAdjustment = sumTypeManualAdjustments(balanceObj.balances);
    const legacyGlobalAdjustment = legacyGlobalOverride?.available != null
        ? roundLeaveDays(Number(legacyGlobalOverride.available))
        : persistedOpening?.balance != null
          ? roundLeaveDays(Number(persistedOpening.balance))
          : 0;

    const [manualCarryAdds, manualCarryReductions] = await Promise.all([
        leaveBalanceEngine.getManualCarryForwards(employeeId, resolvedOrganizationId),
        leaveBalanceEngine.getManualCarryForwardReductions(employeeId, resolvedOrganizationId),
    ]);
    const netLegacyManualCarry = netManualCarryAdjustmentThroughView(
        manualCarryAdds,
        manualCarryReductions,
        viewYear,
        viewMonth
    );

    balanceObj.totalAvailableLeave = totalAvailableLeave;
    balanceObj.legacyGlobalAdjustment = {
        amount: roundLeaveDays(legacyGlobalAdjustment + netLegacyManualCarry),
        note: 'Legacy pooled wallet adjustment — not distributed across leave types. HR may allocate per type manually.',
        hasLegacyWallet: Boolean(legacyGlobalOverride || persistedOpening?.active),
    };

    balanceObj.leaveSummary = {
        totalAvailableLeave,
        totalAnnualEntitlement,
        totalMonthlyAccrual,
        totalAccrued,
        totalUsed,
        totalCarriedForward,
        totalPending,
        earnedThisMonth,
        perTypeCurrentMonthAccrual: earnedThisMonth,
        manualAdjustment: roundLeaveDays(perTypeManualAdjustment + netLegacyManualCarry),
        perTypeManualAdjustment,
        legacyGlobalAdjustment: balanceObj.legacyGlobalAdjustment.amount,
    };

    balanceObj.policyTotals = {
        annualEntitlement: totalAnnualEntitlement,
        monthlyAccrual: totalMonthlyAccrual,
    };

    balanceObj.accrualHistoryRange = {
        fromYear: LEAVE_HISTORY_MIN_YEAR,
        toYear: bounds.maxYear,
        enabledLeaveTypes: enabledPolicyTypes.map((lt) => lt.type),
    };

    return balanceObj;
}
