import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import AttendanceRegularization from '../models/attendanceRegularization.model.js';
import logger from './logger.js';
import {
    persistThreadRootMessageId,
    resolveStoredThreadRootMessageId,
    THREAD_ROOT_REPLY_LOOKUP
} from './emailThreadPersistenceHelper.js';

/**
 * Get manager email and CC email addresses for attendance regularization notifications
 * @param {Object} employee - Employee document
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Object with managerEmail and ccEmails array
 */
export const getRegularizationNotificationEmails = async (employee, organizationId) => {
    try {
        const ccEmails = [];
        let managerEmail = null;

        // Get employee's assigned manager
        if (employee.managerId) {
            const manager = await Employee.findById(employee.managerId).select('email').lean();
            if (manager && manager.email) {
                managerEmail = manager.email;
            }
        }

        // If no managerId, try to find manager by name
        if (!managerEmail && employee.manager && employee.manager !== 'CEO') {
            const manager = await Employee.findOne({
                organizationId,
                $or: [
                    { name: new RegExp(`^${employee.manager}$`, 'i') },
                    { $expr: { $eq: [{ $concat: ['$name', ' ', '$lastName'] }, employee.manager] } }
                ],
                status: 'active'
            }).select('email').lean();
            
            if (manager && manager.email) {
                managerEmail = manager.email;
            }
        }

        // Get HR employees for CC
        const hrEmployees = await Employee.find({
            organizationId,
            $or: [
                { functionalRoles: { $in: ['hr', 'HR'] } },
                { department: { $regex: /hr/i } },
                { jobTitle: { $regex: /hr/i } },
                { position: { $regex: /hr/i } }
            ],
            status: 'active',
            email: { $exists: true, $ne: null }
        }).select('email').lean();

        hrEmployees.forEach(hr => {
            if (hr.email && hr.email !== managerEmail && !ccEmails.includes(hr.email)) {
                ccEmails.push(hr.email);
            }
        });

        // Get Admin users for CC
        const adminUsers = await User.find({
            organizationId,
            role: 'admin',
            isActive: true,
            email: { $exists: true, $ne: null }
        }).select('email').lean();

        adminUsers.forEach(admin => {
            if (admin.email && admin.email !== managerEmail && !ccEmails.includes(admin.email)) {
                ccEmails.push(admin.email);
            }
        });

        // Remove duplicates
        const uniqueCcEmails = [...new Set(ccEmails)];

        logger.info('Attendance regularization notification emails retrieved', {
            employeeId: employee._id,
            managerEmail: managerEmail ? '***' + managerEmail.split('@')[1] : 'Not found',
            ccCount: uniqueCcEmails.length,
            ccEmails: uniqueCcEmails.map(e => '***' + e.split('@')[1])
        });

        return {
            managerEmail,
            ccEmails: uniqueCcEmails
        };
    } catch (error) {
        logger.error('Error getting regularization notification emails', {
            employeeId: employee._id,
            error: error.message
        });
        // Return empty values on error to not block regularization operations
        return {
            managerEmail: null,
            ccEmails: []
        };
    }
};

/**
 * Build CC list for approval/rejection: Manager + HR + Admin
 * @param {Object} employee - Employee document
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Array>} CC email addresses
 */
const getApprovalRejectionCcEmails = async (employee, organizationId) => {
    const { managerEmail, ccEmails } = await getRegularizationNotificationEmails(employee, organizationId);
    const allCc = [];

    if (managerEmail) {
        allCc.push(managerEmail);
    }

    if (Array.isArray(ccEmails)) {
        ccEmails.forEach(email => {
            if (email && !allCc.includes(email)) {
                allCc.push(email);
            }
        });
    }

    return allCc.filter(email => email !== employee.email);
};

/**
 * Send attendance regularization request notification with error handling
 * @param {Object} regularizationData - Regularization request data
 * @param {string} employeeId - Employee ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<void>}
 */
export const sendRegularizationRequestNotification = async (regularizationData, employeeId, organizationId) => {
    try {
        const employee = await Employee.findById(employeeId).lean();
        if (!employee || !employee.email) {
            logger.warn('Employee email not found for regularization request notification', { employeeId });
            return;
        }

        const { managerEmail, ccEmails } = await getRegularizationNotificationEmails(employee, organizationId);

        if (!managerEmail) {
            logger.warn('No manager email found for regularization request notification', { employeeId });
            return;
        }

        const { sendRegularizationRequestEmail } = await import('./emailSender.js');
        
        // Add employee details to regularization data
        const enhancedRegularizationData = {
            ...regularizationData,
            employeeId: employee.employeeId,
            employeeEmail: employee.email,
            employeeName: `${employee.name} ${employee.lastName || ''}`,
            department: employee.department,
            managerName: employee.manager || 'Manager'
        };

        const recordId = regularizationData._id || regularizationData.id;
        const threadRootMessageId = await resolveStoredThreadRootMessageId(
            AttendanceRegularization,
            recordId,
            regularizationData.emailThreadMessageId
        );

        const sendResult = await sendRegularizationRequestEmail(
            enhancedRegularizationData,
            managerEmail,
            ccEmails,
            { threadRootMessageId }
        );

        await persistThreadRootMessageId(AttendanceRegularization, recordId, sendResult?.threadRootMessageId);
        
        logger.info('Attendance regularization request notification sent successfully', {
            regularizationId: regularizationData._id || regularizationData.id,
            employeeId,
            toEmail: '***' + managerEmail.split('@')[1],
            ccCount: ccEmails.length
        });
    } catch (error) {
        logger.error('Failed to send regularization request notification', {
            employeeId,
            regularizationId: regularizationData._id || regularizationData.id,
            error: error.message
        });
        // Don't throw - email failures should not block regularization operations
    }
};

/**
 * Send attendance regularization approval notification with error handling
 * @param {Object} regularizationData - Regularization request data
 * @param {string} employeeId - Employee ID
 * @returns {Promise<void>}
 */
export const sendRegularizationApprovalNotification = async (regularizationData, employeeId) => {
    try {
        const employee = await Employee.findById(employeeId).lean();
        if (!employee || !employee.email) {
            logger.warn('Employee email not found for regularization approval notification', { employeeId });
            return;
        }

        const organizationId = employee.organizationId;
        const ccEmails = organizationId
            ? await getApprovalRejectionCcEmails(employee, organizationId)
            : [];

        const { sendRegularizationApprovalEmail } = await import('./emailSender.js');
        
        const enhancedRegularizationData = {
            ...regularizationData,
            employeeId: employee.employeeId,
            employeeName: `${employee.name} ${employee.lastName || ''}`
        };

        const recordId = regularizationData._id || regularizationData.id;
        const threadRootMessageId = await resolveStoredThreadRootMessageId(
            AttendanceRegularization,
            recordId,
            regularizationData.emailThreadMessageId,
            THREAD_ROOT_REPLY_LOOKUP
        );

        if (!threadRootMessageId) {
            logger.warn('Regularization thread root Message-ID not found before approval email', { recordId });
        }

        const sendResult = await sendRegularizationApprovalEmail(
            enhancedRegularizationData,
            employee.email,
            ccEmails,
            { threadRootMessageId }
        );

        await persistThreadRootMessageId(AttendanceRegularization, recordId, sendResult?.threadRootMessageId);
        
        logger.info('Attendance regularization approval notification sent successfully', {
            regularizationId: regularizationData._id || regularizationData.id,
            employeeId,
            employeeEmail: '***' + employee.email.split('@')[1],
            ccCount: ccEmails.length
        });
    } catch (error) {
        logger.error('Failed to send regularization approval notification', {
            employeeId,
            regularizationId: regularizationData._id || regularizationData.id,
            error: error.message
        });
        // Don't throw - email failures should not block regularization operations
    }
};

/**
 * Send attendance regularization rejection notification with error handling
 * @param {Object} regularizationData - Regularization request data
 * @param {string} employeeId - Employee ID
 * @returns {Promise<void>}
 */
export const sendRegularizationRejectionNotification = async (regularizationData, employeeId) => {
    try {
        const employee = await Employee.findById(employeeId).lean();
        if (!employee || !employee.email) {
            logger.warn('Employee email not found for regularization rejection notification', { employeeId });
            return;
        }

        const organizationId = employee.organizationId;
        const ccEmails = organizationId
            ? await getApprovalRejectionCcEmails(employee, organizationId)
            : [];

        const { sendRegularizationRejectionEmail } = await import('./emailSender.js');
        
        const enhancedRegularizationData = {
            ...regularizationData,
            employeeId: employee.employeeId,
            employeeName: `${employee.name} ${employee.lastName || ''}`
        };

        const recordId = regularizationData._id || regularizationData.id;
        const threadRootMessageId = await resolveStoredThreadRootMessageId(
            AttendanceRegularization,
            recordId,
            regularizationData.emailThreadMessageId,
            THREAD_ROOT_REPLY_LOOKUP
        );

        if (!threadRootMessageId) {
            logger.warn('Regularization thread root Message-ID not found before rejection email', { recordId });
        }

        const sendResult = await sendRegularizationRejectionEmail(
            enhancedRegularizationData,
            employee.email,
            ccEmails,
            { threadRootMessageId }
        );

        await persistThreadRootMessageId(AttendanceRegularization, recordId, sendResult?.threadRootMessageId);
        
        logger.info('Attendance regularization rejection notification sent successfully', {
            regularizationId: regularizationData._id || regularizationData.id,
            employeeId,
            employeeEmail: '***' + employee.email.split('@')[1],
            ccCount: ccEmails.length
        });
    } catch (error) {
        logger.error('Failed to send regularization rejection notification', {
            employeeId,
            regularizationId: regularizationData._id || regularizationData.id,
            error: error.message
        });
        // Don't throw - email failures should not block regularization operations
    }
};

export default {
    getRegularizationNotificationEmails,
    sendRegularizationRequestNotification,
    sendRegularizationApprovalNotification,
    sendRegularizationRejectionNotification
};
