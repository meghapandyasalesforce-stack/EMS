import Calendar from '../models/calendar.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import Employee from '../models/employee.model.js';
import Leave from '../models/leave.model.js';
import logger from '../helpers/logger.js';
import { normalizeLeaveTypeForPolicy } from '../helpers/leaveTypeHelper.js';
import leaveBalanceEngine from './leaveBalanceEngine.js';

class LeaveValidationService {
    /**
     * Validate leave request against all rules
     */
    async validateLeaveRequest(employeeId, leaveData, organizationId) {
        const errors = [];
        const warnings = [];
        
        try {
            // Get employee and policy
            const employee = await Employee.findById(employeeId);
            if (!employee) {
                return { valid: false, errors: ['Employee not found'] };
            }

            const policy = await this.getApplicablePolicy(employee, organizationId);
            if (!policy) {
                return { valid: false, errors: ['No leave policy found for employee'] };
            }

            const normalizedType = normalizeLeaveTypeForPolicy(leaveData.leaveType);
            const leaveTypeConfig = policy.leaveTypes.find(lt => lt.type === normalizedType);
            if (!leaveTypeConfig) {
                return { valid: false, errors: [`Leave type ${leaveData.leaveType} not configured in policy`] };
            }

            const startDate = new Date(leaveData.startDate);
            const endDate = new Date(leaveData.endDate);

            // 1. Check probation period restrictions
            if (leaveTypeConfig.probationRestrictions?.enabled) {
                const probationCheck = this.checkProbationPeriod(employee, leaveTypeConfig.probationRestrictions);
                if (!probationCheck.allowed) {
                    errors.push(probationCheck.reason);
                }
            }

            // 2. Check notice period restrictions
            if (leaveTypeConfig.noticePeriodRestrictions?.enabled) {
                const noticeCheck = this.checkNoticePeriod(startDate, leaveTypeConfig.noticePeriodRestrictions);
                if (!noticeCheck.allowed) {
                    errors.push(noticeCheck.reason);
                }
            }

            // 3. Check blackout dates
            const blackoutCheck = await this.checkBlackoutDates(
                startDate, 
                endDate, 
                leaveData.leaveType, 
                policy, 
                organizationId
            );
            if (!blackoutCheck.allowed) {
                errors.push(blackoutCheck.reason);
            }

            // 4. Check weekends and holidays
            const calendar = await Calendar.findOne({ 
                organizationId, 
                year: startDate.getFullYear() 
            });
            
            const dateHandlingCheck = await this.checkDateHandling(
                startDate, 
                endDate, 
                policy.dateHandlingRules, 
                calendar,
                organizationId
            );
            if (dateHandlingCheck.warnings) {
                warnings.push(...dateHandlingCheck.warnings);
            }

            // 5. Calculate duration (used for balance check and min/max)
            const duration = await this.calculateDuration(startDate, endDate, policy.dateHandlingRules, calendar, organizationId);

            // 6. Check leave balance (policy year = leave start year; LOP skips balance)
            const balanceCheck = await this.checkLeaveBalance(
                employeeId,
                normalizedType,
                duration,
                leaveData.isHalfDay,
                organizationId,
                startDate.getFullYear()
            );
            if (!balanceCheck.allowed) {
                errors.push(balanceCheck.reason);
            }

            // 7. Check minimum/maximum days per request
            if (duration < leaveTypeConfig.minDaysPerRequest) {
                errors.push(`Minimum ${leaveTypeConfig.minDaysPerRequest} days required for ${leaveTypeConfig.displayName}`);
            }
            if (leaveTypeConfig.maxDaysPerRequest && duration > leaveTypeConfig.maxDaysPerRequest) {
                errors.push(`Maximum ${leaveTypeConfig.maxDaysPerRequest} days allowed for ${leaveTypeConfig.displayName}`);
            }

            // 8. Check for overlapping leaves
            const overlapCheck = await this.checkOverlappingLeaves(
                employeeId, 
                startDate, 
                endDate, 
                organizationId
            );
            if (!overlapCheck.allowed) {
                errors.push(overlapCheck.reason);
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                duration,
                workingDays: dateHandlingCheck.workingDays
            };
        } catch (error) {
            logger.error('Leave validation error', { error: error.message, stack: error.stack });
            return { valid: false, errors: ['Validation error occurred'] };
        }
    }

    /**
     * Check probation period restrictions
     */
    checkProbationPeriod(employee, restrictions) {
        if (!employee.joiningDate) {
            return { allowed: false, reason: 'Joining date not set for employee' };
        }

        const joiningDate = new Date(employee.joiningDate);
        const today = new Date();
        const daysSinceJoining = Math.floor((today - joiningDate) / (1000 * 60 * 60 * 24));

        if (daysSinceJoining < restrictions.minServiceDays) {
            return { 
                allowed: false, 
                reason: `Minimum ${restrictions.minServiceDays} days of service required. You have ${daysSinceJoining} days.` 
            };
        }

        return { allowed: true };
    }

    /**
     * Check notice period restrictions
     */
    checkNoticePeriod(startDate, restrictions) {
        const today = new Date();
        const daysUntilStart = Math.floor((startDate - today) / (1000 * 60 * 60 * 24));

        if (daysUntilStart < restrictions.minNoticeDays) {
            return { 
                allowed: false, 
                reason: `Minimum ${restrictions.minNoticeDays} days notice required. Leave starts in ${daysUntilStart} days.` 
            };
        }

        return { allowed: true };
    }

    /**
     * Check blackout dates
     */
    async checkBlackoutDates(startDate, endDate, leaveType, policy, organizationId) {
        if (!policy.blackoutDates || policy.blackoutDates.length === 0) {
            return { allowed: true };
        }

        const activeBlackouts = policy.blackoutDates.filter(bd => bd.isActive);
        
        for (const blackout of activeBlackouts) {
            const blackoutStart = new Date(blackout.startDate);
            const blackoutEnd = new Date(blackout.endDate);
            
            // Check if leave type is affected by this blackout
            const affectsLeaveType = !blackout.applicableLeaveTypes || 
                                    blackout.applicableLeaveTypes.includes('all') ||
                                    blackout.applicableLeaveTypes.includes(leaveType);

            if (!affectsLeaveType) {
                continue;
            }

            // Check for overlap
            if (this.datesOverlap(startDate, endDate, blackoutStart, blackoutEnd)) {
                return { 
                    allowed: false, 
                    reason: `Leave cannot be applied during blackout period: ${blackoutStart.toLocaleDateString()} to ${blackoutEnd.toLocaleDateString()}. ${blackout.reason || ''}` 
                };
            }
        }

        return { allowed: true };
    }

    /**
     * Check date handling (weekends and holidays)
     */
    async checkDateHandling(startDate, endDate, dateHandlingRules, calendar, organizationId) {
        const warnings = [];
        let workingDays = 0;

        if (!calendar) {
            // Default: Monday to Friday
            workingDays = this.calculateWorkingDaysDefault(startDate, endDate);
            return { workingDays, warnings };
        }

            // Calculate working days based on rules
            const currentDate = new Date(startDate);
            const endDateCopy = new Date(endDate);
            
            while (currentDate <= endDateCopy) {
                const dayOfWeek = currentDate.getDay();
                const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
                
                const isWorkingDay = calendar.workingDays[dayName];
                const isHoliday = calendar.holidays.some(holiday => {
                    const holidayDate = new Date(holiday.date);
                    return holidayDate.toDateString() === currentDate.toDateString() && holiday.isActive;
                });

                if (isWorkingDay && !isHoliday) {
                    workingDays++;
                } else {
                    if (!dateHandlingRules.countWeekends && !isWorkingDay) {
                        warnings.push(`${currentDate.toLocaleDateString()} is a weekend and won't be counted`);
                    }
                    if (!dateHandlingRules.countHolidays && isHoliday) {
                        const holiday = calendar.holidays.find(h => {
                            const hDate = new Date(h.date);
                            return hDate.toDateString() === currentDate.toDateString() && h.isActive;
                        });
                        warnings.push(`${currentDate.toLocaleDateString()} is a holiday (${holiday?.name || 'Unknown'}) and won't be counted`);
                    }
                }

                currentDate.setDate(currentDate.getDate() + 1);
            }

        return { workingDays, warnings };
    }

    /**
     * Check leave balance (leaveType should be normalized, e.g. paid not annual)
     * @param {number} [balanceYear] - accrual year for the leave (defaults to current calendar year)
     */
    async checkLeaveBalance(employeeId, leaveType, requestedDays, isHalfDay, organizationId, balanceYear) {
        try {
            if (!leaveType || String(leaveType).toLowerCase() === 'loss_of_pay') {
                return { allowed: true };
            }
            const year = Number.isFinite(balanceYear) ? balanceYear : new Date().getFullYear();
            const balance = await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);
            if (!balance) return { allowed: true }; // no policy – allow and let other checks handle
            const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
            if (!typeBalance) return { allowed: true };
            const required = isHalfDay ? 0.5 : requestedDays;
            if (typeBalance.available < required) {
                return {
                    allowed: false,
                    reason: `Insufficient leave balance. Available: ${typeBalance.available} days, Requested: ${required} days`
                };
            }
            return { allowed: true };
        } catch (err) {
            logger.warn('Leave balance check error', { employeeId, leaveType, error: err.message });
            return { allowed: true };
        }
    }

    /**
     * Check for overlapping leaves
     */
    async checkOverlappingLeaves(employeeId, startDate, endDate, organizationId) {
        const overlappingLeaves = await Leave.find({
            organizationId,
            employee: employeeId,
            status: { $in: ['pending', 'approved'] },
            $or: [
                {
                    startDate: { $lte: endDate },
                    endDate: { $gte: startDate }
                }
            ]
        });

        if (overlappingLeaves.length > 0) {
            return { 
                allowed: false, 
                reason: `You have ${overlappingLeaves.length} overlapping leave request(s) in this period` 
            };
        }

        return { allowed: true };
    }

    /**
     * Calculate duration in days
     */
    async calculateDuration(startDate, endDate, dateHandlingRules, calendar, organizationId) {
        if (!calendar || (dateHandlingRules?.countWeekends && dateHandlingRules?.countHolidays)) {
            return Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
        }

        const result = await this.checkDateHandling(startDate, endDate, dateHandlingRules, calendar, organizationId);
        return dateHandlingRules?.countWeekends && dateHandlingRules?.countHolidays 
            ? Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1
            : result.workingDays;
    }

    /**
     * Calculate working days (default: Monday-Friday)
     */
    calculateWorkingDaysDefault(startDate, endDate) {
        let workingDays = 0;
        const currentDate = new Date(startDate);
        
        while (currentDate <= endDate) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek >= 1 && dayOfWeek <= 5) { // Monday to Friday
                workingDays++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
        }
        
        return workingDays;
    }

    /**
     * Check if two date ranges overlap
     */
    datesOverlap(start1, end1, start2, end2) {
        return start1 <= end2 && start2 <= end1;
    }

    /**
     * Get applicable policy for employee
     */
    async getApplicablePolicy(employee, organizationId) {
        const policies = await LeavePolicy.find({
            organizationId,
            isActive: true
        }).sort({ effectiveDate: -1 });

        for (const policy of policies) {
            if (this.isPolicyApplicable(policy, employee)) {
                return policy;
            }
        }

        return null;
    }

    /**
     * Check if policy is applicable to employee
     */
    isPolicyApplicable(policy, employee) {
        switch (policy.applicableTo) {
            case 'all':
                return true;
            case 'department':
                return policy.applicableDepartments.includes(employee.department);
            case 'role':
                return policy.applicableRoles.some(role => 
                    role.toString() === employee.role?.toString()
                );
            case 'employee':
                return policy.applicableEmployees.some(emp => 
                    emp.toString() === employee._id.toString()
                );
            default:
                return false;
        }
    }
}

export default new LeaveValidationService();

