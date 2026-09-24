/**
 * Push Notification Triggers
 * Helper functions to send push notifications for key events
 */

import { sendPushNotification, createPushPayload, isPushEnabledForUser } from './pushNotificationService.js';
import logger from './logger.js';

/**
 * Send push notification when payroll is released/made visible
 * @param {string} employeeId - Employee ID
 * @param {Object} payrollData - Payroll data
 * @param {string} organizationId - Organization ID
 */
export const notifyPayrollReleased = async (employeeId, payrollData, organizationId) => {
    try {
        if (!(await isPushEnabledForUser(employeeId))) return;
        const message = `Your payroll for ${payrollData.month} ${payrollData.year} has been released. Net Salary: $${(payrollData.inHandSalary || 0).toFixed(2)}`;
        const payload = createPushPayload(message, 'payroll', {
            payrollId: payrollData._id?.toString(),
            month: payrollData.month,
            year: payrollData.year,
            amount: payrollData.inHandSalary,
        });

        const result = await sendPushNotification(employeeId, 'Employee', payload, organizationId);
        logger.info('Payroll release push sent', {
            employeeId,
            payrollId: payrollData._id,
            sent: result.sent,
            failed: result.failed,
        });
    } catch (error) {
        logger.error('Failed to send payroll release push', {
            employeeId,
            error: error.message
        });
    }
};

/**
 * Send push notification when leave is approved
 * @param {string} employeeId - Employee ID
 * @param {Object} leaveData - Leave data
 * @param {string} organizationId - Organization ID
 */
export const notifyLeaveApproved = async (employeeId, leaveData, organizationId) => {
    try {
        if (!(await isPushEnabledForUser(employeeId))) return;
        const message = `Your leave request for ${leaveData.leaveType} (${leaveData.startDate} to ${leaveData.endDate}) has been approved.`;
        const payload = createPushPayload(message, 'leave', {
            leaveId: leaveData._id?.toString(),
            leaveType: leaveData.leaveType,
            status: 'approved',
            startDate: leaveData.startDate,
            endDate: leaveData.endDate
        });

        const result = await sendPushNotification(employeeId, 'Employee', payload, organizationId);
        logger.info('Leave approval push sent', {
            employeeId,
            leaveId: leaveData._id,
            sent: result.sent,
            failed: result.failed
        });
    } catch (error) {
        logger.error('Failed to send leave approval push', {
            employeeId,
            error: error.message
        });
    }
};

/**
 * Send push notification when leave is rejected
 * @param {string} employeeId - Employee ID
 * @param {Object} leaveData - Leave data
 * @param {string} organizationId - Organization ID
 */
export const notifyLeaveRejected = async (employeeId, leaveData, organizationId) => {
    try {
        if (!(await isPushEnabledForUser(employeeId))) return;
        const message = `Your leave request for ${leaveData.leaveType} (${leaveData.startDate} to ${leaveData.endDate}) has been rejected.`;
        const payload = createPushPayload(message, 'leave', {
            leaveId: leaveData._id?.toString(),
            leaveType: leaveData.leaveType,
            status: 'rejected',
            startDate: leaveData.startDate,
            endDate: leaveData.endDate
        });

        const result = await sendPushNotification(employeeId, 'Employee', payload, organizationId);
        logger.info('Leave rejection push sent', {
            employeeId,
            leaveId: leaveData._id,
            sent: result.sent,
            failed: result.failed
        });
    } catch (error) {
        logger.error('Failed to send leave rejection push', {
            employeeId,
            error: error.message
        });
    }
};

/**
 * Send push notification when task is assigned
 * @param {string} employeeId - Employee ID
 * @param {Object} taskData - Task data
 * @param {string} organizationId - Organization ID
 */
export const notifyTaskAssigned = async (employeeId, taskData, organizationId) => {
    try {
        if (!(await isPushEnabledForUser(employeeId))) return;
        const message = `A new task "${taskData.title}" has been assigned to you.`;
        const payload = createPushPayload(message, 'task', {
            taskId: taskData._id?.toString(),
            title: taskData.title,
            projectId: taskData.projectId?.toString(),
            dueDate: taskData.dueDate,
            priority: taskData.priority,
        });

        const result = await sendPushNotification(employeeId, 'Employee', payload, organizationId);
        logger.info('Task assignment push sent', {
            employeeId,
            taskId: taskData._id,
            sent: result.sent,
            failed: result.failed,
        });
    } catch (error) {
        logger.error('Failed to send task assignment push', {
            employeeId,
            error: error.message
        });
    }
};

export default {
    notifyPayrollReleased,
    notifyLeaveApproved,
    notifyLeaveRejected,
    notifyTaskAssigned
};
