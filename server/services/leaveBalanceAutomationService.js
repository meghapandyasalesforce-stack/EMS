import Employee from '../models/employee.model.js';
import LeaveBalance from '../models/leaveBalance.model.js';
import LeaveBalanceAudit from '../models/leaveBalanceAudit.model.js';
import leaveBalanceEngine from './leaveBalanceEngine.js';
import logger from '../helpers/logger.js';
import { getEffectiveCarryForwardConfig } from '../constants/leaveDefaults.js';
import { getRollingAccrualMonthlyRate, usesMonthlyAccrual } from '../helpers/leavePolicyAccrualHelper.js';
import { getEmployeeLeaveYearBounds, clampLeavePeriodStart } from '../helpers/leaveYearBoundsHelper.js';
import { getEffectiveJoiningDate, roundLeaveDays } from '../helpers/leaveBalanceRulesHelper.js';

const ACTIVE_STATUSES = new Set(['active']);

function aggregateBalanceSnapshot(balances = []) {
    return balances.reduce(
        (acc, b) => ({
            accrued: acc.accrued + (Number(b?.accrued) || 0),
            used: acc.used + (Number(b?.used) || 0),
            carriedForward: acc.carriedForward + (Number(b?.carriedForward) || 0),
            available: acc.available + (Number(b?.available) || 0),
        }),
        { accrued: 0, used: 0, carriedForward: 0, available: 0 }
    );
}

function snapshotTypeBalance(typeBalance) {
    return {
        accrued: Number(typeBalance?.accrued) || 0,
        used: Number(typeBalance?.used) || 0,
        carriedForward: Number(typeBalance?.carriedForward) || 0,
        available: Number(typeBalance?.available) || 0,
        pending: Number(typeBalance?.pending) || 0,
        expired: Number(typeBalance?.expired) || 0,
    };
}

function getCurrentPeriod() {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

function validatePeriod(fromYear, fromMonth) {
    const y = Number(fromYear);
    const m = Number(fromMonth);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) {
        throw new Error('Invalid year');
    }
    if (!Number.isInteger(m) || m < 1 || m > 12) {
        throw new Error('Invalid month (1–12)');
    }
    return { year: y, month: m };
}

function periodKey(fromYear, fromMonth, toYear, toMonth) {
    return `${fromYear}-${fromMonth}_${toYear}-${toMonth}`;
}

class LeaveBalanceAutomationService {
    async assertEmployeeEligible(employeeId, organizationId) {
        let employee = await Employee.findOne({ _id: employeeId, organizationId }).lean();
        if (!employee) {
            employee = await Employee.findById(employeeId).lean();
        }
        if (!employee) {
            throw new Error('Employee not found');
        }
        if (!ACTIVE_STATUSES.has(employee.status)) {
            throw new Error(`Leave allocation is not applied to ${employee.status} employees`);
        }
        return employee;
    }

    async hasDuplicatePeriodUpdate(employeeId, organizationId, fromYear, fromMonth, toYear, toMonth) {
        const existing = await LeaveBalanceAudit.findOne({
            organizationId,
            employee: employeeId,
            action: 'period_update',
            fromYear,
            fromMonth,
            toYear,
            toMonth,
            duplicatePrevented: { $ne: true },
        }).sort({ performedAt: -1 });

        return Boolean(existing);
    }

    async hasDuplicateCarryForward(employeeId, organizationId, fromYear) {
        const toYear = fromYear + 1;
        const balance = await LeaveBalance.findOne({
            organizationId,
            employee: employeeId,
            year: toYear,
        }).lean();

        const processed = balance?.carryForwardProcessed?.some(
            (p) => p.fromYear === fromYear && p.toYear === toYear
        );
        if (!processed) return false;

        // Allow retry if a prior run marked processed but never recorded a carry
        const hasHistory = (balance?.carryForwardHistory || []).some(
            (h) => h.fromYear === fromYear && h.toYear === toYear && Number(h.amount) > 0
        );
        return hasHistory;
    }

    hasMonthlyAllocationLog(balance, year, month, leaveType) {
        return (balance?.monthlyAllocationLog || []).some(
            (log) => log.year === year && log.month === month && log.leaveType === leaveType
        );
    }

    async recordMonthlyAllocation(balanceDoc, year, month, leaveType, amount) {
        if (!balanceDoc) return false;
        if (this.hasMonthlyAllocationLog(balanceDoc, year, month, leaveType)) {
            return false;
        }
        balanceDoc.monthlyAllocationLog = balanceDoc.monthlyAllocationLog || [];
        balanceDoc.monthlyAllocationLog.push({
            year,
            month,
            leaveType,
            amount,
            allocatedAt: new Date(),
        });
        return true;
    }

    async allocateEmployeeForMonth(employeeId, organizationId, year, month, options = {}) {
        const { force = false, clearManualOverride = false } = options;
        const employee = await Employee.findById(employeeId);
        if (!employee || employee.status !== 'active') {
            return { skipped: true, reason: 'inactive' };
        }

        const policy = await leaveBalanceEngine.getApplicablePolicy(employee, organizationId, year);
        if (!policy) {
            return { skipped: true, reason: 'no_policy' };
        }

        const asOfDate = leaveBalanceEngine.endOfMonthDate(year, month - 1);

        await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId, {
            asOfDate,
            clearManualOverride,
        });

        const balance = await LeaveBalance.findOne({
            organizationId,
            employee: employeeId,
            year,
        });
        if (!balance) {
            return { skipped: true, reason: 'no_balance' };
        }

        let recorded = 0;
        let totalCredit = 0;
        for (const lt of policy.leaveTypes) {
            if (lt.enabled === false) {
                continue;
            }
            if (!usesMonthlyAccrual(lt) && !force) {
                continue;
            }
            const monthlyAmount = getRollingAccrualMonthlyRate(lt);
            const joiningDate = getEffectiveJoiningDate(employee);
            const earned = leaveBalanceEngine.calculateSingleMonthEarned(
                monthlyAmount,
                employee,
                year,
                month - 1,
                joiningDate
            );
            if (earned <= 0) continue;

            if (force || !this.hasMonthlyAllocationLog(balance, year, month, lt.type)) {
                const added = await this.recordMonthlyAllocation(balance, year, month, lt.type, earned);
                if (added) {
                    recorded += 1;
                    totalCredit = roundLeaveDays(totalCredit + earned);
                }
            }
        }

        if (recorded > 0) {
            balance.markModified('monthlyAllocationLog');
            await balance.save();
        }

        await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId, {
            asOfDate,
            clearManualOverride: false,
        });

        return { skipped: false, recorded };
    }

    /**
     * Recalculate leave from selected month/year through current month/year.
     * Idempotent — safe to run multiple times; duplicate runs for same period blocked unless force=true.
     */
    async updateLeaveFromPeriod(employeeId, organizationId, fromYear, fromMonth, performedBy, options = {}) {
        const { force = false } = options;
        const employee = await Employee.findById(employeeId);
        const bounds = getEmployeeLeaveYearBounds(employee);
        const clampedStart = clampLeavePeriodStart(fromYear, fromMonth, bounds);
        const start = validatePeriod(clampedStart.year, clampedStart.month);
        const current = getCurrentPeriod();

        if (start.year > current.year || (start.year === current.year && start.month > current.month)) {
            throw new Error('Start period cannot be in the future');
        }

        await this.assertEmployeeEligible(employeeId, organizationId);

        if (
            !force &&
            (await this.hasDuplicatePeriodUpdate(
                employeeId,
                organizationId,
                start.year,
                start.month,
                current.year,
                current.month
            ))
        ) {
            return {
                success: false,
                duplicatePrevented: true,
                message: `Leave for ${this.formatMonthYear(start.month, start.year)} through ${this.formatMonthYear(current.month, current.year)} was already updated. Use force=true to run again.`,
            };
        }

        const previousBalanceDoc = await LeaveBalance.findOne({
            organizationId,
            employee: employeeId,
            year: current.year,
        }).lean();
        const previousSnapshot = previousBalanceDoc?.balances?.length
            ? aggregateBalanceSnapshot(previousBalanceDoc.balances)
            : { accrued: 0, used: 0, carriedForward: 0, available: 0 };

        const monthDetails = [];

        for (let y = start.year; y <= current.year; y += 1) {
            const monthStart = y === start.year ? start.month - 1 : 0;
            const monthEnd = y === current.year ? current.month - 1 : 11;

            for (let m = monthStart; m <= monthEnd; m += 1) {
                const monthNum = m + 1;
                const balanceBefore = await LeaveBalance.findOne({
                    organizationId,
                    employee: employeeId,
                    year: y,
                }).lean();

                const policyForMonth = await leaveBalanceEngine.getApplicablePolicy(
                    employee,
                    organizationId,
                    y,
                    leaveBalanceEngine.endOfMonthDate(y, m)
                );
                const usesPooledWallet =
                    (leaveBalanceEngine.getPooledLeaveTypeConfigs(policyForMonth || {}) || []).length > 0;

                const monthAlreadyProcessed =
                    !force &&
                    (usesPooledWallet
                        ? balanceBefore?.monthlyAllocationLog?.some(
                              (log) =>
                                  log.year === y &&
                                  log.month === monthNum &&
                                  log.leaveType === 'employee'
                          )
                        : balanceBefore?.monthlyAllocationLog?.some(
                              (log) => log.year === y && log.month === monthNum
                          ));

                if (monthAlreadyProcessed && !force) {
                    continue;
                }

                await this.allocateEmployeeForMonth(employeeId, organizationId, y, monthNum, {
                    force,
                    clearManualOverride: true,
                });

                const asOfDate = leaveBalanceEngine.endOfMonthDate(y, m);
                const policy = await leaveBalanceEngine.getApplicablePolicy(
                    employee,
                    organizationId,
                    y,
                    asOfDate
                );
                if (policy) {
                    for (const lt of policy.leaveTypes) {
                        if (lt.enabled === false) continue;
                        const earned = leaveBalanceEngine.calculateAccruedThroughDate(
                            lt,
                            employee,
                            y,
                            asOfDate
                        );
                        const used = await leaveBalanceEngine.calculateUsedInMonth(
                            employeeId,
                            lt.type,
                            y,
                            m,
                            organizationId
                        );
                        monthDetails.push({
                            year: y,
                            month: monthNum,
                            leaveType: lt.type,
                            earned,
                            used,
                        });
                    }
                }
            }

            // Rolling engine carries balance across years — no separate year-end reset step.
        }

        const asOfNow = leaveBalanceEngine.endOfMonthDate(current.year, current.month - 1);
        const finalBalance = await leaveBalanceEngine.calculateBalance(employeeId, current.year, organizationId, {
            asOfDate: asOfNow,
            clearManualOverride: true,
        });

        await LeaveBalance.updateOne(
            { organizationId, employee: employeeId, year: current.year },
            {
                lastAutomatedUpdate: {
                    fromYear: start.year,
                    fromMonth: start.month,
                    toYear: current.year,
                    toMonth: current.month,
                    updatedAt: new Date(),
                    updatedBy: performedBy,
                },
            }
        );

        const newSnapshot = finalBalance?.balances?.length
            ? aggregateBalanceSnapshot(finalBalance.balances)
            : previousSnapshot;

        await LeaveBalanceAudit.create({
            organizationId,
            employee: employeeId,
            action: 'period_update',
            fromYear: start.year,
            fromMonth: start.month,
            toYear: current.year,
            toMonth: current.month,
            previousBalance: previousSnapshot,
            newBalance: newSnapshot,
            performedBy,
            performedByModel: performedBy ? 'Employee' : undefined,
            notes: `Period update ${periodKey(start.year, start.month, current.year, current.month)}; ${monthDetails.length} month(s) processed`,
        });

        logger.info('Leave period update completed', {
            employeeId,
            from: `${start.year}-${start.month}`,
            to: `${current.year}-${current.month}`,
        });

        return {
            success: true,
            message: clampedStart.clamped
                ? `Leave updated from ${this.formatMonthYear(1, bounds.minYear)} through ${this.formatMonthYear(current.month, current.year)}`
                : `Leave updated from ${this.formatMonthYear(start.month, start.year)} to ${this.formatMonthYear(current.month, current.year)}`,
            fromYear: start.year,
            fromMonth: start.month,
            requestedFromYear: Number(fromYear),
            requestedFromMonth: Number(fromMonth),
            clampedToJoiningDate: clampedStart.clamped,
            toYear: current.year,
            toMonth: current.month,
            monthsProcessed: monthDetails.length,
            monthDetails,
        };
    }

    /**
     * Carry forward remaining balance from fromYear into fromYear+1 per policy.
     */
    async executeCarryForward(employeeId, organizationId, fromYear, performedBy, options = {}) {
        const { force = false, silent = false } = options;
        const sourceYear = Number(fromYear);
        const targetYear = sourceYear + 1;

        if (!Number.isInteger(sourceYear) || sourceYear < 2000) {
            throw new Error('Invalid carry-forward source year');
        }

        const employee = await Employee.findById(employeeId);
        const bounds = getEmployeeLeaveYearBounds(employee);
        if (sourceYear < bounds.minYear) {
            throw new Error(`Cannot carry forward before ${bounds.minYear}`);
        }
        if (sourceYear >= bounds.currentYear) {
            throw new Error('Carry forward is only for completed calendar years');
        }

        await this.assertEmployeeEligible(employeeId, organizationId);

        if (!force && (await this.hasDuplicateCarryForward(employeeId, organizationId, sourceYear))) {
            if (silent) return { success: true, skipped: true };
            return {
                success: false,
                duplicatePrevented: true,
                message: `Carry forward from ${sourceYear} to ${targetYear} was already executed. Use force=true to run again.`,
            };
        }

        const asOfDec31 = new Date(sourceYear, 11, 31, 23, 59, 59, 999);
        await leaveBalanceEngine.calculateBalance(employeeId, sourceYear, organizationId, {
            asOfDate: asOfDec31,
            clearManualOverride: true,
        });

        const policy = await leaveBalanceEngine.getApplicablePolicy(employee, organizationId, targetYear);
        if (!policy) {
            throw new Error('No applicable leave policy for carry-forward target year');
        }

        const pooledTypes = leaveBalanceEngine.getPooledLeaveTypeConfigs(policy);
        if (pooledTypes.length > 0) {
            let targetBalance = await leaveBalanceEngine.getOrCreateBalanceRecord(
                organizationId,
                employeeId,
                targetYear,
                policy._id
            );

            targetBalance.carryForwardProcessed = targetBalance.carryForwardProcessed || [];
            const alreadyProcessed = targetBalance.carryForwardProcessed.some(
                (p) => p.fromYear === sourceYear && p.toYear === targetYear
            );
            if (!alreadyProcessed) {
                targetBalance.carryForwardProcessed.push({
                    fromYear: sourceYear,
                    toYear: targetYear,
                    processedAt: new Date(),
                    processedBy: performedBy,
                });
                targetBalance.markModified('carryForwardProcessed');
                await targetBalance.save();
            }

            await leaveBalanceEngine.calculateBalance(employeeId, targetYear, organizationId, {
                clearManualOverride: true,
            });

            if (silent) return { success: true, skipped: false, carryResults: [] };
            return {
                success: true,
                message: `Employee leave balance carried from ${sourceYear} to ${targetYear} (no reset)`,
                fromYear: sourceYear,
                toYear: targetYear,
                carryResults: [],
            };
        }

        const carryResults = [];

        let targetBalance = await leaveBalanceEngine.getOrCreateBalanceRecord(
            organizationId,
            employeeId,
            targetYear,
            policy._id
        );

        for (const leaveTypeConfig of policy.leaveTypes) {
            const leaveType = leaveTypeConfig.type;
            if (LEAVE_TYPES_NO_CARRY_FORWARD.has(leaveType)) continue;

            const carryConfig = getEffectiveCarryForwardConfig(leaveTypeConfig);
            if (!carryConfig.enabled) continue;

            const previousAvailable = await leaveBalanceEngine.getYearEndAvailableBalance(
                employeeId,
                leaveType,
                sourceYear,
                organizationId
            );
            if (previousAvailable <= 0) continue;

            const carryAmount =
                carryConfig.maxDays != null && carryConfig.maxDays > 0
                    ? Math.min(previousAvailable, carryConfig.maxDays)
                    : previousAvailable;

            let targetType = targetBalance.balances.find((b) => b.leaveType === leaveType);
            if (!targetType) {
                targetType = {
                    leaveType,
                    accrued: 0,
                    used: 0,
                    available: 0,
                    carriedForward: 0,
                    expired: 0,
                    pending: 0,
                };
                targetBalance.balances.push(targetType);
            }

            const prevSnapshot = snapshotTypeBalance(targetType);
            targetType.carriedForward = carryAmount;
            targetType.available = Math.max(
                0,
                (targetType.accrued || 0) +
                    carryAmount -
                    (targetType.used || 0) -
                    (targetType.expired || 0) -
                    (targetType.pending || 0)
            );

            targetBalance.carryForwardHistory = targetBalance.carryForwardHistory || [];
            targetBalance.carryForwardHistory.push({
                fromYear: sourceYear,
                toYear: targetYear,
                leaveType,
                amount: carryAmount,
                date: new Date(),
                processedBy: performedBy,
                previousAvailable,
            });

            carryResults.push({
                leaveType,
                previousAvailable,
                carriedForward: carryAmount,
                previousBalance: prevSnapshot,
                newBalance: snapshotTypeBalance(targetType),
            });

            if (!silent) {
                await LeaveBalanceAudit.create({
                    organizationId,
                    employee: employeeId,
                    action: 'carry_forward',
                    leaveType,
                    carryForwardFromYear: sourceYear,
                    carryForwardToYear: targetYear,
                    previousBalance: { ...prevSnapshot, available: previousAvailable },
                    newBalance: snapshotTypeBalance(targetType),
                    performedBy,
                    performedByModel: performedBy ? 'Employee' : undefined,
                    notes: `Carried ${carryAmount} day(s) from ${sourceYear} to ${targetYear}`,
                });
            }
        }

        if (carryResults.length === 0) {
            if (silent) return { success: true, skipped: true, carryResults: [] };
            return {
                success: true,
                message: `No unused leave to carry from ${sourceYear} to ${targetYear}`,
                fromYear: sourceYear,
                toYear: targetYear,
                carryResults: [],
            };
        }

        targetBalance.carryForwardProcessed = targetBalance.carryForwardProcessed || [];
        targetBalance.carryForwardProcessed.push({
            fromYear: sourceYear,
            toYear: targetYear,
            processedAt: new Date(),
            processedBy: performedBy,
        });

        targetBalance.markModified('balances');
        targetBalance.markModified('carryForwardHistory');
        targetBalance.markModified('carryForwardProcessed');
        await targetBalance.save();

        await leaveBalanceEngine.calculateBalance(employeeId, targetYear, organizationId, {
            clearManualOverride: true,
        });

        if (silent) return { success: true, skipped: false, carryResults };

        return {
            success: true,
            message: `Carry forward from ${sourceYear} to ${targetYear} completed`,
            fromYear: sourceYear,
            toYear: targetYear,
            carryResults,
        };
    }

    /** Monthly auto-allocation for all active employees in an organization */
    async runMonthlyAllocationForOrganization(organizationId, options = {}) {
        const { force = false } = options;
        const current = getCurrentPeriod();
        const employees = await Employee.find({ organizationId, status: 'active' }).select('_id');
        let processed = 0;
        let skipped = 0;
        let errors = 0;

        if (current.month === 1 && !force) {
            await this.runNewYearCarryForwardForOrganization(organizationId, current.year - 1);
        }

        for (const emp of employees) {
            try {
                const result = await this.allocateEmployeeForMonth(
                    emp._id,
                    organizationId,
                    current.year,
                    current.month,
                    { force, clearManualOverride: false }
                );
                if (result.skipped) skipped += 1;
                else processed += 1;
            } catch (error) {
                errors += 1;
                logger.error('Monthly leave allocation failed', {
                    employeeId: emp._id,
                    error: error.message,
                });
            }
        }

        await LeaveBalanceAudit.create({
            organizationId,
            action: 'monthly_auto',
            toYear: current.year,
            toMonth: current.month,
            notes: `Monthly allocation ${current.month}/${current.year}: processed ${processed}, skipped ${skipped}, errors ${errors}`,
        }).catch((err) => {
            logger.warn('Monthly auto audit log skipped', { error: err.message });
        });

        return { processed, skipped, errors, year: current.year, month: current.month };
    }

    async runNewYearCarryForwardForOrganization(organizationId, fromYear) {
        await leaveBalanceEngine.processYearEndCarryForward(organizationId, fromYear, fromYear + 1);
    }

    /**
     * Automatically carry unused leave through each completed calendar year up to throughYear.
     * Safe to call repeatedly — skips years already processed.
     */
    async ensureCarryForwardThroughYear(employeeId, organizationId, throughYear) {
        const employee = await Employee.findById(employeeId).select('joiningDate status').lean();
        if (!employee || !ACTIVE_STATUSES.has(employee.status)) {
            return { processed: 0, skipped: 0 };
        }

        const bounds = getEmployeeLeaveYearBounds(employee);
        const startYear = bounds.joiningYear;
        const endYear = Math.min(Number(throughYear), bounds.currentYear - 1);

        if (!Number.isFinite(endYear) || endYear < startYear) {
            return { processed: 0, skipped: 0 };
        }

        let processed = 0;
        let skipped = 0;

        for (let y = startYear; y <= endYear; y += 1) {
            if (y >= bounds.currentYear) break;
            const result = await this.executeCarryForward(employeeId, organizationId, y, null, {
                force: false,
                silent: true,
            });
            if (result?.skipped) {
                skipped += 1;
            } else if (result?.success) {
                processed += 1;
            }
        }

        return { processed, skipped };
    }

    async getAuditLog(employeeId, organizationId, limit = 20) {
        return LeaveBalanceAudit.find({ organizationId, employee: employeeId })
            .sort({ performedAt: -1 })
            .limit(limit)
            .lean();
    }

    formatMonthYear(month, year) {
        const names = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December',
        ];
        return `${names[month - 1]} ${year}`;
    }
}

export default new LeaveBalanceAutomationService();
