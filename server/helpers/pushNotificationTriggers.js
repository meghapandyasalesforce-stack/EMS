/**
 * Push Notification Triggers
 * Helper functions to send push notifications for key events
 */

import { queuePushNotification } from './notificationQueue.js';
import logger from './logger.js';

/**
 * Send push notification when payroll is released/made visible
 * @param {string} employeeId - Employee ID
 * @param {Object} payrollData - Payroll data
 */
export const notifyPayrollReleased = async (employeeId, payrollData) => {
    try {
        const message = `Your payroll for ${payrollData.month} ${payrollData.year} has been released. Net Salary: $${(payrollData.inHandSalary || 0).toFixed(2)}`;
        await queuePushNotification(
            employeeId,
            'Employee',
            message,
            'payroll',
            {
                payrollId: payrollData._id?.toString(),
                month: payrollData.month,
                year: payrollData.year,
                amount: payrollData.inHandSalary
            }
        );
        logger.info('Payroll release notification queued', { employeeId, payrollId: payrollData._id });
    } catch (error) {
        logger.error('Failed to queue payroll release notification', {
            employeeId,
            error: error.message
        });
    }
};

/**
 * Send push notification when leave is approved
 * @param {string} employeeId - Employee ID
 * @param {Object} leaveData - Leave data
 */
export const notifyLeaveApproved = async (employeeId, leaveData) => {
    try {
        const message = `Your leave request for ${leaveData.leaveType} (${leaveData.startDate} to ${leaveData.endDate}) has been approved.`;
        await queuePushNotification(
            employeeId,
            'Employee',
            message,
            'leave',
            {
                leaveId: leaveData._id?.toString(),
                leaveType: leaveData.leaveType,
                status: 'approved',
                startDate: leaveData.startDate,
                endDate: leaveData.endDate
            }
        );
        logger.info('Leave approval notification queued', { employeeId, leaveId: leaveData._id });
    } catch (error) {
        logger.error('Failed to queue leave approval notification', {
            employeeId,
            error: error.message
        });
    }
};

/**
 * Send push notification when leave is rejected
 * @param {string} employeeId - Employee ID
 * @param {Object} leaveData - Leave data
 */
export const notifyLeaveRejected = async (employeeId, leaveData) => {
    try {
        const message = `Your leave request for ${leaveData.leaveType} (${leaveData.startDate} to ${leaveData.endDate}) has been rejected.`;
        await queuePushNotification(
            employeeId,
            'Employee',
            message,
            'leave',
            {
                leaveId: leaveData._id?.toString(),
                leaveType: leaveData.leaveType,
                status: 'rejected',
                startDate: leaveData.startDate,
                endDate: leaveData.endDate
            }
        );
        logger.info('Leave rejection notification queued', { employeeId, leaveId: leaveData._id });
    } catch (error) {
        logger.error('Failed to queue leave rejection notification', {
            employeeId,
            error: error.message
        });
    }
};

/**
 * Send push notification when task is assigned
 * @param {string} employeeId - Employee ID
 * @param {Object} taskData - Task data
 */
export const notifyTaskAssigned = async (employeeId, taskData) => {
    try {
        const message = `A new task "${taskData.title}" has been assigned to you.`;
        await queuePushNotification(
            employeeId,
            'Employee',
            message,
            'task',
            {
                taskId: taskData._id?.toString(),
                title: taskData.title,
                projectId: taskData.projectId?.toString(),
                dueDate: taskData.dueDate,
                priority: taskData.priority
            }
        );
        logger.info('Task assignment notification queued', { employeeId, taskId: taskData._id });
    } catch (error) {
        logger.error('Failed to queue task assignment notification', {
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

