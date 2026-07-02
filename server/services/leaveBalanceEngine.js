import LeaveBalance from '../models/leaveBalance.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import Leave from '../models/leave.model.js';
import Employee from '../models/employee.model.js';
import logger from '../helpers/logger.js';
import { getLeaveTypeVariantsForBalance } from '../helpers/leaveTypeHelper.js';
import {
    getMonthlyEntitlementAmount,
    getRollingAccrualMonthlyRate,
    getYearlyAccrualCap,
    usesMonthlyAllocation,
    normalizePolicyLeaveTypes,
} from '../helpers/leavePolicyAccrualHelper.js';
import {
    getEffectiveEntitlementAmount,
    getEffectiveCarryForwardConfig,
    DEFAULT_MONTHLY_LEAVE_DAYS,
} from '../constants/leaveDefaults.js';
import {
    getEffectiveJoiningDate,
    rollLeaveBalanceThroughPeriod,
    roundLeaveDays,
} from '../helpers/leaveBalanceRulesHelper.js';

class LeaveBalanceEngine {
    /**
     * A policy is considered usable only when it has at least
     * one leave type configured with a positive accrual amount.
     */
    hasUsableLeaveTypes(policy) {
        const leaveTypes = policy?.leaveTypes || [];
        return leaveTypes.some((lt) => getEffectiveEntitlementAmount(lt) > 0);
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
     * Calculate and update leave balance for an employee for a given year
     * @param {Date} [options.asOfDate] - Calculate balances as of this date (end of month for views)
     * @param {boolean} [options.clearManualOverride] - Clear per-leave-type manual overrides during automated recalc (employee wallet anchor is never cleared here)
     */
    async calculateBalance(employeeId, year, organizationId, options = {}) {
        const { asOfDate = new Date(), clearManualOverride = false } = options;
        try {
            // Get employee details
            const employee = await Employee.findById(employeeId);
            if (!employee) {
                throw new Error('Employee not found');
            }

            // Get applicable policy for employee
            const policy = await this.getApplicablePolicy(employee, organizationId, year);
            if (!policy) {
                logger.warn('No leave policy found for employee', { employeeId, year });
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
                organizationId,
                employeeId,
                year,
                policy._id
            );

            let pooledAvailable = await this.computePooledAvailableLeave(
                employee,
                policy,
                organizationId,
                asOfDate,
                await this.resolveEmployeeBalanceAnchor(employeeId, organizationId)
            );

            // Calculate balances for each enabled leave type
            for (const leaveTypeConfig of policy.leaveTypes) {
                if (leaveTypeConfig.enabled === false || !leaveTypeConfig.type) {
                    continue;
                }
                await this.calculateLeaveTypeBalance(
                    balance,
                    leaveTypeConfig,
                    employee,
                    year,
                    organizationId,
                    { asOfDate, clearManualOverride, pooledAvailable }
                );
            }

            const pooledTypeSet = new Set(
                this.getPooledLeaveTypeConfigs(policy).map((lt) => lt.type)
            );
            const totalPendingPooled = balance.balances
                .filter((row) => pooledTypeSet.has(row.leaveType))
                .reduce((sum, row) => sum + (Number(row.pending) || 0), 0);
            const sharedAvailable = Math.max(
                0,
                roundLeaveDays(pooledAvailable.available) - totalPendingPooled
            );
            for (const typeBalance of balance.balances) {
                if (!pooledTypeSet.has(typeBalance.leaveType)) {
                    continue;
                }
                typeBalance.available = sharedAvailable;
            }

            balance.lastAccrualDate = new Date();
            balance.$locals = balance.$locals || {};
            balance.$locals.pooledAvailable = pooledAvailable;
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
        const { asOfDate = new Date(), clearManualOverride = false, pooledAvailable = null } = options;
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
                pending: 0
            };
            balance.balances.push(typeBalance);
        }

        if (clearManualOverride && typeBalance.manualOverride?.active) {
            typeBalance.manualOverride = { active: false };
        }

        const carryForwardConfig = effectiveConfig.carryForward;
        const manualCarryLocked =
            typeBalance.manualOverride?.active &&
            typeBalance.manualOverride?.carriedForward != null &&
            !Number.isNaN(Number(typeBalance.manualOverride.carriedForward));

        let rollingAvailable = null;

        if (this.usesStandardMonthlyBalanceRules(effectiveConfig)) {
            if (pooledAvailable) {
                typeBalance.used = await this.calculateUsedBalance(
                    employee._id,
                    leaveType,
                    year,
                    organizationId,
                    asOfDate
                );
                typeBalance.accrued = 0;
                if (!manualCarryLocked) {
                    // Pooled wallet lives in `available` only — not on any leave type's carried forward.
                    typeBalance.carriedForward = 0;
                }
                rollingAvailable = pooledAvailable.available;
            } else {
                const computed = await this.computeRollingMonthlyBalance(
                    effectiveConfig,
                    employee,
                    organizationId,
                    asOfDate
                );
                typeBalance.accrued = computed.totalEarned;
                typeBalance.used = computed.totalUsed;
                if (!manualCarryLocked) {
                    typeBalance.carriedForward = computed.yearOpeningBalance;
                }
                rollingAvailable = computed.available;
            }
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
                asOfDate
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

        // Preserve manual corrections from admin / HR / manager
        if (typeBalance.manualOverride?.active) {
            const mo = typeBalance.manualOverride;
            const employeeWalletOverride = balance.employeeLeaveSummary?.manualOverride?.active;
            if (pooledAvailable && employeeWalletOverride) {
                // Employee wallet override owns the shared balance.
            } else if (pooledAvailable) {
                if (mo.used != null && !Number.isNaN(Number(mo.used))) {
                    typeBalance.used = Number(mo.used);
                }
            } else {
                if (mo.accrued != null && !Number.isNaN(Number(mo.accrued))) {
                    typeBalance.accrued = Number(mo.accrued);
                }
                if (mo.used != null && !Number.isNaN(Number(mo.used))) {
                    typeBalance.used = Number(mo.used);
                }
                if (mo.carriedForward != null && !Number.isNaN(Number(mo.carriedForward))) {
                    typeBalance.carriedForward = Number(mo.carriedForward);
                }
            }
        }

        // Available follows rolling month-by-month balance (pending/expired reduce usable amount)
        if (rollingAvailable != null) {
            if (pooledAvailable) {
                // Shared Available Leave pool is finalized in calculateBalance after all pending is known.
                typeBalance.available = Math.max(
                    0,
                    roundLeaveDays(rollingAvailable) - (typeBalance.expired || 0)
                );
            } else {
                typeBalance.available = Math.max(
                    0,
                    roundLeaveDays(rollingAvailable) -
                        (typeBalance.pending || 0) -
                        (typeBalance.expired || 0)
                );
            }
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
        if (usesMonthlyAllocation(leaveTypeConfig) || getMonthlyEntitlementAmount(leaveTypeConfig) != null) {
            return true;
        }
        const method = leaveTypeConfig?.accrual?.method;
        return method !== 'on_anniversary' && method !== 'proportional';
    }

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
     * Shared Available Leave pool — one 1.5/month accrual, all approved leave types deduct from it.
     * Current Balance = Previous Balance + 1.5 − Approved Leave Used (any pooled type)
     */
    async computePooledAvailableLeave(
        employee,
        policy,
        organizationId,
        asOfDate = new Date(),
        balanceAnchor = null
    ) {
        const joiningDate = getEffectiveJoiningDate(employee);
        const employeeId = employee._id;
        const fromDate = new Date(joiningDate.getFullYear(), joiningDate.getMonth(), 1);
        const toDate = this.endOfMonthDate(asOfDate.getFullYear(), asOfDate.getMonth());
        const pooledTypes = this.getPooledLeaveTypeConfigs(policy);

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

        return rollLeaveBalanceThroughPeriod({
            joinYear: joiningDate.getFullYear(),
            joinMonthIndex: joiningDate.getMonth(),
            endYear: asOfDate.getFullYear(),
            endMonthIndex: asOfDate.getMonth(),
            monthlyRate: DEFAULT_MONTHLY_LEAVE_DAYS,
            getUsedForMonth: (year, monthIndex) =>
                combinedUsedByMonth.get(`${year}-${monthIndex}`) || 0,
            balanceAnchor,
        });
    }

    /**
     * Active manual balance anchor — rolling accrual continues from this month/year forward.
     */
    async resolveEmployeeBalanceAnchor(employeeId, organizationId) {
        const docs = await LeaveBalance.find({
            organizationId,
            employee: employeeId,
            'employeeLeaveSummary.manualOverride.active': true,
        })
            .select('_id year organizationId employeeLeaveSummary')
            .lean();

        logger.info('resolveEmployeeBalanceAnchor query', {
            employeeId: String(employeeId),
            organizationId: organizationId ? String(organizationId) : null,
            matchedDocuments: docs.map((doc) => ({
                documentId: String(doc._id),
                year: doc.year,
                organizationId: doc.organizationId ? String(doc.organizationId) : null,
            })),
        });

        let chosen = null;
        let chosenDocumentId = null;
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

            const adjustedAt = mo.adjustedAt ? new Date(mo.adjustedAt).getTime() : 0;
            if (!chosen || adjustedAt >= chosen.adjustedAt) {
                chosen = { anchorYear, anchorMonth, anchorBalance, adjustedAt };
                chosenDocumentId = doc._id;
            }
        }

        const anchor = chosen
            ? {
                  anchorYear: chosen.anchorYear,
                  anchorMonth: chosen.anchorMonth,
                  anchorBalance: chosen.anchorBalance,
              }
            : null;

        logger.info('resolveEmployeeBalanceAnchor result', {
            employeeId: String(employeeId),
            organizationId: organizationId ? String(organizationId) : null,
            chosenDocumentId: chosenDocumentId ? String(chosenDocumentId) : null,
            anchor,
        });

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
     */
    async computeRollingMonthlyBalance(leaveTypeConfig, employee, organizationId, asOfDate) {
        const leaveType = leaveTypeConfig.type;
        const monthlyRate =
            getRollingAccrualMonthlyRate(leaveTypeConfig) ?? DEFAULT_MONTHLY_LEAVE_DAYS;
        const joiningDate = getEffectiveJoiningDate(employee);
        const employeeId = employee._id;

        const fromDate = new Date(joiningDate.getFullYear(), joiningDate.getMonth(), 1);
        const toDate = this.endOfMonthDate(asOfDate.getFullYear(), asOfDate.getMonth());
        const usedByMonth = await this.buildApprovedLeaveUsedByMonthMap(
            employeeId,
            leaveType,
            organizationId,
            fromDate,
            toDate
        );

        return rollLeaveBalanceThroughPeriod({
            joinYear: joiningDate.getFullYear(),
            joinMonthIndex: joiningDate.getMonth(),
            endYear: asOfDate.getFullYear(),
            endMonthIndex: asOfDate.getMonth(),
            monthlyRate,
            getUsedForMonth: (year, monthIndex) =>
                usedByMonth.get(`${year}-${monthIndex}`) || 0,
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
        const monthlyAmount =
            getRollingAccrualMonthlyRate(leaveTypeConfig) ?? DEFAULT_MONTHLY_LEAVE_DAYS;
        const joiningDate = getEffectiveJoiningDate(employee);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);

        if (asOfDate < yearStart) return 0;

        const endDate = asOfDate > yearEnd ? yearEnd : asOfDate;
        const startMonth = joiningDate.getFullYear() === year ? joiningDate.getMonth() : 0;
        const endMonth = endDate.getMonth();

        let total = 0;
        for (let m = startMonth; m <= endMonth; m += 1) {
            total += this.calculateSingleMonthEarned(monthlyAmount, employee, year, m, joiningDate);
        }
        return Math.round(total * 1000) / 1000;
    }

    /**
     * Calculate accrued balance — monthly allocation for configured policies; legacy methods unchanged.
     */
    async calculateAccruedBalance(leaveTypeConfig, employee, year, organizationId, asOfDate = new Date()) {
        const accrual = leaveTypeConfig.accrual || {};
        const entitlementAmount = getEffectiveEntitlementAmount(leaveTypeConfig);
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

        if (accrual.method === 'proportional') {
            const totalMonths = this.calculateMonthsWorked(
                joiningDate,
                year,
                asOfDate < yearEnd ? asOfDate : yearEnd
            );
            const proportionalAmount = (totalMonths / 12) * entitlementAmount;
            return Math.min(proportionalAmount, accrual.maxAccrual || entitlementAmount);
        }

        // Standard policies: monthly accrual (1.5/mo) capped at annual entitlement (18/yr)
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

        const policy = await this.getApplicablePolicy(employee, organizationId, year);
        const leaveTypeConfig = policy?.leaveTypes?.find((lt) => lt.type === leaveType);
        if (!leaveTypeConfig) {
            cache.set(cacheKey, 0);
            return 0;
        }

        const effectiveConfig = {
            ...leaveTypeConfig,
            carryForward: getEffectiveCarryForwardConfig(leaveTypeConfig),
        };

        const asOfDec31 = new Date(year, 11, 31, 23, 59, 59, 999);

        if (this.usesStandardMonthlyBalanceRules(effectiveConfig)) {
            const balanceAnchor = await this.resolveEmployeeBalanceAnchor(employeeId, organizationId);
            const pooled = await this.computePooledAvailableLeave(
                employee,
                policy,
                organizationId,
                asOfDec31,
                balanceAnchor
            );
            const closing = Math.max(0, roundLeaveDays(pooled.available ?? 0));
            cache.set(cacheKey, closing);
            return closing;
        }

        const computed = await this.computeRollingMonthlyBalance(
            effectiveConfig,
            employee,
            organizationId,
            asOfDec31
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
     * Get applicable policy for employee
     * Policy is a one-time configuration per organization (not year-based)
     */
    async getApplicablePolicy(employee, organizationId, year) {
        // Policy is organization-wide and one-time setup, not filtered by year
        const policies = await LeavePolicy.find({
            organizationId,
            isActive: true
        }).sort({ effectiveDate: -1 });

        for (const policy of policies) {
            if (this.isPolicyApplicable(policy, employee)) {
                const normalized = {
                    ...policy.toObject(),
                    leaveTypes: normalizePolicyLeaveTypes(policy.leaveTypes),
                };
                if (!this.hasUsableLeaveTypes(normalized)) {
                    logger.warn('Skipping applicable policy with empty/zero leave types', {
                        employeeId: employee._id,
                        policyId: policy._id,
                        policyName: policy.policyName,
                        applicableTo: policy.applicableTo
                    });
                    continue;
                }
                return normalized;
            }
        }

        return null;
    }

    /**
     * Check if policy is applicable to employee
     */
    isPolicyApplicable(policy, employee) {
        const employeeDepartment = (employee.department || '').toLowerCase().trim();
        const policyDepartments = (policy.applicableDepartments || [])
            .map((d) => (d || '').toLowerCase().trim())
            .filter(Boolean);
        const employeeRoleId = employee.role?.toString();
        const applicableRoleIds = (policy.applicableRoles || []).map((role) => role.toString());
        const employeeId = employee._id?.toString();
        const applicableEmployeeIds = (policy.applicableEmployees || []).map((emp) => emp.toString());

        switch (policy.applicableTo) {
            case 'all':
                return true;
            case 'department':
                return policyDepartments.includes(employeeDepartment);
            case 'role':
                return Boolean(employeeRoleId) && applicableRoleIds.includes(employeeRoleId);
            case 'employee':
                return Boolean(employeeId) && applicableEmployeeIds.includes(employeeId);
            case 'custom':
                // For custom policies, apply if employee matches any configured scope.
                // This keeps custom flexible and avoids false "no policy" results.
                return (
                    (Boolean(employeeId) && applicableEmployeeIds.includes(employeeId)) ||
                    (Boolean(employeeRoleId) && applicableRoleIds.includes(employeeRoleId)) ||
                    policyDepartments.includes(employeeDepartment)
                );
            default:
                return false;
        }
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

