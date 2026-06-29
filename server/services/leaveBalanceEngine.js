import LeaveBalance from '../models/leaveBalance.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import Leave from '../models/leave.model.js';
import Employee from '../models/employee.model.js';
import logger from '../helpers/logger.js';
import { getLeaveTypeVariantsForBalance } from '../helpers/leaveTypeHelper.js';
import {
    getMonthlyEntitlementAmount,
    getYearlyAccrualCap
} from '../helpers/leavePolicyAccrualHelper.js';

class LeaveBalanceEngine {
    /**
     * A policy is considered usable only when it has at least
     * one leave type configured with a positive accrual amount.
     */
    hasUsableLeaveTypes(policy) {
        const leaveTypes = policy?.leaveTypes || [];
        return leaveTypes.some((lt) => Number(lt?.accrual?.amount || 0) > 0);
    }
    /**
     * Calculate and update leave balance for an employee for a given year
     */
    async calculateBalance(employeeId, year, organizationId) {
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

            // Get or create balance record
            let balance = await LeaveBalance.findOne({
                organizationId,
                employee: employeeId,
                year,
                policy: policy._id
            });

            if (!balance) {
                balance = new LeaveBalance({
                    organizationId,
                    employee: employeeId,
                    policy: policy._id,
                    year,
                    balances: []
                });
            }

            // Calculate balances for each leave type
            for (const leaveTypeConfig of policy.leaveTypes) {
                await this.calculateLeaveTypeBalance(
                    balance,
                    leaveTypeConfig,
                    employee,
                    year,
                    organizationId
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
    async calculateLeaveTypeBalance(balance, leaveTypeConfig, employee, year, organizationId) {
        const leaveType = leaveTypeConfig.type;
        
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

        // Calculate accrued balance
        const accrued = await this.calculateAccruedBalance(
            leaveTypeConfig,
            employee,
            year,
            organizationId
        );
        typeBalance.accrued = accrued;

        // Calculate used balance (approved leaves)
        const used = await this.calculateUsedBalance(
            employee._id,
            leaveType,
            year,
            organizationId
        );
        typeBalance.used = used;

        // Calculate pending balance
        const pending = await this.calculatePendingBalance(
            employee._id,
            leaveType,
            year,
            organizationId
        );
        typeBalance.pending = pending;

        // Calculate carried forward balance
        const joiningYear = employee.joiningDate ? new Date(employee.joiningDate).getFullYear() : year;
        if (leaveTypeConfig.carryForward?.enabled && year > joiningYear) {
            const carriedForward = await this.calculateCarryForward(
                employee._id,
                leaveType,
                year - 1,
                leaveTypeConfig.carryForward,
                organizationId
            );
            typeBalance.carriedForward = carriedForward;
        }

        // Calculate expired balance
        if (leaveTypeConfig.carryForward?.expiresIfNotUsed) {
            const expired = await this.calculateExpiredBalance(
                employee._id,
                leaveType,
                year,
                leaveTypeConfig.carryForward,
                organizationId
            );
            typeBalance.expired = expired;
        }

        // Calculate available balance
        typeBalance.available = Math.max(0, 
            typeBalance.accrued + 
            typeBalance.carriedForward - 
            typeBalance.used - 
            typeBalance.expired - 
            typeBalance.pending
        );
    }

    /**
     * Calculate accrued balance based on accrual method
     */
    async calculateAccruedBalance(leaveTypeConfig, employee, year, organizationId) {
        const accrual = leaveTypeConfig.accrual;
        const joiningDate = employee.joiningDate || new Date();
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31);
        const now = new Date();

        switch (accrual.method) {
            case 'fixed':
                // Fixed amount per year
                return accrual.amount;

            case 'yearly':
                // Accrued at start of year
                if (now >= yearStart) {
                    return accrual.amount;
                }
                return 0;

            case 'monthly': {
                const monthsWorked = this.calculateMonthsWorked(joiningDate, year, now);
                const monthlyAmount =
                    getMonthlyEntitlementAmount(leaveTypeConfig) ??
                    (Number(accrual.amount) || 0);
                const yearlyCap =
                    getYearlyAccrualCap(leaveTypeConfig) ??
                    (Number.isFinite(Number(accrual.maxAccrual)) ? Number(accrual.maxAccrual) : Infinity);
                return Math.min(monthsWorked * monthlyAmount, yearlyCap);
            }

            case 'proportional':
                // Proportional to months of service
                const totalMonths = this.calculateMonthsWorked(joiningDate, year, yearEnd);
                const proportionalAmount = (totalMonths / 12) * accrual.amount;
                return Math.min(
                    proportionalAmount,
                    accrual.maxAccrual || Infinity
                );

            case 'on_anniversary':
                // Accrued on joining anniversary
                const anniversaryDate = new Date(year, joiningDate.getMonth(), joiningDate.getDate());
                if (now >= anniversaryDate && anniversaryDate >= yearStart) {
                    return accrual.amount;
                }
                return 0;

            default:
                return 0;
        }
    }

    /**
     * Calculate used balance (approved leaves). Uses variants so 'paid' includes 'annual' leaves.
     */
    async calculateUsedBalance(employeeId, leaveType, year, organizationId) {
        const types = getLeaveTypeVariantsForBalance(leaveType);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);
        const leaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            $or: [{ year }, { startDate: { $gte: yearStart, $lte: yearEnd } }],
            status: 'approved'
        });

        return leaves.reduce((total, leave) => total + (leave.duration || 0), 0);
    }

    /**
     * Calculate pending balance. Uses variants so 'paid' includes 'annual' leaves.
     */
    async calculatePendingBalance(employeeId, leaveType, year, organizationId) {
        const types = getLeaveTypeVariantsForBalance(leaveType);
        const yearStart = new Date(year, 0, 1);
        const yearEnd = new Date(year, 11, 31, 23, 59, 59);
        const leaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: types },
            $or: [{ year }, { startDate: { $gte: yearStart, $lte: yearEnd } }],
            status: 'pending'
        });

        return leaves.reduce((total, leave) => total + (leave.duration || 0), 0);
    }

    /**
     * Calculate carry-forward balance from previous year
     */
    async calculateCarryForward(employeeId, leaveType, previousYear, carryForwardConfig, organizationId) {
        const previousBalance = await LeaveBalance.findOne({
            organizationId,
            employee: employeeId,
            year: previousYear
        }).populate('policy');

        if (!previousBalance) {
            return 0;
        }

        const typeBalance = previousBalance.balances.find(b => b.leaveType === leaveType);
        if (!typeBalance) {
            return 0;
        }

        const availableToCarryForward = typeBalance.available;
        const maxCarryForward = carryForwardConfig.maxDays || 0;

        return Math.min(availableToCarryForward, maxCarryForward);
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
                if (!this.hasUsableLeaveTypes(policy)) {
                    logger.warn('Skipping applicable policy with empty/zero leave types', {
                        employeeId: employee._id,
                        policyId: policy._id,
                        policyName: policy.policyName,
                        applicableTo: policy.applicableTo
                    });
                    continue;
                }
                return policy;
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
            const employees = await Employee.find({ organizationId, status: 'active' });
            
            for (const employee of employees) {
                try {
                    // Calculate final balance for previous year
                    await this.calculateBalance(employee._id, fromYear, organizationId);
                    
                    // Calculate balance for new year (which will include carry-forward)
                    await this.calculateBalance(employee._id, toYear, organizationId);
                } catch (error) {
                    logger.error('Error processing carry-forward for employee', {
                        employeeId: employee._id,
                        error: error.message
                    });
                }
            }

            logger.info('Year-end carry-forward processed', { organizationId, fromYear, toYear });
        } catch (error) {
            logger.error('Error processing year-end carry-forward', {
                error: error.message,
                organizationId,
                fromYear,
                toYear
            });
            throw error;
        }
    }
}

export default new LeaveBalanceEngine();

