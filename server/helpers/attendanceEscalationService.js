/**
 * Attendance Escalation Service
 * Tracks infractions and applies escalation logic
 */

import logger from './logger.js';
import { notifyEscalation } from './attendanceNotificationService.js';
import { getCache, setCache } from './cache.js';

// Cache escalation data for 30 days
const ESCALATION_CACHE_TTL = 30 * 24 * 60 * 60; // 30 days

/**
 * Track attendance infraction
 * @param {Object} params - Infraction parameters
 * @param {string} params.employeeId - Employee ID
 * @param {string} params.infractionType - Type of infraction (late_arrival, early_departure, absence)
 * @param {Date} params.date - Date of infraction
 * @param {Object} params.metadata - Additional metadata
 * @returns {Promise<Object>} - Escalation result
 */
export const trackInfraction = async ({ employeeId, infractionType, date, metadata = {} }) => {
    try {
        const cacheKey = `attendance_infractions:${employeeId}:${infractionType}`;
        
        // Get existing infractions
        let infractions = await getCache(cacheKey) || [];
        
        // Add new infraction
        infractions.push({
            date: date.toISOString(),
            timestamp: new Date(),
            metadata
        });

        // Keep only last 90 days
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - 90);
        infractions = infractions.filter(inf => new Date(inf.date) >= cutoffDate);

        // Update cache
        await setCache(cacheKey, infractions, ESCALATION_CACHE_TTL);

        // Count infractions in different time periods
        const now = new Date();
        const last7Days = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const count7Days = infractions.filter(inf => new Date(inf.date) >= last7Days).length;
        const count30Days = infractions.filter(inf => new Date(inf.date) >= last30Days).length;
        const totalCount = infractions.length;

        // Determine escalation level
        const escalationLevel = determineEscalationLevel({
            count7Days,
            count30Days,
            totalCount,
            infractionType
        });

        // Get employee data for notification
        const Employee = (await import('../models/employee.model.js')).default;
        const employee = await Employee.findById(employeeId).select('name email department').lean();

        // Send escalation notification if needed
        if (escalationLevel !== 'none' && employee) {
            await notifyEscalation({
                employee,
                infractionType,
                count: count7Days > 0 ? count7Days : count30Days,
                escalationLevel
            });
        }

        return {
            infractionCount: {
                last7Days: count7Days,
                last30Days: count30Days,
                total: totalCount
            },
            escalationLevel,
            requiresAction: escalationLevel !== 'none'
        };

    } catch (error) {
        logger.error('Track infraction error', {
            error: error.message,
            employeeId,
            infractionType,
            stack: error.stack
        });

        return {
            infractionCount: {
                last7Days: 0,
                last30Days: 0,
                total: 0
            },
            escalationLevel: 'none',
            requiresAction: false,
            error: error.message
        };
    }
};

/**
 * Determine escalation level based on infraction counts
 * @param {Object} params - Count parameters
 * @param {number} params.count7Days - Infractions in last 7 days
 * @param {number} params.count30Days - Infractions in last 30 days
 * @param {number} params.totalCount - Total infractions
 * @param {string} params.infractionType - Type of infraction
 * @returns {string} - Escalation level
 */
function determineEscalationLevel({ count7Days, count30Days, totalCount, infractionType }) {
    // Escalation thresholds (configurable)
    const thresholds = {
        warning: {
            count7Days: 2,
            count30Days: 5
        },
        strict_warning: {
            count7Days: 4,
            count30Days: 10
        },
        suspension: {
            count7Days: 6,
            count30Days: 15
        }
    };

    // Check suspension level
    if (count7Days >= thresholds.suspension.count7Days || 
        count30Days >= thresholds.suspension.count30Days) {
        return 'suspension';
    }

    // Check strict warning level
    if (count7Days >= thresholds.strict_warning.count7Days || 
        count30Days >= thresholds.strict_warning.count30Days) {
        return 'strict_warning';
    }

    // Check warning level
    if (count7Days >= thresholds.warning.count7Days || 
        count30Days >= thresholds.warning.count30Days) {
        return 'warning';
    }

    return 'none';
}

/**
 * Get infraction history for employee
 * @param {string} employeeId - Employee ID
 * @param {string} infractionType - Type of infraction (optional)
 * @returns {Promise<Object>} - Infraction history
 */
export const getInfractionHistory = async (employeeId, infractionType = null) => {
    try {
        const types = infractionType 
            ? [infractionType] 
            : ['late_arrival', 'early_departure', 'absence'];

        const history = {};

        for (const type of types) {
            const cacheKey = `attendance_infractions:${employeeId}:${type}`;
            const infractions = await getCache(cacheKey) || [];
            
            history[type] = {
                count: infractions.length,
                infractions: infractions.map(inf => ({
                    date: inf.date,
                    timestamp: inf.timestamp,
                    metadata: inf.metadata
                }))
            };
        }

        return history;
    } catch (error) {
        logger.error('Get infraction history error', {
            error: error.message,
            employeeId,
            stack: error.stack
        });

        return {};
    }
};

/**
 * Reset infractions for employee (admin action)
 * @param {string} employeeId - Employee ID
 * @param {string} infractionType - Type of infraction (optional, null = all)
 * @returns {Promise<Object>} - Reset result
 */
export const resetInfractions = async (employeeId, infractionType = null) => {
    try {
        const types = infractionType 
            ? [infractionType] 
            : ['late_arrival', 'early_departure', 'absence'];

        for (const type of types) {
            const cacheKey = `attendance_infractions:${employeeId}:${type}`;
            await setCache(cacheKey, [], ESCALATION_CACHE_TTL);
        }

        logger.info('Infractions reset', {
            employeeId,
            infractionType: infractionType || 'all'
        });

        return {
            success: true,
            message: 'Infractions reset successfully'
        };
    } catch (error) {
        logger.error('Reset infractions error', {
            error: error.message,
            employeeId,
            stack: error.stack
        });

        return {
            success: false,
            message: 'Failed to reset infractions'
        };
    }
};

