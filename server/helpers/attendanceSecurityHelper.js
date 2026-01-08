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

/**
 * Get office hours with timezone support
 * @param {Object} rule - Attendance rule
 * @param {Date} date - Date to get hours for
 * @returns {Object} - Office start and end times
 */
export const getOfficeHours = (rule, date = new Date()) => {
    const timezone = rule?.timezone || 'UTC';
    const officeHours = rule?.officeHours || { startTime: '09:00', endTime: '17:00' };

    // Parse time strings (HH:mm format)
    const [startHour, startMinute] = officeHours.startTime.split(':').map(Number);
    const [endHour, endMinute] = officeHours.endTime.split(':').map(Number);

    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);

    const startTime = new Date(startOfDay);
    startTime.setHours(startHour, startMinute, 0);

    const endTime = new Date(startOfDay);
    endTime.setHours(endHour, endMinute, 0);

    // TODO: Apply timezone conversion if needed
    // For now, using server timezone

    return {
        startTime,
        endTime,
        timezone
    };
};

