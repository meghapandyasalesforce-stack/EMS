import LeaveBalance from '../models/leaveBalance.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import Leave from '../models/leave.model.js';
import Employee from '../models/employee.model.js';
import logger from '../helpers/logger.js';
import { getLeaveTypeVariantsForBalance } from '../helpers/leaveTypeHelper.js';
import {
    getPolicyMonthlyAccrualAmount,
    getRollingAccrualMonthlyRate,
    getAnnualEntitlementAmount,
    usesMonthlyAccrual,
    normalizePolicyLeaveTypes,
    sumPolicyMonthlyAccrual,
} from '../helpers/leavePolicyAccrualHelper.js';
import {
    getEffectiveCarryForwardConfig,
} from '../constants/leaveDefaults.js';
import {
    getEffectiveJoiningDate,
    rollLeaveBalanceThroughPeriod,
    roundLeaveDays,
    calendarMonthSortKey,
    manualAvailableFromOverride,
    typeManualOverrideAvailable,
} from '../helpers/leaveBalanceRulesHelper.js';
import { consumeLeaveBuckets } from '../helpers/leaveEmployeeTakeLimitHelper.js';
import { chooseCanonicalOpening as pickCanonicalOpening } from '../helpers/openingLeaveBalanceHelper.js';
import { resolveLeaveBalanceOrganizationId } from '../helpers/leaveBalanceAccessHelper.js';
import {
    isLeavePolicyApplicableToEmployee,
    selectApplicableLeavePolicy,
    buildEmployeeLeavePolicyMonthMap,
    findPolicyLeaveTypeConfig,
    toLeavePolicyLocalDay,
} from '../helpers/leavePolicyApplicabilityHelper.js';

class LeaveBalanceEngine {
    /**
     * A policy is considered usable only when it has at least
     * one leave type configured with a positive accrual amount.
     */
    hasUsableLeaveTypes(policy) {
        const leaveTypes = policy?.leaveTypes || [];
        return leaveTypes.some(
            (lt) =>
                lt?.enabled !== false &&
                (getAnnualEntitlementAmount(lt) > 0 || getPolicyMonthlyAccrualAmount(lt) > 0)
        );
    }
    /**
     * One balance row per employee per calendar year (unique index: org + employee + year).
     */
    async getOrCreateBalanceRecord(organizationId, employeeId, year, policyId) {
        let balance = await LeaveBalance.findOne({
            organizationId,
            employee: employeeId,
            year,
        });

        if (balance) {
            if (policyId && String(balance.policy) !== String(policyId)) {
                balance.policy = policyId;
            }
            return balance;
        }

        return new LeaveBalance({
            organizationId,
            employee: employeeId,
            policy: policyId,
            year,
            balances: [],
        });
    }

    /**
     * Active org leave policies (normalized leave types). Cached per calculateBalance call via options.
     */
    async loadOrganizationLeavePolicies(organizationId) {
        const policies = await LeavePolicy.find({
            organizationId,
            isActive: true,
        }).sort({ effectiveDate: -1 });

        return policies.map((policy) => {
            const plain = typeof policy.toObject === 'function' ? policy.toObject() : { ...policy };
            return {
                ...plain,
                leaveTypes: normalizePolicyLeaveTypes(plain.leaveTypes),
            };
        });
    }

    /**
     * Resolve as-of date for policy lookup when only a calendar year is known.
     * Past years → 31 Dec of that year; otherwise now (or explicit asOfDate).
     */
    resolvePolicyAsOfDate(year, asOfDate = null) {
        if (asOfDate) {
            const parsed = toLeavePolicyLocalDay(asOfDate) || new Date(asOfDate);
            if (!Number.isNaN(parsed.getTime())) return parsed;
        }
        const now = new Date();
        if (year != null && Number.isInteger(Number(year))) {
            const y = Number(year);
            if (y < now.getFullYear()) {
                return new Date(y, 11, 31, 12, 0, 0, 0);
            }
        }
        return now;
    }

    /**
     * Collect leave-type configs for the accrual window (union across mid-year policy changes).
     * Primary config per type prefers the as-of policy, else the latest window that had the type.
     */
    collectLeaveTypeConfigsForAccrualWindow(policies, employee, fromYear, fromMonthIndex, toYear, toMonthIndex, asOfPolicy) {
        const monthMap = buildEmployeeLeavePolicyMonthMap(
            policies,
            employee,
            fromYear,
            fromMonthIndex,
            toYear,
            toMonthIndex,
            {
                requireUsable: true,
                hasUsableLeaveTypes: (p) => this.hasUsableLeaveTypes(p),
            }
        );

        const byType = new Map();
        for (const entry of monthMap) {
            if (!entry.policy) continue;
            for (const lt of entry.policy.leaveTypes || []) {
                if (lt?.enabled === false || !lt?.type) continue;
                const key = String(lt.type).toLowerCase();
                byType.set(key, {
                    ...lt,
                    _sourcePolicyId: entry.policy._id,
                });
            }
        }

        // Prefer as-of policy configs for rules (carry-forward, caps) while keeping union of types.
        if (asOfPolicy?.leaveTypes) {
            for (const lt of asOfPolicy.leaveTypes) {
                if (lt?.enabled === false || !lt?.type) continue;
                const key = String(lt.type).toLowerCase();
                byType.set(key, {
                    ...lt,
                    _sourcePolicyId: asOfPolicy._id,
                });
            }
        }

        return {
            leaveTypeConfigs: [...byType.values()],
            monthMap,
        };
    }

    buildLeaveTypeConfigResolver(policies, employee, fallbackConfig) {
        const leaveType = fallbackConfig?.type;
        return (year, monthIndex) => {
            const asOf = new Date(year, monthIndex, 1, 12, 0, 0, 0);
            const policy = selectApplicableLeavePolicy(policies, employee, asOf, {
                requireUsable: true,
                hasUsableLeaveTypes: (p) => this.hasUsableLeaveTypes(p),
            });
            if (!policy) return null;
            const lt = findPolicyLeaveTypeConfig(policy, leaveType);
            if (!lt) return null;
            return {
                ...lt,
                carryForward: getEffectiveCarryForwardConfig(lt),
                _sourcePolicyId: policy._id,
            };
        };
    }

    /**
     * Calculate and update leave balance for an employee for a given year
     * @param {Date} [options.asOfDate] - Calculate balances as of this date (end of month for views)
     * @param {boolean} [options.clearManualOverride] - Clear per-leave-type manual overrides during automated recalc (employee wallet anchor is never cleared here)
     */
    async calculateBalance(employeeId, year, organizationId, options = {}) {
        const { asOfDate = new Date(), clearManualOverride = false } = options;
        try {
            const resolvedOrganizationId = await resolveLeaveBalanceOrganizationId(
                employeeId,
                organizationId
            );

            // Get employee details
            const employee = await Employee.findById(employeeId);
            if (!employee) {
                throw new Error('Employee not found');
            }

            const policies = await this.loadOrganizationLeavePolicies(resolvedOrganizationId);
            const policyAsOf = this.resolvePolicyAsOfDate(year, asOfDate);

            // As-of policy (date window + applicability); used as balance.policy pointer
            const policy = selectApplicableLeavePolicy(policies, employee, policyAsOf, {
                requireUsable: true,
                hasUsableLeaveTypes: (p) => this.hasUsableLeaveTypes(p),
            });
            if (!policy) {
                logger.warn('No leave policy found for employee', { employeeId, year, asOfDate: policyAsOf });
                return null;
            }
            if (!this.hasUsableLeaveTypes(policy)) {
                logger.warn('Applicable policy has no usable leave types', {
                    employeeId,
                    year,
                    policyId: policy._id,
                    policyName: policy.policyName
                });
                return null;
            }

            // Get or create balance record (unique key: org + employee + year — not policy)
            let balance = await this.getOrCreateBalanceRecord(
                resolvedOrganizationId,
                employeeId,
                year,
                policy._id
            );

            const periodOpeningBalance = await this.resolvePersistedOpeningLeaveBalance(
                employeeId,
                resolvedOrganizationId
            );

            const joiningDate = getEffectiveJoiningDate(employee);
            let fromYear = joiningDate.getFullYear();
            let fromMonthIndex = joiningDate.getMonth();
            if (
                periodOpeningBalance?.openingYear != null &&
                periodOpeningBalance?.openingMonth != null
            ) {
                fromYear = Number(periodOpeningBalance.openingYear);
                fromMonthIndex = Number(periodOpeningBalance.openingMonth) - 1;
            }

            const { leaveTypeConfigs } = this.collectLeaveTypeConfigsForAccrualWindow(
                policies,
                employee,
                fromYear,
                fromMonthIndex,
                asOfDate.getFullYear(),
                asOfDate.getMonth(),
                policy
            );

            logger.info('[OpeningLeaveBalance] calculateBalance', {
                employeeId: String(employeeId),
                year,
                asOfYear: asOfDate.getFullYear(),
                asOfMonth: asOfDate.getMonth() + 1,
                policyId: String(policy._id),
                policyEffectiveDate: policy.effectiveDate,
                leaveTypeCount: leaveTypeConfigs.length,
                openingLeaveBalance: periodOpeningBalance
                    ? {
                          openingYear: periodOpeningBalance.openingYear,
                          openingMonth: periodOpeningBalance.openingMonth,
                          balance: periodOpeningBalance.balance,
                      }
                    : null,
            });

            // Each enabled leave type maintains an independent balance (policy-driven; mid-year split via resolver).
            for (const leaveTypeConfig of leaveTypeConfigs) {
                if (leaveTypeConfig.enabled === false || !leaveTypeConfig.type) {
                    continue;
                }
                const resolveLeaveTypeConfigForMonth = this.buildLeaveTypeConfigResolver(
                    policies,
                    employee,
                    leaveTypeConfig
                );
                await this.calculateLeaveTypeBalance(
                    balance,
                    leaveTypeConfig,
                    employee,
                    year,
                    resolvedOrganizationId,
                    { asOfDate, clearManualOverride, resolveLeaveTypeConfigForMonth, orgPolicies: policies }
                );
            }

            balance.lastAccrualDate = new Date();
            await balance.save();

            return balance;
        } catch (error) {
            logger.error('Error calculating leave balance', {
                error: error.message,
                stack: error.stack,
                employeeId,
                year
            });
            throw error;
        }
    }

    /**
     * Calculate balance for a specific leave type
     */
    async calculateLeaveTypeBalance(balance, leaveTypeConfig, employee, year, organizationId, options = {}) {
        const {
            asOfDate = new Date(),
            clearManualOverride = false,
            resolveLeaveTypeConfigForMonth = null,
        } = options;
        const leaveType = leaveTypeConfig.type;
        const effectiveConfig = {
            ...leaveTypeConfig,
            carryForward: getEffectiveCarryForwardConfig(leaveTypeConfig),
        };
        
        // Find or create balance entry for this leave type
        let typeBalance = balance.balances.find(b => b.leaveType === leaveType);
        if (!typeBalance) {
            typeBalance = {
                leaveType,
                accrued: 0,
                used: 0,
                available: 0,
                carriedForward: 0,
                expired: 0,
                pending: 0,
                manualStock: 0,
            };
            balance.balances.push(typeBalance);
        }

        if (typeBalance.manualStock == null || Number.isNaN(Number(typeBalance.manualStock))) {
            typeBalance.manualStock = 0;
        }

        if (clearManualOverride && typeBalance.manualOverride?.active) {
            typeBalance.manualOverride = { active: false };
            typeBalance.manualStock = 0;
            typeBalance.manualDebit = 0;
        }

        const carryForwardConfig = effectiveConfig.carryForward;
        const manualCarryLocked =
            typeBalance.manualOverride?.active &&
            typeBalance.manualOverride?.carriedForward != null &&
            !Number.isNaN(Number(typeBalance.manualOverride.carriedForward));

        const existingMo = typeBalance.manualOverride;
        const rateSchedule =
            existingMo?.active &&
            existingMo.excessMode === 'future_months' &&
            existingMo.futureMonthlyRate != null &&
            !Number.isNaN(Number(existingMo.futureMonthlyRate))
                ? {
                      anchorYear: existingMo.rateAnchorYear ?? year,
                      anchorMonth: existingMo.rateAnchorMonth ?? 1,
                      beforeRate: getRollingAccrualMonthlyRate(effectiveConfig),
                      afterRate: Number(existingMo.futureMonthlyRate),
                      fundedFutureMonths:
                          existingMo.fundedFutureMonths != null &&
                          !Number.isNaN(Number(existingMo.fundedFutureMonths))
                              ? Math.max(0, Number(existingMo.fundedFutureMonths))
                              : null,
                      annualCap:
                          existingMo.effectiveAnnual != null &&
                          !Number.isNaN(Number(existingMo.effectiveAnnual))
                              ? Number(existingMo.effectiveAnnual)
                              : undefined,
                  }
                : null;

        let rollingAvailable = null;

        if (this.usesStandardMonthlyBalanceRules(effectiveConfig)) {
            const computed = await this.computeRollingMonthlyBalance(
                effectiveConfig,
                employee,
                organizationId,
                asOfDate,
                null,
                year,
                rateSchedule,
                resolveLeaveTypeConfigForMonth
            );
            typeBalance.accrued = computed.totalEarned;
            typeBalance.used = computed.totalUsed;
            if (!manualCarryLocked) {
                typeBalance.carriedForward = computed.yearOpeningBalance;
            }
            rollingAvailable = computed.available;
        } else {
            const joiningDate = getEffectiveJoiningDate(employee);
            const joiningYear = joiningDate.getFullYear();

            if (carryForwardConfig?.enabled && year > joiningYear && !manualCarryLocked) {
                const carriedForward = await this.calculateCarryForward(
                    employee._id,
                    leaveType,
                    year - 1,
                    carryForwardConfig,
                    organizationId
                );
                typeBalance.carriedForward = carriedForward;

                if (carriedForward > 0) {
                    balance.carryForwardHistory = balance.carryForwardHistory || [];
                    const existingIdx = balance.carryForwardHistory.findIndex(
                        (h) =>
                            h.fromYear === year - 1 &&
                            h.toYear === year &&
                            h.leaveType === leaveType
                    );
                    const entry = {
                        fromYear: year - 1,
                        toYear: year,
                        leaveType,
                        amount: carriedForward,
                        date: new Date(),
                    };
                    if (existingIdx >= 0) {
                        balance.carryForwardHistory[existingIdx] = entry;
                    } else {
                        balance.carryForwardHistory.push(entry);
                    }
                }
            } else if (!manualCarryLocked && !carryForwardConfig?.enabled) {
                typeBalance.carriedForward = 0;
            }

            typeBalance.accrued = await this.calculateAccruedBalance(
                effectiveConfig,
                employee,
                year,
                organizationId,
                asOfDate,
                resolveLeaveTypeConfigForMonth
            );
            typeBalance.used = await this.calculateUsedBalance(
                employee._id,
                leaveType,
                year,
                organizationId,
                asOfDate
            );
        }

        const pending = await this.calculatePendingBalance(
            employee._id,
            leaveType,
            year,
            organizationId,
            asOfDate
        );
        typeBalance.pending = pending;

        // Calculate expired balance
        if (carryForwardConfig?.expiresIfNotUsed) {
            const expired = await this.calculateExpiredBalance(
                employee._id,
                leaveType,
                year,
                carryForwardConfig,
                organizationId
            );
            typeBalance.expired = expired;
        }

        // Manual Balance Adjustment: preserve manualStock + manualDebit; keep monthly accrual rolling.
        // available = policy rolling + manualStock − manualDebit − pending/expired.
        // Leave usage consumes policy bucket first, then manualStock.
        // Reduce excess beyond available is LOP (created in adjust controller) — never cuts annual.
        if (typeBalance.manualOverride?.active) {
            const mo = typeBalance.manualOverride;
            let stock =
                mo.manualStock != null && !Number.isNaN(Number(mo.manualStock))
                    ? Math.max(0, Number(mo.manualStock))
                    : Math.max(0, Number(typeBalance.manualStock) || 0);
            let debit =
                mo.manualDebit != null && !Number.isNaN(Number(mo.manualDebit))
                    ? Math.max(0, Number(mo.manualDebit))
                    : Math.max(0, Number(typeBalance.manualDebit) || 0);

            if (mo.carriedForward != null && !Number.isNaN(Number(mo.carriedForward))) {
                typeBalance.carriedForward = Number(mo.carriedForward);
            }

            const liveUsed = await this.calculateUsedBalance(
                employee._id,
                leaveType,
                year,
                organizationId,
                asOfDate
            );
            const usedBaseline =
                mo.used != null && !Number.isNaN(Number(mo.used))
                    ? Number(mo.used)
                    : liveUsed;
            const usedDelta = roundLeaveDays(liveUsed - usedBaseline);

            // Policy-only earned (set by rolling path above — before we add manual stock to accrued)
            const policyEarned = Number(typeBalance.accrued) || 0;
            const carried = Number(typeBalance.carriedForward) || 0;
            const expired = Number(typeBalance.expired) || 0;
            const policyAvailableBefore = Math.max(
                0,
                roundLeaveDays(policyEarned + carried - usedBaseline - expired - debit)
            );
            const policyAvailableAfter =
                rollingAvailable != null
                    ? Math.max(0, roundLeaveDays(rollingAvailable - debit))
                    : Math.max(
                          0,
                          roundLeaveDays(policyEarned + carried - liveUsed - expired - debit)
                      );

            if (usedDelta > 0) {
                const availableBefore = roundLeaveDays(policyAvailableBefore + stock);
                const consumed = consumeLeaveBuckets({
                    manualStock: stock,
                    availableBefore,
                    days: usedDelta,
                });
                stock = consumed.manualStock;
            }

            typeBalance.used = liveUsed;
            typeBalance.manualStock = stock;
            typeBalance.manualDebit = debit;
            typeBalance.available = Math.max(
                0,
                roundLeaveDays(
                    policyAvailableAfter +
                        stock -
                        (Number(typeBalance.pending) || 0) -
                        expired
                )
            );
            // Accrued display includes manual stock so annual/type totals move with add/reduce
            typeBalance.accrued = roundLeaveDays(policyEarned + stock);

            typeBalance.manualOverride = {
                ...mo,
                active: true,
                accrued: typeBalance.accrued,
                used: typeBalance.used,
                carriedForward: typeBalance.carriedForward,
                manualStock: typeBalance.manualStock,
                manualDebit: typeBalance.manualDebit,
            };
            return;
        }

        // Available follows per-type rolling balance (pending/expired reduce usable amount)
        if (rollingAvailable != null) {
            typeBalance.available = Math.max(
                0,
                roundLeaveDays(rollingAvailable) -
                    (typeBalance.pending || 0) -
                    (typeBalance.expired || 0)
            );
        } else {
            typeBalance.available = Math.max(
                0,
                typeBalance.accrued +
                    typeBalance.carriedForward -
                    typeBalance.used -
                    typeBalance.expired -
                    typeBalance.pending
            );
        }
    }

    usesStandardMonthlyBalanceRules(leaveTypeConfig) {
        if (leaveTypeConfig?.type === 'loss_of_pay') return false;
        return usesMonthlyAccrual(leaveTypeConfig);
    }

    /**
     * @deprecated Legacy pooled types — retained for backward-compatible API paths only.
     * Balances are no longer pooled; each leave type is independent.
     */
    getPooledLeaveTypeConfigs(policy) {
        return (policy?.leaveTypes || []).filter(
            (leaveTypeConfig) =>
                leaveTypeConfig?.enabled !== false &&
                leaveTypeConfig?.type &&
                this.usesStandardMonthlyBalanceRules({
                    ...leaveTypeConfig,
                    carryForward: getEffectiveCarryForwardConfig(leaveTypeConfig),
                })
        );
    }

    /**
     * Manual carry-forward saved before the employee's joining month.
     * Seeds the pooled roll at join month so balance continues after join.
     */
    async resolvePreJoinManualCarrySeed(employeeId, organizationId, joinYear, joinMonthIndex) {
        const joinSortKey = calendarMonthSortKey(joinYear, joinMonthIndex + 1);

        const docs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
            'employeeLeaveSummary.manualOverride.active': true,
        })
            .select('year employeeLeaveSummary')
            .lean();

        let best = null;
        for (const doc of docs) {
            const mo = doc.employeeLeaveSummary?.manualOverride;
            if (!mo?.active) continue;

            const anchorYear = Number(mo.anchorYear ?? doc.year);
            const anchorMonth = Number(mo.anchorMonth ?? 1);
            if (!Number.isInteger(anchorYear) || !Number.isInteger(anchorMonth)) continue;

            const anchorSortKey = calendarMonthSortKey(anchorYear, anchorMonth);
            if (anchorSortKey >= joinSortKey) continue;

            const carriedForward =
                mo.carriedForward != null && !Number.isNaN(Number(mo.carriedForward))
                    ? roundLeaveDays(Number(mo.carriedForward))
                    : 0;
            if (carriedForward <= 0) continue;

            const adjustedAt = mo.adjustedAt ? new Date(mo.adjustedAt).getTime() : 0;
            const seedBalance = manualAvailableFromOverride({
                accrued: mo.accrued,
                used: mo.used,
                carriedForward: mo.carriedForward,
                available: mo.available,
            });

            if (
                !best ||
                anchorSortKey > best.anchorSortKey ||
                (anchorSortKey === best.anchorSortKey && adjustedAt >= best.adjustedAt)
            ) {
                best = { anchorSortKey, carriedForward, seedBalance, adjustedAt };
            }
        }

        return best;
    }

    /**
     * Load manual carry forward entries for an employee
     */
    async getManualCarryForwards(employeeId, organizationId) {
        const docs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
            'employeeLeaveSummary.manualCarryForwards.0': { $exists: true },
        })
            .select('year employeeLeaveSummary')
            .lean();

        const entries = [];
        for (const doc of docs) {
            const mcf = doc.employeeLeaveSummary?.manualCarryForwards || [];
            for (const entry of mcf) {
                entries.push({
                    amount: Number(entry.amount) || 0,
                    effectiveYear: Number(entry.effectiveYear),
                    effectiveMonth: Number(entry.effectiveMonth),
                });
            }
        }
        return entries;
    }

    /**
     * Load manual carry-forward reductions (positive amount = days to subtract)
     */
    async getManualCarryForwardReductions(employeeId, organizationId) {
        const docs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
            'employeeLeaveSummary.manualCarryForwardReductions.0': { $exists: true },
        })
            .select('year employeeLeaveSummary')
            .lean();

        const entries = [];
        for (const doc of docs) {
            const reductions = doc.employeeLeaveSummary?.manualCarryForwardReductions || [];
            for (const entry of reductions) {
                entries.push({
                    amount: Number(entry.amount) || 0,
                    effectiveYear: Number(entry.effectiveYear),
                    effectiveMonth: Number(entry.effectiveMonth),
                });
            }
        }
        return entries;
    }

    /**
     * @deprecated Legacy shared Available Leave pool — use per-type calculateBalance() instead.
     * Monthly rate comes from the active policy (sum of accrual.amount); legacy default only when no policy.
     */
    async computePooledAvailableLeave(
        employee,
        policy,
        organizationId,
        asOfDate = new Date(),
        balanceAnchor = null,
        periodOpeningBalance = null
    ) {
        const joiningDate = getEffectiveJoiningDate(employee);
        const employeeId = employee._id;

        const normalizedOpening =
            periodOpeningBalance?.openingYear != null &&
            periodOpeningBalance?.openingMonth != null
                ? {
                      active: true,
                      openingYear: Number(periodOpeningBalance.openingYear),
                      openingMonth: Number(periodOpeningBalance.openingMonth),
                      balance: periodOpeningBalance.balance,
                  }
                : null;

        const joinYear = joiningDate.getFullYear();
        const joinMonthIndex = joiningDate.getMonth();

        // Active opening balance takes priority — use it regardless of join date
        const effectiveOpening = normalizedOpening;
        const rollStartYear = effectiveOpening
            ? effectiveOpening.openingYear
            : joinYear;
        const rollStartMonthIndex = effectiveOpening
            ? effectiveOpening.openingMonth - 1
            : joinMonthIndex;

        const fromDate = new Date(rollStartYear, rollStartMonthIndex, 1);
        const toDate = this.endOfMonthDate(asOfDate.getFullYear(), asOfDate.getMonth());
        const pooledTypes = this.getPooledLeaveTypeConfigs(policy);

        // Load manual carry forwards for this employee
        const manualCarryForwards = await this.getManualCarryForwards(employeeId, organizationId);
        const manualCarryForwardReductions = await this.getManualCarryForwardReductions(
            employeeId,
            organizationId
        );

        const combinedUsedByMonth = new Map();
        for (const leaveTypeConfig of pooledTypes) {
            const typeUsedMap = await this.buildApprovedLeaveUsedByMonthMap(
                employeeId,
                leaveTypeConfig.type,
                organizationId,
                fromDate,
                toDate
            );
            for (const [key, value] of typeUsedMap.entries()) {
                combinedUsedByMonth.set(
                    key,
                    roundLeaveDays((combinedUsedByMonth.get(key) || 0) + value)
                );
            }
        }

        let preJoinCarriedForward = 0;
        let initialBalance = 0;
        if (effectiveOpening) {
            // When opening balance exists, use it as the initial balance
            initialBalance = effectiveOpening.balance;
        } else {
            const preJoinSeed = await this.resolvePreJoinManualCarrySeed(
                employeeId,
                organizationId,
                joinYear,
                joinMonthIndex
            );
            if (preJoinSeed) {
                preJoinCarriedForward = preJoinSeed.carriedForward;
                initialBalance = preJoinSeed.seedBalance;
            }
        }

        const policyMonthlyRate = sumPolicyMonthlyAccrual(policy || {});
        const monthlyRate = policy && this.hasUsableLeaveTypes(policy) ? policyMonthlyRate : 0;

        const rolledWithUsed = rollLeaveBalanceThroughPeriod({
            joinYear,
            joinMonthIndex,
            endYear: asOfDate.getFullYear(),
            endMonthIndex: asOfDate.getMonth(),
            monthlyRate,
            getUsedForMonth: (year, monthIndex) =>
                combinedUsedByMonth.get(`${year}-${monthIndex}`) || 0,
            balanceAnchor,
            periodOpeningBalance: effectiveOpening,
            initialBalance,
            manualCarryForwards,
            manualCarryForwardReductions,
        });

        rolledWithUsed.preJoinCarriedForward = preJoinCarriedForward;

        logger.info('[OpeningLeaveBalance] computePooledAvailableLeave', {
            employeeId: String(employeeId),
            organizationId: organizationId ? String(organizationId) : null,
            openingLeaveBalance: normalizedOpening,
            accrualStartYear: rolledWithUsed.calculationStartYear,
            accrualStartMonth: rolledWithUsed.calculationStartMonth,
            loopStartYear: rolledWithUsed.loopStartYear,
            loopStartMonth: rolledWithUsed.loopStartMonth,
            openingYear: rolledWithUsed.openingYear,
            openingMonth: rolledWithUsed.openingMonth,
            firstProcessedMonth: rolledWithUsed.firstProcessedMonth,
            firstClosingBalance: rolledWithUsed.firstClosingBalance,
            lastProcessedMonth: rolledWithUsed.lastProcessedMonth,
            finalAvailableBalance: rolledWithUsed.available,
            employeeJoiningDate: joiningDate.toISOString(),
        });

        return rolledWithUsed;
    }

    chooseCanonicalOpening(candidates) {
        return pickCanonicalOpening(candidates);
    }

    /**
     * Pick the active persisted opening — latest calendar month wins (not earliest/stale month).
     */
    pickCanonicalPersistedOpening(candidates) {
        if (!candidates.length) {
            return null;
        }

        return candidates.reduce((best, candidate) => {
            if (!best) {
                return candidate;
            }
            if (candidate.sortKey > best.sortKey) {
                return candidate;
            }
            if (candidate.sortKey < best.sortKey) {
                return best;
            }
            const candidateSetAt = candidate.setAt ?? 0;
            const bestSetAt = best.setAt ?? 0;
            return candidateSetAt >= bestSetAt ? candidate : best;
        }, null);
    }

    /**
     * Active persisted openingLeaveBalance only (no legacy manualOverride fallback).
     */
    async resolvePersistedOpeningLeaveBalance(employeeId, organizationId) {
        const docs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
            'employeeLeaveSummary.openingLeaveBalance.active': true,
        })
            .select('_id year organizationId employeeLeaveSummary')
            .lean();

        const persistedCandidates = [];
        for (const doc of docs) {
            const opening = doc.employeeLeaveSummary?.openingLeaveBalance;
            if (!opening?.active) continue;

            const balance =
                opening.balance != null && !Number.isNaN(Number(opening.balance))
                    ? roundLeaveDays(Number(opening.balance))
                    : null;
            if (balance == null) continue;

            const openingYear = Number(opening.openingYear ?? doc.year);
            const openingMonth = Number(opening.openingMonth);
            if (
                !Number.isInteger(openingYear) ||
                !Number.isInteger(openingMonth) ||
                openingMonth < 1 ||
                openingMonth > 12
            ) {
                continue;
            }

            persistedCandidates.push({
                active: true,
                balance,
                openingYear,
                openingMonth,
                documentId: doc._id,
                source: 'openingLeaveBalance',
                sortKey: calendarMonthSortKey(openingYear, openingMonth),
                setAt: opening.setAt ? new Date(opening.setAt).getTime() : 0,
            });
        }

        const bestPersisted = this.pickCanonicalPersistedOpening(persistedCandidates);
        if (!bestPersisted) {
            logger.info('[OpeningLeaveBalance] resolvePersistedOpeningLeaveBalance', {
                employeeId: String(employeeId),
                organizationId: organizationId ? String(organizationId) : null,
                openingLeaveBalance: null,
                activeCandidates: persistedCandidates.length,
            });
            return null;
        }

        const { sortKey, setAt, ...resolved } = bestPersisted;

        logger.info('[OpeningLeaveBalance] resolvePersistedOpeningLeaveBalance', {
            employeeId: String(employeeId),
            organizationId: organizationId ? String(organizationId) : null,
            openingLeaveBalance: {
                openingYear: resolved.openingYear,
                openingMonth: resolved.openingMonth,
                balance: resolved.balance,
            },
            activeCandidates: persistedCandidates.length,
        });

        return resolved;
    }

    /**
     * Imported opening balance snap — latest HR save wins.
     * Accrual runs forward from openingYear/openingMonth only (no historical replay).
     */
    async resolveEmployeeOpeningBalance(employeeId, organizationId) {
        const bestPersisted = await this.resolvePersistedOpeningLeaveBalance(
            employeeId,
            organizationId
        );

        if (bestPersisted) {
            return bestPersisted;
        }

        const legacyDocs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
        })
            .select('_id year employeeLeaveSummary')
            .lean();

        const legacyCandidates = [];
        for (const doc of legacyDocs) {
            const mo = doc.employeeLeaveSummary?.manualOverride;
            if (mo?.available == null || Number.isNaN(Number(mo.available))) continue;

            const openingYear = Number(mo.anchorYear ?? doc.year);
            const openingMonth = Number(mo.anchorMonth ?? 1);
            if (!Number.isInteger(openingYear) || !Number.isInteger(openingMonth)) continue;

            legacyCandidates.push({
                active: true,
                balance: roundLeaveDays(Number(mo.available)),
                openingYear,
                openingMonth,
                documentId: doc._id,
                sortKey: calendarMonthSortKey(openingYear, openingMonth),
                setAt: mo.adjustedAt ? new Date(mo.adjustedAt).getTime() : 0,
                source: 'legacyManualOverride',
            });
        }

        const legacyChoice = this.chooseCanonicalOpening(legacyCandidates);

        if (!legacyChoice) {
            return null;
        }

        const { sortKey, setAt, ...opening } = legacyChoice;
        return opening;
    }

    /**
     * Latest manualOverride anchor strictly after the persisted opening month.
     */
    async resolveEmployeeBalanceAnchor(employeeId, organizationId, periodOpeningBalance = null) {
        const opening =
            periodOpeningBalance ??
            (await this.resolvePersistedOpeningLeaveBalance(employeeId, organizationId));
        const openingSortKey =
            opening?.active && opening.openingYear != null && opening.openingMonth != null
                ? calendarMonthSortKey(opening.openingYear, opening.openingMonth)
                : null;

        const docs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
            'employeeLeaveSummary.manualOverride.active': true,
        })
            .select('_id year organizationId employeeLeaveSummary')
            .lean();

        let chosen = null;
        for (const doc of docs) {
            const mo = doc.employeeLeaveSummary?.manualOverride;
            if (!mo?.active) continue;

            const anchorBalance =
                mo.available != null && !Number.isNaN(Number(mo.available))
                    ? roundLeaveDays(Number(mo.available))
                    : null;
            if (anchorBalance == null) continue;

            const anchorYear = Number(mo.anchorYear ?? doc.year);
            const anchorMonth = Number(mo.anchorMonth ?? 1);
            if (!Number.isInteger(anchorYear) || !Number.isInteger(anchorMonth)) continue;

            const anchorSortKey = anchorYear * 12 + (anchorMonth - 1);
            if (openingSortKey != null && anchorSortKey <= openingSortKey) {
                continue;
            }

            const adjustedAt = mo.adjustedAt ? new Date(mo.adjustedAt).getTime() : 0;
            if (
                !chosen ||
                anchorSortKey > chosen.anchorSortKey ||
                (anchorSortKey === chosen.anchorSortKey && adjustedAt >= chosen.adjustedAt)
            ) {
                chosen = { anchorYear, anchorMonth, anchorBalance, adjustedAt, anchorSortKey };
            }
        }

        const anchor = chosen
            ? {
                  anchorYear: chosen.anchorYear,
                  anchorMonth: chosen.anchorMonth,
                  anchorBalance: chosen.anchorBalance,
              }
            : null;

        return anchor;
    }

    /**
     * @deprecated Manual anchors are applied inside rollLeaveBalanceThroughPeriod.
     */
    applyEmployeeLeaveSummaryOverride(balance, pooledAvailable, policy) {
        const override = balance?.employeeLeaveSummary?.manualOverride;
        if (!override?.active) {
            return pooledAvailable;
        }

        const pooledTypeSet = new Set(this.getPooledLeaveTypeConfigs(policy).map((lt) => lt.type));
        const totalPooledUsed = (balance.balances || [])
            .filter((row) => pooledTypeSet.has(row.leaveType))
            .reduce((sum, row) => sum + (Number(row.used) || 0), 0);

        const next = { ...pooledAvailable };
        const manualUsed =
            override.used != null && !Number.isNaN(Number(override.used))
                ? Number(override.used)
                : totalPooledUsed;
        const manualAccrued =
            override.accrued != null && !Number.isNaN(Number(override.accrued))
                ? Number(override.accrued)
                : next.lifetimeEarned ?? next.totalEarned ?? 0;
        const manualCarried =
            override.carriedForward != null && !Number.isNaN(Number(override.carriedForward))
                ? Number(override.carriedForward)
                : next.yearOpeningBalance ?? 0;

        if (override.available != null && !Number.isNaN(Number(override.available))) {
            next.available = roundLeaveDays(Number(override.available));
        } else {
            next.available = Math.max(
                0,
                roundLeaveDays(manualAccrued + manualCarried - manualUsed)
            );
        }

        next.lifetimeEarned = roundLeaveDays(manualAccrued);
        next.lifetimeUsed = roundLeaveDays(manualUsed);
        next.yearOpeningBalance = roundLeaveDays(manualCarried);
        return next;
    }

    /** Approved leave days keyed by `${year}-${monthIndex}` for balance deduction. */
    async buildApprovedLeaveUsedByMonthMap(employeeId, leaveType, organizationId, fromDate, toDate) {
        const types = getLeaveTypeVariantsForBalance(leaveType);
        const leaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            status: 'approved',
            startDate: { $gte: fromDate, $lte: toDate },
        })
            .select('startDate duration')
            .lean();

        const map = new Map();
        for (const leave of leaves) {
            const d = new Date(leave.startDate);
            const key = `${d.getFullYear()}-${d.getMonth()}`;
            map.set(key, roundLeaveDays((map.get(key) || 0) + (leave.duration || 0)));
        }
        return map;
    }

    /** @deprecated Use buildApprovedLeaveUsedByMonthMap */
    async buildUsedByMonthMap(employeeId, leaveType, organizationId, fromDate, toDate) {
        return this.buildApprovedLeaveUsedByMonthMap(
            employeeId,
            leaveType,
            organizationId,
            fromDate,
            toDate
        );
    }

    /**
     * Rolling balance from employee join month through asOfDate (never resets at year-end).
     * Current Month Balance = Previous Month Balance + monthlyRate − Leave Used (this month)
     * When periodOpeningBalance is provided, calculation starts from openingYear/openingMonth instead.
     * When resolveLeaveTypeConfigForMonth is set, each month uses that policy window’s rate/cap (mid-year split).
     */
    async computeRollingMonthlyBalance(
        leaveTypeConfig,
        employee,
        organizationId,
        asOfDate,
        periodOpeningBalance = null,
        viewYear = null,
        rateSchedule = null,
        resolveLeaveTypeConfigForMonth = null
    ) {
        const leaveType = leaveTypeConfig.type;
        const policyMonthlyRate = getRollingAccrualMonthlyRate(leaveTypeConfig);
        const policyAnnualCap = getAnnualEntitlementAmount(leaveTypeConfig);
        const monthlyRate = policyMonthlyRate;
        const defaultAnnualCap =
            rateSchedule?.annualCap != null && !Number.isNaN(Number(rateSchedule.annualCap))
                ? Math.max(0, Number(rateSchedule.annualCap))
                : policyAnnualCap;
        const joiningDate = getEffectiveJoiningDate(employee);
        const employeeId = employee._id;

        let fromDate;
        if (periodOpeningBalance?.openingYear != null && periodOpeningBalance?.openingMonth != null) {
            fromDate = new Date(periodOpeningBalance.openingYear, periodOpeningBalance.openingMonth - 1, 1);
        } else {
            fromDate = new Date(joiningDate.getFullYear(), joiningDate.getMonth(), 1);
        }
        const toDate = this.endOfMonthDate(asOfDate.getFullYear(), asOfDate.getMonth());
        const usedByMonth = await this.buildApprovedLeaveUsedByMonthMap(
            employeeId,
            leaveType,
            organizationId,
            fromDate,
            toDate
        );

        // Cap earned per calendar-year + policy window so mid-year switches don't claw back prior credits.
        const yearPolicyEarnedTracker = new Map();

        const configForMonth = (year, monthIndex) => {
            if (typeof resolveLeaveTypeConfigForMonth === 'function') {
                const resolved = resolveLeaveTypeConfigForMonth(year, monthIndex);
                if (resolved) return resolved;
            }
            return leaveTypeConfig;
        };

        const resolveMonthRate = (year, monthIndex) => {
            if (
                rateSchedule &&
                Number(rateSchedule.anchorYear) === Number(year) &&
                monthIndex > Number(rateSchedule.anchorMonth) - 1
            ) {
                const monthsAfterAnchor = monthIndex - (Number(rateSchedule.anchorMonth) - 1);
                const funded =
                    rateSchedule.fundedFutureMonths != null
                        ? Number(rateSchedule.fundedFutureMonths)
                        : null;
                // Funded window: policy monthly chunks; months after that get 0
                if (funded != null) {
                    if (monthsAfterAnchor >= 1 && monthsAfterAnchor <= funded) {
                        return Math.max(0, Number(rateSchedule.afterRate) || 0);
                    }
                    return 0;
                }
                if (rateSchedule.afterRate != null && !Number.isNaN(Number(rateSchedule.afterRate))) {
                    return Math.max(0, Number(rateSchedule.afterRate));
                }
            }
            if (
                rateSchedule?.beforeRate != null &&
                !Number.isNaN(Number(rateSchedule.beforeRate))
            ) {
                return Math.max(0, Number(rateSchedule.beforeRate));
            }
            const cfg = configForMonth(year, monthIndex);
            if (!cfg) return 0;
            return getRollingAccrualMonthlyRate(cfg);
        };

        const creditWithAnnualCap = (year, monthIndex) => {
            const cfg = configForMonth(year, monthIndex);
            if (!cfg) return 0;
            const rate = resolveMonthRate(year, monthIndex);
            if (rate <= 0) return 0;

            const annualCap =
                rateSchedule?.annualCap != null && !Number.isNaN(Number(rateSchedule.annualCap))
                    ? Math.max(0, Number(rateSchedule.annualCap))
                    : getAnnualEntitlementAmount(cfg) || defaultAnnualCap;

            const policyKey = String(cfg._sourcePolicyId || 'default');
            const trackerKey = `${year}:${policyKey}`;
            const earnedSoFar = yearPolicyEarnedTracker.get(trackerKey) || 0;
            if (annualCap > 0 && earnedSoFar >= annualCap) {
                return 0;
            }
            let credit = roundLeaveDays(rate);
            if (annualCap > 0) {
                credit = Math.min(credit, roundLeaveDays(annualCap - earnedSoFar));
            }
            if (credit > 0) {
                yearPolicyEarnedTracker.set(trackerKey, roundLeaveDays(earnedSoFar + credit));
            }
            return credit;
        };

        return rollLeaveBalanceThroughPeriod({
            joinYear: joiningDate.getFullYear(),
            joinMonthIndex: joiningDate.getMonth(),
            endYear: asOfDate.getFullYear(),
            endMonthIndex: asOfDate.getMonth(),
            monthlyRate,
            getUsedForMonth: (year, monthIndex) =>
                usedByMonth.get(`${year}-${monthIndex}`) || 0,
            shouldCreditMonth: (year, monthIndex) => creditWithAnnualCap(year, monthIndex),
            periodOpeningBalance,
        });
    }

    async computeStandardMonthlyBalance(
        leaveTypeConfig,
        employee,
        year,
        organizationId,
        asOfDate
    ) {
        return this.computeRollingMonthlyBalance(
            leaveTypeConfig,
            employee,
            organizationId,
            asOfDate
        );
    }

    /**
     * Monthly earned for a single calendar month (full monthly rate once employed in that month).
     */
    calculateSingleMonthEarned(monthlyAmount, employee, year, monthIndex, joiningDate) {
        const join = joiningDate || getEffectiveJoiningDate(employee);
        if (join.getFullYear() > year || (join.getFullYear() === year && join.getMonth() > monthIndex)) {
            return 0;
        }
        return monthlyAmount;
    }

    /**
     * Sum monthly earnings from year start (or joining) through asOfDate month.
     */
    calculateAccruedThroughDate(leaveTypeConfig, employee, year, asOfDate = new Date()) {
        const monthlyAmount = getRollingAccrualMonthlyRate(leaveTypeConfig);
        const annualCap = getAnnualEntitlementAmount(leaveTypeConfig);
        const joiningDate = getEffectiveJoiningDate(employee);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);

        if (asOfDate < yearStart) return 0;

        const endDate = asOfDate > yearEnd ? yearEnd : asOfDate;
        const startMonth = joiningDate.getFullYear() === year ? joiningDate.getMonth() : 0;
        const endMonth = endDate.getMonth();

        let total = 0;
        for (let m = startMonth; m <= endMonth; m += 1) {
            const earned = this.calculateSingleMonthEarned(monthlyAmount, employee, year, m, joiningDate);
            if (annualCap > 0 && total + earned > annualCap) {
                total = annualCap;
                break;
            }
            total += earned;
        }
        return roundLeaveDays(total);
    }

    /**
     * Calculate accrued balance — monthly allocation for configured policies; legacy methods unchanged.
     * When resolveLeaveTypeConfigForMonth is provided, monthly path uses mid-year policy windows.
     */
    async calculateAccruedBalance(
        leaveTypeConfig,
        employee,
        year,
        organizationId,
        asOfDate = new Date(),
        resolveLeaveTypeConfigForMonth = null
    ) {
        const accrual = leaveTypeConfig.accrual || {};
        const entitlementAmount = getAnnualEntitlementAmount(leaveTypeConfig);
        const joiningDate = getEffectiveJoiningDate(employee);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);

        if (leaveTypeConfig.type === 'loss_of_pay') {
            return 0;
        }

        if (accrual.method === 'on_anniversary') {
            const anniversaryDate = new Date(year, joiningDate.getMonth(), joiningDate.getDate());
            if (asOfDate >= anniversaryDate && anniversaryDate >= yearStart) {
                return entitlementAmount;
            }
            return 0;
        }

        // Yearly lump sum: full Amount once the employee is employed in the leave year.
        // Mid-year policy change: use the policy effective on asOfDate (leaveTypeConfig already as-of).
        if (accrual.method === 'yearly') {
            if (entitlementAmount <= 0) return 0;
            if (asOfDate < yearStart || joiningDate > yearEnd) return 0;
            if (joiningDate > asOfDate) return 0;
            return entitlementAmount;
        }

        if (accrual.method === 'proportional') {
            const totalMonths = this.calculateMonthsWorked(
                joiningDate,
                year,
                asOfDate < yearEnd ? asOfDate : yearEnd
            );
            const proportionalAmount = (totalMonths / 12) * entitlementAmount;
            return Math.min(proportionalAmount, accrual.maxAccrual || entitlementAmount);
        }

        // Monthly accrual — prefer period-split when resolver is available
        if (typeof resolveLeaveTypeConfigForMonth === 'function') {
            const startMonth = joiningDate.getFullYear() === year ? joiningDate.getMonth() : 0;
            const endMonth =
                asOfDate.getFullYear() === year
                    ? asOfDate.getMonth()
                    : asOfDate.getFullYear() > year
                      ? 11
                      : -1;
            if (endMonth < startMonth) return 0;

            let total = 0;
            const earnedByPolicy = new Map();
            for (let m = startMonth; m <= endMonth; m += 1) {
                const cfg = resolveLeaveTypeConfigForMonth(year, m) || leaveTypeConfig;
                if (!cfg) continue;
                const rate = getRollingAccrualMonthlyRate(cfg);
                const cap = getAnnualEntitlementAmount(cfg);
                const policyKey = String(cfg._sourcePolicyId || 'default');
                const soFar = earnedByPolicy.get(policyKey) || 0;
                let credit = this.calculateSingleMonthEarned(rate, employee, year, m, joiningDate);
                if (cap > 0 && soFar + credit > cap) {
                    credit = Math.max(0, roundLeaveDays(cap - soFar));
                }
                if (credit > 0) {
                    earnedByPolicy.set(policyKey, roundLeaveDays(soFar + credit));
                    total = roundLeaveDays(total + credit);
                }
            }
            return total;
        }

        return this.calculateAccruedThroughDate(leaveTypeConfig, employee, year, asOfDate);
    }

    /**
     * Calculate used balance (approved leaves). Uses variants so 'paid' includes 'annual' leaves.
     */
    async calculateUsedBalance(employeeId, leaveType, year, organizationId, asOfDate = new Date()) {
        const types = getLeaveTypeVariantsForBalance(leaveType);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);
        const cutoff = asOfDate < yearEnd ? asOfDate : yearEnd;
        const leaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            $or: [{ year }, { startDate: { $gte: yearStart, $lte: cutoff } }],
            status: 'approved',
            startDate: { $lte: cutoff },
        });

        return leaves.reduce((total, leave) => total + (leave.duration || 0), 0);
    }

    /**
     * Calculate pending balance. Uses variants so 'paid' includes 'annual' leaves.
     */
    async calculatePendingBalance(employeeId, leaveType, year, organizationId, asOfDate = new Date()) {
        const types = getLeaveTypeVariantsForBalance(leaveType);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);
        const cutoff = asOfDate < yearEnd ? asOfDate : yearEnd;
        const leaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            $or: [{ year }, { startDate: { $gte: yearStart, $lte: cutoff } }],
            status: 'pending',
            startDate: { $lte: cutoff },
        });

        return leaves.reduce((total, leave) => total + (leave.duration || 0), 0);
    }

    /** Used leave days in a specific calendar month */
    async calculateUsedInMonth(employeeId, leaveType, year, monthIndex, organizationId) {
        const types = getLeaveTypeVariantsForBalance(leaveType);
        const monthStart = new Date(year, monthIndex, 1);
        const monthEnd = new Date(year, monthIndex + 1, 0, 23, 59, 59);
        const leaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            status: 'approved',
            startDate: { $gte: monthStart, $lte: monthEnd },
        });
        return leaves.reduce((total, leave) => total + (leave.duration || 0), 0);
    }

    endOfMonthDate(year, monthIndex) {
        return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
    }

    /**
     * Month-by-month ledger: each month credits monthly rate; unused balance rolls forward.
     */
    async buildMonthlyAccrualLedger(
        leaveTypeConfig,
        employee,
        year,
        organizationId,
        asOfDate
    ) {
        const effectiveConfig = {
            ...leaveTypeConfig,
            carryForward: getEffectiveCarryForwardConfig(leaveTypeConfig),
        };
        const result = await this.computeRollingMonthlyBalance(
            effectiveConfig,
            employee,
            organizationId,
            asOfDate
        );
        return result.ledger || [];
    }

    /**
     * Closing available balance at 31 Dec for a calendar year (includes opening carry from prior years).
     */
    async getYearEndAvailableBalance(employeeId, leaveType, year, organizationId, cache = new Map()) {
        const cacheKey = `${leaveType}:${year}`;
        if (cache.has(cacheKey)) {
            return cache.get(cacheKey);
        }

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            cache.set(cacheKey, 0);
            return 0;
        }

        const asOfDec31 = new Date(year, 11, 31, 23, 59, 59, 999);
        const policy = await this.getApplicablePolicy(employee, organizationId, year, asOfDec31);
        const leaveTypeConfig = policy?.leaveTypes?.find((lt) => lt.type === leaveType);
        if (!leaveTypeConfig) {
            cache.set(cacheKey, 0);
            return 0;
        }

        const effectiveConfig = {
            ...leaveTypeConfig,
            carryForward: getEffectiveCarryForwardConfig(leaveTypeConfig),
        };

        const policies = await this.loadOrganizationLeavePolicies(organizationId);
        const resolveLeaveTypeConfigForMonth = this.buildLeaveTypeConfigResolver(
            policies,
            employee,
            effectiveConfig
        );

        if (this.usesStandardMonthlyBalanceRules(effectiveConfig)) {
            const periodOpeningBalance = await this.resolvePersistedOpeningLeaveBalance(
                employeeId,
                organizationId
            );
            const computed = await this.computeRollingMonthlyBalance(
                effectiveConfig,
                employee,
                organizationId,
                asOfDec31,
                periodOpeningBalance,
                year,
                null,
                resolveLeaveTypeConfigForMonth
            );
            const closing = Math.max(0, roundLeaveDays(computed.available ?? 0));
            cache.set(cacheKey, closing);
            return closing;
        }

        const computed = await this.computeRollingMonthlyBalance(
            effectiveConfig,
            employee,
            organizationId,
            asOfDec31,
            null,
            year,
            null,
            resolveLeaveTypeConfigForMonth
        );

        const closing = Math.max(0, roundLeaveDays(computed.available ?? computed.yearEndBalance ?? 0));
        cache.set(cacheKey, closing);
        return closing;
    }

    /**
     * Amount of unused leave to open the next calendar year with.
     */
    async calculateCarryForward(employeeId, leaveType, previousYear, carryForwardConfig, organizationId, cache = new Map()) {
        if (!carryForwardConfig?.enabled) {
            return 0;
        }

        const closingAvailable = await this.getYearEndAvailableBalance(
            employeeId,
            leaveType,
            previousYear,
            organizationId,
            cache
        );
        if (closingAvailable <= 0) {
            return 0;
        }

        if (carryForwardConfig.maxDays == null || carryForwardConfig.maxDays <= 0) {
            return closingAvailable;
        }

        return Math.min(closingAvailable, Number(carryForwardConfig.maxDays));
    }

    /**
     * Calculate expired balance
     */
    async calculateExpiredBalance(employeeId, leaveType, year, carryForwardConfig, organizationId) {
        // Implementation for expired balance calculation
        // This would check if carried forward balance has expired based on expiryDays
        return 0; // Simplified for now
    }

    /**
     * Get applicable policy for employee on asOfDate (effectiveDate/expiryDate window).
     * @param {number} [year] - used to default asOf when asOfDate omitted (past year → Dec 31)
     * @param {Date} [asOfDate] - explicit as-of (e.g. leave start date or month end)
     */
    async getApplicablePolicy(employee, organizationId, year, asOfDate = null) {
        const policies = await this.loadOrganizationLeavePolicies(organizationId);
        const resolvedAsOf = this.resolvePolicyAsOfDate(year, asOfDate);
        const selected = selectApplicableLeavePolicy(policies, employee, resolvedAsOf, {
            requireUsable: true,
            hasUsableLeaveTypes: (p) => this.hasUsableLeaveTypes(p),
        });

        if (!selected) {
            return null;
        }

        if (!this.hasUsableLeaveTypes(selected)) {
            logger.warn('Skipping applicable policy with empty/zero leave types', {
                employeeId: employee._id,
                policyId: selected._id,
                policyName: selected.policyName,
                applicableTo: selected.applicableTo,
                asOfDate: resolvedAsOf,
            });
            return null;
        }

        return selected;
    }

    /**
     * Check if policy is applicable to employee (department / assignedRole / employee list).
     */
    isPolicyApplicable(policy, employee) {
        return isLeavePolicyApplicableToEmployee(policy, employee);
    }

    /**
     * Calculate months worked
     */
    calculateMonthsWorked(joiningDate, year, endDate) {
        const yearStart = new Date(year, 0, 1);
        const start = joiningDate > yearStart ? joiningDate : yearStart;
        const end = endDate < new Date(year, 11, 31) ? endDate : new Date(year, 11, 31);
        
        const months = (end.getFullYear() - start.getFullYear()) * 12 + 
                      (end.getMonth() - start.getMonth());
        return Math.max(0, months + 1); // +1 to include current month
    }

    /**
     * Recalculate balances for all employees in an organization for a year
     */
    async recalculateBalances(organizationId, year) {
        try {
            const employees = await Employee.find({ organizationId, status: 'active' });
            let processed = 0;
            let errors = 0;

            for (const employee of employees) {
                try {
                    await this.calculateBalance(employee._id, year, organizationId);
                    processed++;
                } catch (error) {
                    logger.error('Error recalculating balance for employee', {
                        employeeId: employee._id,
                        error: error.message
                    });
                    errors++;
                }
            }

            logger.info('Balance recalculation completed', {
                organizationId,
                year,
                processed,
                errors
            });

            return { processed, errors };
        } catch (error) {
            logger.error('Error in recalculateBalances', {
                error: error.message,
                organizationId,
                year
            });
            throw error;
        }
    }

    /**
     * Process carry-forward for all employees at year end
     */
    async processYearEndCarryForward(organizationId, fromYear, toYear) {
        try {
            const employees = await Employee.find({ organizationId, status: 'active' }).select('_id');
            const asOfDec31 = new Date(fromYear, 11, 31, 23, 59, 59, 999);

            for (const employee of employees) {
                try {
                    await this.calculateBalance(employee._id, fromYear, organizationId, {
                        asOfDate: asOfDec31,
                    });
                    await this.calculateBalance(employee._id, toYear, organizationId);
                } catch (error) {
                    logger.error('Error refreshing balance after year-end rollover', {
                        employeeId: employee._id,
                        error: error.message,
                    });
                }
            }

            logger.info('Year-end balance rollover processed (no reset)', {
                organizationId,
                fromYear,
                toYear,
            });
        } catch (error) {
            logger.error('Error processing year-end carry-forward', {
                error: error.message,
                organizationId,
                fromYear,
                toYear,
            });
            throw error;
        }
    }
}

export default new LeaveBalanceEngine();

