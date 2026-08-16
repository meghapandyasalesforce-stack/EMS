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
    roundLeaveDays,
} from './leaveBalanceRulesHelper.js';
import { getEffectiveMonthlyTakeCap } from './leaveEmployeeTakeLimitHelper.js';
import { LEAVE_HISTORY_MIN_YEAR } from '../constants/leaveDefaults.js';
import { resolveLeaveBalanceOrganizationId } from './leaveBalanceAccessHelper.js';
import {
    applyProbationAccrualOverlay,
    firstOfMonth,
    isOnProbationAsOf,
} from './leaveProbationHelper.js';

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
    return LeavePolicy.findById(policyId)
        .select('policyName leaveTypes leaveCycle isActive effectiveDate expiryDate isolateUsageFromPriorPolicies')
        .lean();
}

/**
 * Summary "Manual Adjustment" for per-type Balance Adjustment overrides.
 * Uses remaining manualStock (imported/manual days) so header reads:
 * Accrual + Manual stock ≈ Available, and month take limit tracks available.
 */
function sumTypeManualAdjustments(balances = []) {
    return roundLeaveDays(
        balances.reduce((sum, row) => {
            if (!row.manualOverride?.active && !(Number(row.manualStock) > 0)) return sum;
            const mo = row.manualOverride || {};
            const stock =
                row.manualStock != null && !Number.isNaN(Number(row.manualStock))
                    ? Number(row.manualStock)
                    : mo.manualStock != null && !Number.isNaN(Number(mo.manualStock))
                      ? Number(mo.manualStock)
                      : Number(row.carriedDays ?? row.carriedForward) || 0;
            return sum + Math.max(0, roundLeaveDays(stock));
        }, 0)
    );
}

export {
    manualAvailableFromOverride,
    typeManualOverrideAvailable,
} from './leaveBalanceRulesHelper.js';

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
    const employee = await Employee.findById(employeeId)
        .select('joiningDate organizationId probation')
        .lean();
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
    const policyWindowStartDate = leaveBalanceEngine.resolvePolicyWindowStartDate(
        balanceObj.policy,
        employeeForAccrual,
        viewYear,
        asOfDate
    );
    const probationContext = await leaveBalanceEngine.resolveLeaveProbationContext(
        resolvedOrganizationId,
        employeeForAccrual
    );
    const viewMonthAsOf = firstOfMonth(new Date(viewYear, viewMonth - 1, 1)) || monthStart;
    const employeeInProbation = isOnProbationAsOf(probationContext, viewMonthAsOf);

    balanceObj.probation = {
        inProbation: employeeInProbation,
        note: employeeInProbation
            ? 'On probation — leave follows probation rules until confirmation. Normal rules start from the 1st of the next month after confirmation.'
            : null,
    };

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
            const displayConfig = applyProbationAccrualOverlay(
                {
                    ...policyType,
                    carryForward: getEffectiveCarryForwardConfig(policyType),
                },
                probationContext,
                viewMonthAsOf
            );
            const probationAccrualActive = Boolean(displayConfig?._probationOverlay);
            let annualEntitlement = getAnnualEntitlementAmount(displayConfig);
            let monthlyRate = getRollingAccrualMonthlyRate(displayConfig);
            const yearlyCap = getDisplayYearlyAccrualCap(displayConfig);
            const normalMonthlyRate = getRollingAccrualMonthlyRate(policyType);
            const normalAnnualEntitlement = getAnnualEntitlementAmount(policyType);

            if (
                b.manualOverride?.active &&
                b.manualOverride?.excessMode === 'future_months'
            ) {
                if (
                    b.manualOverride.effectiveAnnual != null &&
                    !Number.isNaN(Number(b.manualOverride.effectiveAnnual))
                ) {
                    annualEntitlement = Number(b.manualOverride.effectiveAnnual);
                }
                // Future months: first fundedFutureMonths keep policy monthly; later months show 0
                const anchorY = Number(b.manualOverride.rateAnchorYear);
                const anchorM = Number(b.manualOverride.rateAnchorMonth);
                const funded = Number(b.manualOverride.fundedFutureMonths);
                if (
                    viewYear === anchorY &&
                    viewMonth > anchorM &&
                    Number.isFinite(funded)
                ) {
                    const monthsAfter = viewMonth - anchorM;
                    if (monthsAfter >= 1 && monthsAfter <= funded) {
                        monthlyRate =
                            b.manualOverride.futureMonthlyRate != null &&
                            !Number.isNaN(Number(b.manualOverride.futureMonthlyRate))
                                ? Number(b.manualOverride.futureMonthlyRate)
                                : monthlyRate;
                    } else if (monthsAfter > funded) {
                        monthlyRate = 0;
                    }
                } else if (
                    b.manualOverride.futureMonthlyRate != null &&
                    !Number.isNaN(Number(b.manualOverride.futureMonthlyRate)) &&
                    viewYear === anchorY &&
                    viewMonth > anchorM
                ) {
                    monthlyRate = Number(b.manualOverride.futureMonthlyRate);
                }
            }

            b.annualEntitlement = annualEntitlement;
            b.monthlyRate = monthlyRate;
            b.yearlyCap = yearlyCap;
            b.normalMonthlyRate = normalMonthlyRate;
            b.normalAnnualEntitlement = normalAnnualEntitlement;
            b.inProbation = employeeInProbation;
            b.probationAccrualActive = probationAccrualActive;
            b.carryForwardDuringProbation = displayConfig?._probationCarryForward === true;
            b.allowLeaveDuringProbation = displayConfig?._probationAllowLeave !== false;
            const leaveBlockedOnProbation =
                probationAccrualActive && displayConfig?._probationAllowLeave === false;
            b.probationNote = leaveBlockedOnProbation
                ? `On probation — you cannot apply ${policyType.displayName || policyType.type} until confirmation.`
                : probationAccrualActive
                  ? displayConfig?._probationCarryForward !== true
                      ? `On probation — you earn ${monthlyRate} day(s) per month. Unused days this month do not move to next month. Your old balance stays locked until confirmation.`
                      : `On probation — you earn ${monthlyRate} day(s) per month.`
                  : employeeInProbation && policyType.probationRestrictions?.enabled === false
                    ? 'On probation — normal leave rules apply for this type.'
                    : null;
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
                // Engine already computed available = policy rolling + manualStock − pending.
                // Trust those values so month take limit tracks available and accrual keeps rolling.
                b.manualStock = Math.max(
                    0,
                    Number(b.manualStock ?? mo.manualStock) || 0
                );
                b.carriedForward = Number(mo.carriedForward) || Number(b.carriedForward) || 0;
                b.usedDays = Number(b.used) || 0;
                b.carriedDays = b.carriedForward;
                b.earnedToDate = Number(b.accrued) || 0;
                b.available = Math.max(0, roundLeaveDays(Number(b.available) || 0));
                b.availableDays = b.available;
                b.manualAdjustment = roundLeaveDays(Math.max(0, Number(b.manualStock) || 0));
                b.monthlyTakeLimit = getEffectiveMonthlyTakeCap({
                    availableBalance: b.available,
                    usedThisMonth: 0,
                });
                b.monthlyLedger = [];
                b.accrualHistoryByYear = {};
                b.yearSummaries = [];
                b.earnedThisMonth = getTypeMonthlyAccrualForViewMonth(
                    displayConfig,
                    employeeForAccrual,
                    viewYear,
                    viewMonth
                );
                b.currentMonthAccrual = b.earnedThisMonth;
                b.lifetimeEarned = b.earnedToDate;
                b.lifetimeUsed = b.usedDays;
            } else {
                const rollingEmployee = policyWindowStartDate
                    ? { ...employeeForAccrual, joiningDate: policyWindowStartDate }
                    : employeeForAccrual;
                const rollingInitialBalance = policyWindowStartDate
                    ? roundLeaveDays(Number(b.carriedForward) || 0)
                    : 0;
                const baseTypeConfig = {
                    ...policyType,
                    carryForward: getEffectiveCarryForwardConfig(policyType),
                };
                const resolveTypeForMonth = (year, monthIndex) =>
                    applyProbationAccrualOverlay(
                        baseTypeConfig,
                        probationContext,
                        new Date(year, monthIndex, 1)
                    );
                const rollingAtView = await leaveBalanceEngine.computeRollingMonthlyBalance(
                    baseTypeConfig,
                    rollingEmployee,
                    resolvedOrganizationId,
                    asOfDate,
                    null,
                    viewYear,
                    null,
                    resolveTypeForMonth,
                    rollingInitialBalance
                );
                const rollingFull = await leaveBalanceEngine.computeRollingMonthlyBalance(
                    baseTypeConfig,
                    rollingEmployee,
                    resolvedOrganizationId,
                    now,
                    null,
                    viewYear,
                    null,
                    resolveTypeForMonth,
                    rollingInitialBalance
                );

                b.monthlyLedger = rollingAtView.ledger || [];
                b.accrualHistoryByYear = sortLedgerByYear(rollingFull.ledgerByYear || {});
                b.yearSummaries = buildYearSummaries(b.accrualHistoryByYear, b.monthlyRate, 12);

                b.earnedThisMonth = getTypeMonthlyAccrualForViewMonth(
                    displayConfig,
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
                asOfDate,
                balanceObj.policy
            );
            b.usedDays = roundLeaveDays(liveApprovedUsed);
            b.used = b.usedDays;

            if (b.hasTypeManualOverride) {
                // Engine already applied live used + manualStock; keep available as computed.
                b.availableDays = Math.max(0, roundLeaveDays(Number(b.available) || 0));
                b.available = b.availableDays;
                b.manualAdjustment = roundLeaveDays(Math.max(0, Number(b.manualStock) || 0));
                b.monthlyTakeLimit = getEffectiveMonthlyTakeCap({
                    availableBalance: b.availableDays,
                    usedThisMonth: b.usedThisMonth || 0,
                });
            } else {
                b.availableDays = Math.max(0, roundLeaveDays(Number(b.available) || 0) - b.pendingDays);
                b.available = b.availableDays;
                b.monthlyTakeLimit = getEffectiveMonthlyTakeCap({
                    availableBalance: b.availableDays,
                    usedThisMonth: b.usedThisMonth || 0,
                });
            }

            b.availableDisplay = roundDaysForDisplay(b.availableDays);
            b.annualEntitlementDisplay = roundDaysForDisplay(annualEntitlement);
            b.monthlyRateDisplay = roundDaysForDisplay(monthlyRate);

            if (probationAccrualActive && displayConfig?._probationCarryForward !== true) {
                const remainingThisMonth = leaveBlockedOnProbation
                    ? 0
                    : roundLeaveDays(
                          Math.max(0, Number(monthlyRate) - (Number(b.usedThisMonth) || 0))
                      );
                b.appliableThisMonth = remainingThisMonth;
                b.probationFrozenBalance = roundLeaveDays(
                    Math.max(0, Number(b.availableDays) - remainingThisMonth)
                );
                b.monthlyTakeLimit = leaveBlockedOnProbation
                    ? 0
                    : roundLeaveDays((Number(b.usedThisMonth) || 0) + remainingThisMonth);
            } else if (leaveBlockedOnProbation) {
                b.appliableThisMonth = 0;
                b.monthlyTakeLimit = 0;
                b.probationFrozenBalance = roundLeaveDays(Math.max(0, Number(b.availableDays) || 0));
            }

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
    // Prefer per-type (probation-aware) accrual for this month; policy sum is normal rates only.
    const earnedThisMonth = perTypeCurrentMonthAccrual;
    const totalAnnualEntitlement = roundLeaveDays(
        balanceObj.balances.reduce(
            (sum, row) => sum + (Number(row.annualEntitlement) || 0),
            0
        )
    );
    const totalMonthlyAccrual = roundLeaveDays(
        balanceObj.balances.reduce((sum, row) => sum + (Number(row.monthlyRate) || 0), 0)
    );
    if (balanceObj.employeeContext) {
        balanceObj.employeeContext.totalAnnualEntitlement = totalAnnualEntitlement;
        balanceObj.employeeContext.totalMonthlyAccrual = totalMonthlyAccrual;
        balanceObj.employeeContext.inProbation = employeeInProbation;
    }

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
