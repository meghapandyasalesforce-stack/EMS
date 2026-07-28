import Calendar from '../models/calendar.model.js';
import LeavePolicy from '../models/leavePolicy.model.js';
import Employee from '../models/employee.model.js';
import Leave from '../models/leave.model.js';
import logger from '../helpers/logger.js';
import { getLeaveTypeVariantsForBalance, normalizeLeaveTypeForPolicy } from '../helpers/leaveTypeHelper.js';
import leaveBalanceEngine from './leaveBalanceEngine.js';
import {
    getAppliableDaysThisMonth,
    getMonthlyEntitlementAmount,
    getRemainingMonthlyTakeCap,
    getYearlyAccrualCap,
    hasMonthlyEntitlement,
    normalizePolicyLeaveTypes,
    roundDays
} from '../helpers/leavePolicyAccrualHelper.js';
import { getEffectiveMonthlyTakeCap } from '../helpers/leaveEmployeeTakeLimitHelper.js';
import {
    isLeavePolicyApplicableToEmployee,
    selectApplicableLeavePolicy,
} from '../helpers/leavePolicyApplicabilityHelper.js';

class LeaveValidationService {
    /** Parse YYYY-MM-DD as local calendar date (avoids UTC timezone shifting weekdays). */
    parseLeaveDate(dateInput) {
        if (!dateInput) {
            return null;
        }
        if (typeof dateInput === 'string') {
            const match = dateInput.match(/^(\d{4})-(\d{2})-(\d{2})/);
            if (match) {
                return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
            }
        }
        const parsed = new Date(dateInput);
        if (Number.isNaN(parsed.getTime())) {
            return null;
        }
        return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate());
    }

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

            const startDateEarly = this.parseLeaveDate(leaveData.startDate);
            const policy = await this.getApplicablePolicy(
                employee,
                organizationId,
                startDateEarly || new Date()
            );
            if (!policy) {
                return { valid: false, errors: ['No leave policy found for employee'] };
            }

            const normalizedType = normalizeLeaveTypeForPolicy(leaveData.leaveType);
            const leaveTypeConfig = policy.leaveTypes.find(lt => lt.type === normalizedType);
            if (!leaveTypeConfig) {
                return { valid: false, errors: [`Leave type ${leaveData.leaveType} not configured in policy`] };
            }

            const startDate = this.parseLeaveDate(leaveData.startDate);
            const endDate = this.parseLeaveDate(leaveData.endDate);
            if (!startDate || !endDate) {
                return { valid: false, errors: ['Invalid start or end date'] };
            }

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
            let duration = await this.calculateDuration(startDate, endDate, policy.dateHandlingRules, calendar, organizationId);
            const workingDays = dateHandlingCheck.workingDays ?? duration;

            if (leaveData.isHalfDay && workingDays > 0) {
                duration = 0.5;
            }

            // 6. Check leave balance (policy year = leave start year; LOP skips balance)
            let typeAvailableBalance = null;
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
            if (balanceCheck.available != null) {
                typeAvailableBalance = balanceCheck.available;
            }

            // 7. Check minimum/maximum days per request
            if (duration === 0) {
                errors.push('Selected dates fall on non-working days (weekend or holiday). Please choose a working day.');
            } else if (duration < leaveTypeConfig.minDaysPerRequest) {
                errors.push(`Minimum ${leaveTypeConfig.minDaysPerRequest} days required for ${leaveTypeConfig.displayName}`);
            }
            if (leaveTypeConfig.maxDaysPerRequest && duration > leaveTypeConfig.maxDaysPerRequest) {
                errors.push(`Maximum ${leaveTypeConfig.maxDaysPerRequest} days allowed for ${leaveTypeConfig.displayName}`);
            }

            // 8. Employee month take limit tracks available (manual add + unused accrual).
            // Policy maxDaysPerMonth is not a tighter ceiling than that employee's stock.
            if (typeAvailableBalance == null && normalizedType !== 'loss_of_pay') {
                try {
                    const bal = await leaveBalanceEngine.calculateBalance(
                        employeeId,
                        startDate.getFullYear(),
                        organizationId
                    );
                    const row = bal?.balances?.find((b) => b.leaveType === normalizedType);
                    typeAvailableBalance = row?.available ?? 0;
                } catch (e) {
                    typeAvailableBalance = 0;
                }
            }

            if (normalizedType !== 'loss_of_pay' && typeAvailableBalance != null) {
                const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0, 23, 59, 59, 999);

                const candidateLeaves = await Leave.find({
                    organizationId,
                    employee: employeeId,
                    leaveType: { $in: getLeaveTypeVariantsForBalance(normalizedType) },
                    status: { $in: ['pending', 'approved'] },
                    startDate: { $lte: lastMonth },
                    endDate: { $gte: firstMonth }
                });

                const totalLeaveDaysCache = new Map();
                for (const l of candidateLeaves) {
                    const lStart = new Date(l.startDate);
                    const lEnd = new Date(l.endDate);
                    const totalLeaveDaysCounted = await this.calculateDuration(
                        lStart,
                        lEnd,
                        policy.dateHandlingRules,
                        calendar,
                        organizationId
                    );
                    totalLeaveDaysCache.set(String(l._id), totalLeaveDaysCounted);
                }

                const firstMonthCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                const lastMonthCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                const monthCursor = new Date(firstMonthCursor);
                const epsilon = 1e-9;

                while (monthCursor.getTime() <= lastMonthCursor.getTime()) {
                    const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
                    const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 23, 59, 59, 999);

                    const segmentStart = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
                    const segmentEnd = new Date(Math.min(endDate.getTime(), monthEnd.getTime()));

                    if (segmentStart.getTime() <= segmentEnd.getTime()) {
                        const requestedSegmentDays = leaveData.isHalfDay
                            ? 0.5
                            : await this.calculateDuration(
                                segmentStart,
                                segmentEnd,
                                policy.dateHandlingRules,
                                calendar,
                                organizationId
                            );

                        let usedDays = 0;
                        for (const l of candidateLeaves) {
                            const lStart = new Date(l.startDate);
                            const lEnd = new Date(l.endDate);
                            if (lEnd.getTime() < monthStart.getTime() || lStart.getTime() > monthEnd.getTime()) {
                                continue;
                            }

                            const overlapStart = new Date(Math.max(lStart.getTime(), monthStart.getTime()));
                            const overlapEnd = new Date(Math.min(lEnd.getTime(), monthEnd.getTime()));
                            if (overlapStart.getTime() > overlapEnd.getTime()) continue;

                            const totalLeaveDaysCounted = totalLeaveDaysCache.get(String(l._id)) ?? 0;
                            const overlapWorkingDays = await this.calculateDuration(
                                overlapStart,
                                overlapEnd,
                                policy.dateHandlingRules,
                                calendar,
                                organizationId
                            );

                            if (totalLeaveDaysCounted > 0) {
                                const ratio = overlapWorkingDays / totalLeaveDaysCounted;
                                usedDays += (Number(l.duration) || 0) * ratio;
                            }
                        }

                        const effectiveCap = getEffectiveMonthlyTakeCap({
                            availableBalance: typeAvailableBalance,
                            usedThisMonth: usedDays,
                        });

                        if (usedDays + requestedSegmentDays > effectiveCap + epsilon) {
                            const monthName = monthStart.toLocaleString('default', { month: 'long' });
                            const remaining = Math.max(0, roundDays(typeAvailableBalance));
                            errors.push(
                                `Insufficient ${leaveTypeConfig.displayName} leave for ${monthName}. ` +
                                    `Available to take: ${remaining} days (includes manual/imported stock and unused accrual).`
                            );
                        }
                    }

                    monthCursor.setMonth(monthCursor.getMonth() + 1);
                }
            }

            // 9. Check for overlapping leaves
            const overlapCheck = await this.checkOverlappingLeaves(
                employeeId, 
                startDate, 
                endDate, 
                organizationId
            );
            if (!overlapCheck.allowed) {
                errors.push(overlapCheck.reason);
            }

            // 10. Sick Leave: medical document required when monthly total exceeds 1 day
            if (normalizedType === 'sick') {
                const hasDocument = typeof leaveData.document === 'string'
                    ? leaveData.document.trim().length > 0
                    : Boolean(leaveData.document);

                if (!hasDocument) {
                    const epsilon = 1e-9;
                    const firstMonth = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                    const lastMonth = new Date(endDate.getFullYear(), endDate.getMonth() + 1, 0, 23, 59, 59, 999);

                    const sickLeaves = await Leave.find({
                        organizationId,
                        employee: employeeId,
                        leaveType: 'sick',
                        status: { $in: ['pending', 'approved'] },
                        startDate: { $lte: lastMonth },
                        endDate: { $gte: firstMonth }
                    });

                    const totalLeaveDaysCache = new Map();
                    for (const l of sickLeaves) {
                        const totalLeaveDaysCounted = await this.calculateDuration(
                            new Date(l.startDate),
                            new Date(l.endDate),
                            policy.dateHandlingRules,
                            calendar,
                            organizationId
                        );
                        totalLeaveDaysCache.set(String(l._id), totalLeaveDaysCounted);
                    }

                    const firstMonthCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
                    const lastMonthCursor = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
                    const monthCursor = new Date(firstMonthCursor);
                    let documentRequired = false;

                    while (monthCursor.getTime() <= lastMonthCursor.getTime() && !documentRequired) {
                        const monthStart = new Date(monthCursor.getFullYear(), monthCursor.getMonth(), 1);
                        const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0, 23, 59, 59, 999);
                        const segmentStart = new Date(Math.max(startDate.getTime(), monthStart.getTime()));
                        const segmentEnd = new Date(Math.min(endDate.getTime(), monthEnd.getTime()));

                        if (segmentStart.getTime() <= segmentEnd.getTime()) {
                            const requestedSegmentDays = leaveData.isHalfDay
                                ? 0.5
                                : await this.calculateDuration(
                                    segmentStart,
                                    segmentEnd,
                                    policy.dateHandlingRules,
                                    calendar,
                                    organizationId
                                );

                            let usedDays = 0;
                            for (const l of sickLeaves) {
                                const lStart = new Date(l.startDate);
                                const lEnd = new Date(l.endDate);
                                if (lEnd.getTime() < monthStart.getTime() || lStart.getTime() > monthEnd.getTime()) {
                                    continue;
                                }

                                const overlapStart = new Date(Math.max(lStart.getTime(), monthStart.getTime()));
                                const overlapEnd = new Date(Math.min(lEnd.getTime(), monthEnd.getTime()));
                                if (overlapStart.getTime() > overlapEnd.getTime()) continue;

                                const totalLeaveDaysCounted = totalLeaveDaysCache.get(String(l._id)) ?? 0;
                                const overlapWorkingDays = await this.calculateDuration(
                                    overlapStart,
                                    overlapEnd,
                                    policy.dateHandlingRules,
                                    calendar,
                                    organizationId
                                );

                                if (totalLeaveDaysCounted > 0) {
                                    const ratio = overlapWorkingDays / totalLeaveDaysCounted;
                                    usedDays += (Number(l.duration) || 0) * ratio;
                                }
                            }

                            if (usedDays + requestedSegmentDays > 1 + epsilon) {
                                documentRequired = true;
                            }
                        }

                        monthCursor.setMonth(monthCursor.getMonth() + 1);
                    }

                    if (documentRequired) {
                        errors.push(
                            'Medical certificate is required when Sick Leave exceeds 1 day in a calendar month.'
                        );
                    }
                }
            }

            return {
                valid: errors.length === 0,
                errors,
                warnings,
                duration,
                workingDays
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
                return { allowed: true, available: null };
            }
            const year = Number.isFinite(balanceYear) ? balanceYear : new Date().getFullYear();
            const balance = await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);
            if (!balance) return { allowed: true, available: null };
            const typeBalance = balance.balances.find(b => b.leaveType === leaveType);
            if (!typeBalance) return { allowed: true, available: null };
            const required = isHalfDay ? 0.5 : requestedDays;
            const available = Number(typeBalance.available) || 0;
            if (available < required) {
                return {
                    allowed: false,
                    available,
                    reason: `Insufficient leave balance. Available: ${available} days, Requested: ${required} days`
                };
            }
            return { allowed: true, available };
        } catch (err) {
            logger.warn('Leave balance check error', { employeeId, leaveType, error: err.message });
            return { allowed: true, available: null };
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
     * Pending + approved leave days of a type that fall in a calendar month.
     * Matches the monthly cap logic in validateLeaveRequest (section 8).
     */
    async countMonthlyUsageForLeaveType(employeeId, organizationId, policy, leaveTypeConfig, monthStart, monthEnd) {
        const calendar = await Calendar.findOne({
            organizationId,
            year: monthStart.getFullYear()
        });

        const candidateLeaves = await Leave.find({
            organizationId,
            employee: employeeId,
            leaveType: { $in: getLeaveTypeVariantsForBalance(leaveTypeConfig.type) },
            status: { $in: ['pending', 'approved'] },
            startDate: { $lte: monthEnd },
            endDate: { $gte: monthStart }
        });

        const totalLeaveDaysCache = new Map();
        for (const l of candidateLeaves) {
            const lStart = new Date(l.startDate);
            const lEnd = new Date(l.endDate);
            const totalLeaveDaysCounted = await this.calculateDuration(
                lStart,
                lEnd,
                policy.dateHandlingRules,
                calendar,
                organizationId
            );
            totalLeaveDaysCache.set(String(l._id), totalLeaveDaysCounted);
        }

        let usedDays = 0;
        for (const l of candidateLeaves) {
            const lStart = new Date(l.startDate);
            const lEnd = new Date(l.endDate);
            if (lEnd.getTime() < monthStart.getTime() || lStart.getTime() > monthEnd.getTime()) {
                continue;
            }
            const overlapStart = new Date(Math.max(lStart.getTime(), monthStart.getTime()));
            const overlapEnd = new Date(Math.min(lEnd.getTime(), monthEnd.getTime()));
            if (overlapStart.getTime() > overlapEnd.getTime()) continue;

            const totalLeaveDaysCounted = totalLeaveDaysCache.get(String(l._id)) ?? 0;
            const overlapWorkingDays = await this.calculateDuration(
                overlapStart,
                overlapEnd,
                policy.dateHandlingRules,
                calendar,
                organizationId
            );

            if (totalLeaveDaysCounted > 0) {
                const ratio = overlapWorkingDays / totalLeaveDaysCounted;
                usedDays += (Number(l.duration) || 0) * ratio;
            }
        }

        return usedDays;
    }

    /**
     * Per leave type: monthly entitlement, YTD balance, and appliable days this month.
     * Includes types with maxDaysPerMonth or monthly accrual on the active policy.
     */
    async getMonthlyLeaveCapSummary(employeeId, organizationId, year, month) {
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return { year, month, monthLabel: '', types: [] };
        }
        const monthStart = new Date(year, month - 1, 1);
        const policy = await this.getApplicablePolicy(employee, organizationId, monthStart);
        if (!policy) {
            return { year, month, monthLabel: '', types: [] };
        }

        const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);
        const monthLabel = monthStart.toLocaleString('en-IN', { month: 'long', year: 'numeric' });

        let balanceRecord = null;
        try {
            balanceRecord = await leaveBalanceEngine.calculateBalance(employeeId, year, organizationId);
        } catch (e) {
            logger.warn('getMonthlyLeaveCapSummary: balance fetch failed', {
                employeeId,
                error: e.message
            });
        }

        const types = [];
        for (const lt of policy.leaveTypes || []) {
            if (!hasMonthlyEntitlement(lt)) {
                continue;
            }

            const monthlyEntitlement = getMonthlyEntitlementAmount(lt);
            const monthlyTakeCap = Number(lt.maxDaysPerMonth) > 0 ? Number(lt.maxDaysPerMonth) : null;

            const usedThisMonth = await this.countMonthlyUsageForLeaveType(
                employeeId,
                organizationId,
                policy,
                lt,
                monthStart,
                monthEnd
            );

            const typeBalance = balanceRecord?.balances?.find((b) => b.leaveType === lt.type);
            const availableBalance = typeBalance?.available ?? 0;
            const accruedYtd = typeBalance?.accrued ?? 0;
            const manualStock = Number(typeBalance?.manualStock) || 0;
            const monthlyTakeLimit = getEffectiveMonthlyTakeCap({
                availableBalance,
                usedThisMonth,
            });
            const remainingTakeCap = getRemainingMonthlyTakeCap(
                monthlyTakeCap,
                usedThisMonth,
                availableBalance
            );
            const appliableThisMonth = getAppliableDaysThisMonth({
                availableBalance,
                maxDaysPerMonth: monthlyTakeLimit,
                usedThisMonth
            });

            types.push({
                leaveType: lt.type,
                displayName: lt.displayName || lt.type,
                monthlyEntitlement,
                yearlyEntitlementCap: getYearlyAccrualCap(lt),
                maxDaysPerMonth: monthlyTakeLimit,
                policyMaxDaysPerMonth: monthlyTakeCap,
                manualStock: roundDays(manualStock),
                usedThisMonth: roundDays(usedThisMonth),
                remainingThisMonth: remainingTakeCap ?? appliableThisMonth,
                availableBalance: roundDays(availableBalance),
                accruedYtd: roundDays(accruedYtd),
                appliableThisMonth
            });
        }

        return { year, month, monthLabel, types };
    }

    /**
     * Get applicable policy for employee on asOfDate (effectiveDate / expiryDate window).
     */
    async getApplicablePolicy(employee, organizationId, asOfDate = new Date()) {
        const policies = await LeavePolicy.find({
            organizationId,
            isActive: true,
        }).sort({ effectiveDate: -1 });

        const normalized = policies.map((policy) => {
            const plain = typeof policy.toObject === 'function' ? policy.toObject() : { ...policy };
            return {
                ...plain,
                leaveTypes: normalizePolicyLeaveTypes(plain.leaveTypes),
            };
        });

        return selectApplicableLeavePolicy(normalized, employee, asOfDate || new Date());
    }

    /**
     * Check if policy is applicable to employee
     */
    isPolicyApplicable(policy, employee) {
        return isLeavePolicyApplicableToEmployee(policy, employee);
    }
}

export default new LeaveValidationService();

