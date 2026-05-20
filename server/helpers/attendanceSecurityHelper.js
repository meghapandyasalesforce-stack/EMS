/**
 * Attendance Security Helper
 * Centralized helper functions for attendance security validations
 */

import { validateLocation, handleGPSFailure } from './locationValidationService.js';
import { generateDeviceFingerprint, validateDeviceFingerprint } from './deviceFingerprintService.js';
import { trackInfraction } from './attendanceEscalationService.js';
import { notifyLateArrival, notifyEarlyDeparture, notifyGPSSpoofing, notifyLocationValidationFailure } from './attendanceNotificationService.js';
import { getCache, setCache } from './cache.js';
import logger from './logger.js';
import AttendanceRule from '../models/attendanceRule.model.js';
import { DateTime } from 'luxon';
import { combineDateAndTimeInTimezone, normalizeTimezone } from './timezoneHelper.js';
import { resolveEffectiveTimezone } from './organizationTimezoneService.js';
import Organization from '../models/organization.model.js';

// Cache active rules for 5 minutes
const RULE_CACHE_TTL = 5 * 60; // 5 minutes

/**
 * Get active attendance rule with caching and priority
 * @param {string} organizationId - Organization ID
 * @param {Object} employee - Employee object (for exception checking)
 * @returns {Promise<Object|null>} - Active attendance rule or null
 */
export const getActiveAttendanceRule = async (organizationId, employee = null) => {
    try {
        const cacheKey = `attendance_rule:${organizationId}:active`;
        
        // Check cache
        const cached = await getCache(cacheKey);
        if (cached) {
            return cached;
        }

        const now = new Date();
        
        // Get active rule with priority and lifecycle check
        const rule = await AttendanceRule.findOne({
            organizationId,
            isActive: true,
            effectiveDate: { $lte: now },
            $or: [
                { expiryDate: null },
                { expiryDate: { $gte: now } }
            ]
        })
        .sort({ priority: -1, createdAt: -1 })
        .lean();

        // Cache result
        if (rule) {
            await setCache(cacheKey, rule, RULE_CACHE_TTL);
        }

        return rule;
    } catch (error) {
        logger.error('Get active attendance rule error', {
            error: error.message,
            organizationId,
            stack: error.stack
        });
        return null;
    }
};

/**
 * Check if employee is exempt from attendance rules
 * @param {Object} employee - Employee object
 * @param {Object} rule - Attendance rule
 * @returns {boolean} - True if exempt
 */
export const isEmployeeExempt = (employee, rule) => {
    if (!rule || !employee) return false;

    const exceptions = rule.exceptions || {};

    // Check exempt employees
    if (exceptions.exemptEmployees?.length > 0) {
        const employeeId = employee._id?.toString() || employee.toString();
        if (exceptions.exemptEmployees.some(id => id.toString() === employeeId)) {
            return true;
        }
    }

    // Check exempt roles
    if (exceptions.exemptRoles?.length > 0) {
        const employeeRole = employee.role?.toLowerCase();
        if (exceptions.exemptRoles.some(role => role.toLowerCase() === employeeRole)) {
            return true;
        }
    }

    // Check exempt departments
    if (exceptions.exemptDepartments?.length > 0) {
        const employeeDept = employee.department?.toLowerCase();
        if (exceptions.exemptDepartments.some(dept => dept.toLowerCase() === employeeDept)) {
            return true;
        }
    }

    return false;
};

/**
 * Get custom radius for employee (if configured)
 * @param {Object} employee - Employee object
 * @param {Object} rule - Attendance rule
 * @returns {number|null} - Custom radius or null
 */
export const getCustomRadius = (employee, rule) => {
    if (!rule || !employee) return null;

    const exceptions = rule.exceptions || {};
    const customRadiusEmployees = exceptions.customRadiusEmployees || [];

    const employeeId = employee._id?.toString() || employee.toString();
    const custom = customRadiusEmployees.find(
        item => item.employeeId?.toString() === employeeId
    );

    return custom?.customRadius || null;
};

/**
 * Validate attendance location with all security checks
 * @param {Object} params - Validation parameters
 * @param {Object} params.employee - Employee object
 * @param {Object} params.locationInfo - Location information
 * @param {string} params.ipAddress - Client IP address
 * @param {Object} params.rule - Attendance rule
 * @param {string} params.deviceFingerprint - Device fingerprint (optional)
 * @returns {Promise<Object>} - Validation result
 */
export const validateAttendanceLocation = async ({
    employee,
    locationInfo,
    ipAddress,
    rule,
    deviceFingerprint
}) => {
    try {
        // 1. Check if employee is exempt
        if (isEmployeeExempt(employee, rule)) {
            return {
                isValid: true,
                exempt: true,
                reason: 'employee_exempt'
            };
        }

        // 2. Device fingerprinting validation
        if (rule?.security?.enableDeviceFingerprinting && deviceFingerprint) {
            const deviceValidation = await validateDeviceFingerprint(
                employee._id,
                deviceFingerprint,
                true // allow new devices
            );

            if (!deviceValidation.isValid) {
                return {
                    isValid: false,
                    reason: 'device_validation_failed',
                    message: deviceValidation.message,
                    requiresFallback: false
                };
            }
        }

        // 3. Get custom radius if configured
        const customRadius = getCustomRadius(employee, rule);
        const maximumRadius = customRadius || rule?.maximumRadius || 500;

        // 4. Handle GPS failure if coordinates missing
        if (!locationInfo.latitude || !locationInfo.longitude) {
            if (rule?.security?.allowIPFallback !== false && !rule?.enableSimplePunches) {
                const fallback = await handleGPSFailure({
                    ipAddress,
                    ruleCoordinates: rule?.coordinates,
                    maximumRadius,
                    allowIPFallback: true
                });

                return {
                    ...fallback,
                    locationSource: 'ip_fallback'
                };
            } else if (rule?.enableSimplePunches) {
                // Simple punches mode - location optional
                return {
                    isValid: true,
                    reason: 'simple_punches_mode',
                    locationSource: 'optional'
                };
            } else {
                return {
                    isValid: false,
                    reason: 'gps_required',
                    message: 'GPS location is required',
                    requiresFallback: false
                };
            }
        }

        // 5. Comprehensive location validation
        const validation = await validateLocation({
            latitude: locationInfo.latitude,
            longitude: locationInfo.longitude,
            accuracy: locationInfo.accuracy,
            ipAddress,
            ruleCoordinates: rule?.coordinates,
            maximumRadius,
            enableGPSValidation: rule?.security?.enableGPSValidation !== false,
            enableAccuracyCheck: true,
            minAccuracy: rule?.security?.minGPSAccuracy || 100,
            allowFallback: rule?.security?.allowIPFallback !== false
        });

        // 6. Handle GPS spoofing detection
        if (!validation.isValid && validation.securityAlert) {
            // Notify HR about spoofing attempt
            await notifyGPSSpoofing({
                employee,
                gpsLocation: {
                    latitude: locationInfo.latitude,
                    longitude: locationInfo.longitude
                },
                ipLocation: validation.details?.ipLocation,
                distanceKm: validation.details?.distanceKm
            });
        }

        return validation;

    } catch (error) {
        logger.error('Attendance location validation error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });

        return {
            isValid: false,
            reason: 'validation_error',
            message: 'Location validation error occurred',
            requiresFallback: rule?.security?.allowIPFallback !== false
        };
    }
};

/**
 * Process late arrival with penalties and notifications
 * @param {Object} params - Late arrival parameters
 * @param {Object} params.employee - Employee object
 * @param {Date} params.clockInTime - Clock-in time
 * @param {Date} params.expectedTime - Expected clock-in time
 * @param {Object} params.rule - Attendance rule
 * @returns {Promise<Object>} - Late arrival processing result
 */
export const processLateArrival = async ({ employee, clockInTime, expectedTime, rule }) => {
    try {
        if (!rule?.enablePenaltyRules || !rule?.penaltyRules?.lateArrival?.enabled) {
            return {
                isLate: false,
                action: null
            };
        }

        const lateMs = clockInTime - expectedTime;
        const lateMinutes = Math.floor(lateMs / (1000 * 60));

        if (lateMinutes <= 0) {
            return {
                isLate: false,
                action: null
            };
        }

        const action = rule.penaltyRules.lateArrival.action;

        // Track infraction for escalation
        await trackInfraction({
            employeeId: employee._id,
            infractionType: 'late_arrival',
            date: clockInTime,
            metadata: { lateMinutes }
        });

        // Send notification
        await notifyLateArrival({
            employee,
            clockInTime,
            expectedTime,
            rule,
            lateMinutes
        });

        return {
            isLate: true,
            lateMinutes,
            action,
            penaltyApplied: true
        };

    } catch (error) {
        logger.error('Process late arrival error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });

        return {
            isLate: false,
            action: null,
            error: error.message
        };
    }
};

/**
 * Process early departure with penalties and notifications
 * @param {Object} params - Early departure parameters
 * @param {Object} params.employee - Employee object
 * @param {Date} params.clockOutTime - Clock-out time
 * @param {Date} params.expectedTime - Expected clock-out time
 * @param {Object} params.rule - Attendance rule
 * @returns {Promise<Object>} - Early departure processing result
 */
export const processEarlyDeparture = async ({ employee, clockOutTime, expectedTime, rule }) => {
    try {
        if (!rule?.enablePenaltyRules || !rule?.penaltyRules?.earlyDeparture?.enabled) {
            return {
                isEarly: false,
                action: null
            };
        }

        const earlyMs = expectedTime - clockOutTime;
        const earlyMinutes = Math.floor(earlyMs / (1000 * 60));

        if (earlyMinutes <= 0) {
            return {
                isEarly: false,
                action: null
            };
        }

        const action = rule.penaltyRules.earlyDeparture.action;

        // Track infraction for escalation
        await trackInfraction({
            employeeId: employee._id,
            infractionType: 'early_departure',
            date: clockOutTime,
            metadata: { earlyMinutes }
        });

        // Send notification
        await notifyEarlyDeparture({
            employee,
            clockOutTime,
            expectedTime,
            rule,
            earlyMinutes
        });

        return {
            isEarly: true,
            earlyMinutes,
            action,
            penaltyApplied: true
        };

    } catch (error) {
        logger.error('Process early departure error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });

        return {
            isEarly: false,
            action: null,
            error: error.message
        };
    }
};

const DEFAULT_START = '09:00';
const DEFAULT_END = '17:00';

const parseHHmmParts = (timeStr, fallbackHour, fallbackMinute = 0) => {
    if (!timeStr || typeof timeStr !== 'string') {
        return { hour: fallbackHour, minute: fallbackMinute };
    }
    const parts = timeStr.split(':').map((p) => Number(String(p).trim()));
    const hour = Number.isFinite(parts[0]) ? parts[0] : fallbackHour;
    const minute = Number.isFinite(parts[1]) ? parts[1] : fallbackMinute;
    return { hour, minute };
};

/**
 * Scheduled open/close for a calendar day from attendance rule (office hours,
 * with sensible fallbacks to check-in/out config then defaults).
 * If end is not after start on the same day, end is moved to the next day (night shift).
 * @param {Object|null|undefined} rule - Attendance rule (lean doc or null)
 * @param {Date} date - Reference day
 * @returns {{ startTime: Date, endTime: Date, timezone: string }}
 */
export const resolveScheduledWorkWindow = (rule, date = new Date(), timezoneOverride = null) => {
    const timezone = normalizeTimezone(timezoneOverride || rule?.timezone || 'UTC');

    const oh = rule?.officeHours || {};
    const cit = rule?.checkInOutTimes || {};
    const startStr = oh.startTime || cit.checkInStartTime || DEFAULT_START;
    const endStr = oh.endTime || cit.checkOutStartTime || DEFAULT_END;

    const sh = parseHHmmParts(startStr, 9, 0);
    const eh = parseHHmmParts(endStr, 17, 0);

    const startTime = combineDateAndTimeInTimezone(
        date,
        `${String(sh.hour).padStart(2, '0')}:${String(sh.minute).padStart(2, '0')}`,
        timezone
    );
    let endTime = combineDateAndTimeInTimezone(
        date,
        `${String(eh.hour).padStart(2, '0')}:${String(eh.minute).padStart(2, '0')}`,
        timezone
    );

    if (endTime <= startTime) {
        endTime = DateTime.fromJSDate(endTime, { zone: timezone }).plus({ days: 1 }).toJSDate();
    }

    return {
        startTime,
        endTime,
        timezone,
    };
};

/**
 * Expected length of a full workday (hours) from rule office window.
 * @param {Object|null|undefined} rule
 * @param {Date} date
 * @returns {number}
 */
export const getExpectedWorkingHoursFromRule = (rule, date = new Date(), timezoneOverride = null) => {
    const { startTime, endTime } = resolveScheduledWorkWindow(rule, date, timezoneOverride);
    const hours = (endTime - startTime) / (1000 * 60 * 60);
    if (!Number.isFinite(hours) || hours <= 0) {
        return 8;
    }
    return Math.round(hours * 100) / 100;
};

/**
 * Latest clock-in time that still counts as on time (office start + grace when configured).
 */
export const getEffectiveOfficeStartForLate = (rule, date = new Date(), timezoneOverride = null) => {
    const { startTime: officeStart } = resolveScheduledWorkWindow(rule, date, timezoneOverride);
    if (rule?.enablePenaltyRules && rule?.penaltyRules?.lateArrival?.enabled) {
        const graceMinutes = Number(
            rule.penaltyRules.lateArrival.gracePeriod ||
                rule.checkInOutTimes?.checkInGracePeriod ||
                0
        );
        return new Date(officeStart.getTime() + graceMinutes * 60 * 1000);
    }
    if (rule?.checkInOutTimes?.checkInGracePeriod != null) {
        const graceMinutes = Number(rule.checkInOutTimes.checkInGracePeriod || 0);
        return new Date(officeStart.getTime() + graceMinutes * 60 * 1000);
    }
    return new Date(officeStart);
};

/**
 * Earliest clock-out that is not flagged as early departure (office end − grace when configured).
 */
export const getEffectiveOfficeEndForEarlyDeparture = (rule, date = new Date(), timezoneOverride = null) => {
    const { endTime: officeEnd } = resolveScheduledWorkWindow(rule, date, timezoneOverride);
    if (rule?.enablePenaltyRules && rule?.penaltyRules?.earlyDeparture?.enabled) {
        const graceMinutes = Number(rule.penaltyRules.earlyDeparture.gracePeriod || 0);
        return new Date(officeEnd.getTime() - graceMinutes * 60 * 1000);
    }
    return new Date(officeEnd);
};

/**
 * Get office hours with timezone support
 * @param {Object} rule - Attendance rule
 * @param {Date} date - Date to get hours for
 * @returns {Object} - Office start and end times
 */
export const getOfficeHours = async (rule, date = new Date(), organizationId = null) => {
    let effectiveTz = rule?.timezone || null;
    if (organizationId) {
        const org = await Organization.findById(organizationId).select('timezone').lean();
        effectiveTz = resolveEffectiveTimezone(org?.timezone, rule?.timezone);
    }
    const { startTime, endTime, timezone } = resolveScheduledWorkWindow(rule, date, effectiveTz);
    return {
        startTime,
        endTime,
        timezone,
    };
};

