/**
 * Attendance Notification Service
 * Sends notifications for penalties, escalations, and attendance events
 * Now uses centralized Notification Manager
 */

import logger from './logger.js';
import { notify } from './notificationManager.js';
import './notificationEventRegistry.js';
import { sendWelcomeEmail } from './emailSender.js';

/**
 * Send late arrival notification
 * @param {Object} params - Notification parameters
 * @param {Object} params.employee - Employee object
 * @param {Date} params.clockInTime - Clock-in time
 * @param {Date} params.expectedTime - Expected clock-in time
 * @param {Object} params.rule - Attendance rule
 * @param {number} params.lateMinutes - Minutes late
 * @returns {Promise<void>}
 */
export const notifyLateArrival = async ({ employee, clockInTime, expectedTime, rule, lateMinutes }) => {
    try {
        const subject = `Late Arrival Alert - ${employee.name || 'Employee'}`;

        // Notify employee using centralized manager
        await notify({
            type: 'late_arrival',
            organizationId: employee.organizationId,
            data: {
                employee,
                clockInTime,
                expectedTime,
                rule,
                lateMinutes
            }
        });

        // Send email if configured
        if (employee.email) {
            try {
                await sendWelcomeEmail(
                    employee.email,
                    employee.name || 'Employee',
                    '', // No password needed
                    {
                        subject,
                        html: `
                            <h2>Late Arrival Notification</h2>
                            <p>${message}</p>
                            <p><strong>Action:</strong> ${rule.penaltyRules?.lateArrival?.action || 'warning'}</p>
                            <p>Please ensure you arrive on time to avoid further penalties.</p>
                        `
                    }
                );
            } catch (emailError) {
                logger.warn('Failed to send late arrival email', {
                    error: emailError.message,
                    employeeId: employee._id
                });
            }
        }

        // Notify HR/Manager if escalation needed
        if (rule.penaltyRules?.lateArrival?.action === 'mark_absent' || lateMinutes > 60) {
            await notifyHR({
                employee,
                event: 'late_arrival',
                message: `${employee.name} checked in ${lateMinutes} minutes late`,
                severity: 'high'
            });
        }

        logger.info('Late arrival notification sent', {
            employeeId: employee._id,
            lateMinutes
        });
    } catch (error) {
        logger.error('Late arrival notification error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });
    }
};

/**
 * Send early departure notification
 * @param {Object} params - Notification parameters
 * @param {Object} params.employee - Employee object
 * @param {Date} params.clockOutTime - Clock-out time
 * @param {Date} params.expectedTime - Expected clock-out time
 * @param {Object} params.rule - Attendance rule
 * @param {number} params.earlyMinutes - Minutes early
 * @returns {Promise<void>}
 */
export const notifyEarlyDeparture = async ({ employee, clockOutTime, expectedTime, rule, earlyMinutes }) => {
    try {
        const subject = `Early Departure Alert - ${employee.name || 'Employee'}`;

        // Notify employee using centralized manager
        await notify({
            type: 'early_departure',
            organizationId: employee.organizationId,
            data: {
                employee,
                clockOutTime,
                expectedTime,
                rule,
                earlyMinutes
            }
        });

        // Send email if configured
        if (employee.email) {
            try {
                await sendWelcomeEmail(
                    employee.email,
                    employee.name || 'Employee',
                    '',
                    {
                        subject,
                        html: `
                            <h2>Early Departure Notification</h2>
                            <p>${message}</p>
                            <p><strong>Action:</strong> ${rule.penaltyRules?.earlyDeparture?.action || 'warning'}</p>
                            <p>Please ensure you complete your full working hours.</p>
                        `
                    }
                );
            } catch (emailError) {
                logger.warn('Failed to send early departure email', {
                    error: emailError.message,
                    employeeId: employee._id
                });
            }
        }

        logger.info('Early departure notification sent', {
            employeeId: employee._id,
            earlyMinutes
        });
    } catch (error) {
        logger.error('Early departure notification error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });
    }
};

/**
 * Send GPS spoofing alert
 * @param {Object} params - Alert parameters
 * @param {Object} params.employee - Employee object
 * @param {Object} params.gpsLocation - GPS coordinates
 * @param {Object} params.ipLocation - IP-based location
 * @param {number} params.distanceKm - Distance between GPS and IP location
 * @returns {Promise<void>}
 */
export const notifyGPSSpoofing = async ({ employee, gpsLocation, ipLocation, distanceKm }) => {
    try {
        const message = `GPS spoofing detected: GPS location (${gpsLocation.latitude}, ${gpsLocation.longitude}) is ${distanceKm.toFixed(2)}km away from IP location (${ipLocation.city}, ${ipLocation.country}).`;

        // Notify HR/Admin immediately
        await notifyHR({
            employee,
            event: 'gps_spoofing',
            message: message,
            severity: 'critical',
            metadata: {
                gpsLocation,
                ipLocation,
                distanceKm
            }
        });

        // Log security alert
        logger.warn('GPS spoofing detected', {
            employeeId: employee._id,
            employeeName: employee.name,
            gpsLocation,
            ipLocation,
            distanceKm
        });
    } catch (error) {
        logger.error('GPS spoofing notification error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });
    }
};

/**
 * Send location validation failure notification
 * @param {Object} params - Notification parameters
 * @param {Object} params.employee - Employee object
 * @param {string} params.reason - Failure reason
 * @param {string} params.message - Failure message
 * @returns {Promise<void>}
 */
export const notifyLocationValidationFailure = async ({ employee, reason, message }) => {
    try {
        await notify({
            type: 'location_validation_failed',
            organizationId: employee.organizationId,
            recipients: [employee._id],
            title: 'Location Validation Failed',
            message,
            priority: 'high',
            data: {
                employee,
                reason,
                timestamp: new Date()
            }
        });

        logger.info('Location validation failure notification sent', {
            employeeId: employee._id,
            reason
        });
    } catch (error) {
        logger.error('Location validation notification error', {
            error: error.message,
            employeeId: employee?._id
        });
    }
};

/**
 * Notify HR/Manager about attendance events
 * @param {Object} params - Notification parameters
 * @param {Object} params.employee - Employee object
 * @param {string} params.event - Event type
 * @param {string} params.message - Message
 * @param {string} params.severity - Severity level
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<void>}
 */
const notifyHR = async ({ employee, event, message, severity = 'medium', metadata = {} }) => {
    try {
        // TODO: Get HR/Manager users for the organization
        // For now, log the notification
        logger.info('HR notification', {
            employeeId: employee._id,
            employeeName: employee.name,
            event,
            message,
            severity,
            metadata
        });

        // In production, this would:
        // 1. Query for HR/Manager users in the organization
        // 2. Send notifications to all relevant users
        // 3. Send email alerts for critical events
    } catch (error) {
        logger.error('HR notification error', {
            error: error.message,
            event,
            stack: error.stack
        });
    }
};

/**
 * Send escalation notification for repeated infractions
 * @param {Object} params - Escalation parameters
 * @param {Object} params.employee - Employee object
 * @param {string} params.infractionType - Type of infraction
 * @param {number} params.count - Number of occurrences
 * @param {string} params.escalationLevel - Escalation level
 * @returns {Promise<void>}
 */
export const notifyEscalation = async ({ employee, infractionType, count, escalationLevel }) => {
    try {
        const severity = escalationLevel === 'suspension' ? 'critical' : 'high';
        const title = `Attendance Escalation - ${escalationLevel.toUpperCase()}`;
        const message = `${employee.name} has ${infractionType} ${count} time(s). Escalation level: ${escalationLevel}.`;

        // Notify employee
        await sendNotification({
            userId: employee._id,
            title: title,
            message: `You have been escalated to ${escalationLevel} level due to repeated ${infractionType}.`,
            type: 'attendance_escalation',
            priority: severity,
            metadata: {
                infractionType,
                count,
                escalationLevel
            }
        });

        // Notify HR/Manager
        await notifyHR({
            employee,
            event: 'escalation',
            message: message,
            severity: severity,
            metadata: {
                infractionType,
                count,
                escalationLevel
            }
        });

        logger.warn('Attendance escalation notification sent', {
            employeeId: employee._id,
            infractionType,
            count,
            escalationLevel
        });
    } catch (error) {
        logger.error('Escalation notification error', {
            error: error.message,
            employeeId: employee?._id,
            stack: error.stack
        });
    }
};

