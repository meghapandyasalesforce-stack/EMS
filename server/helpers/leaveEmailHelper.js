import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import Employee from '../models/employee.model.js';
import Leave from '../models/leave.model.js';
import Organization from '../models/organization.model.js';
import logger from './logger.js';
import {
    persistThreadRootMessageId,
    resolveStoredThreadRootMessageId,
    THREAD_ROOT_REPLY_LOOKUP
} from './emailThreadPersistenceHelper.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Load organization profile logo from disk for CID email attachment.
 * @param {string|null|undefined} organizationId
 * @returns {Promise<{ filename: string, content: Buffer, contentType: string }|null>}
 */
const getOrganizationLogoAttachment = async (organizationId) => {
    if (!organizationId) return null;

    try {
        const org = await Organization.findById(organizationId).select('logo').lean();
        if (!org?.logo?.url && !org?.logo?.filename) return null;

        const filename = org.logo.filename || path.basename(org.logo.url);
        if (!filename) return null;

        const logosDir = path.join(__dirname, '../uploads/logos');
        const uploadsDir = path.join(__dirname, '../uploads');
        let filePath = path.join(logosDir, filename);
        if (!fs.existsSync(filePath)) {
            filePath = path.join(uploadsDir, filename);
        }
        if (!fs.existsSync(filePath)) {
            logger.warn('Organization logo file not found for leave approval email', {
                organizationId: String(organizationId),
                filename
            });
            return null;
        }

        const ext = path.extname(filename).toLowerCase();
        const contentType =
            ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
            : ext === '.svg' ? 'image/svg+xml'
            : ext === '.webp' ? 'image/webp'
            : ext === '.gif' ? 'image/gif'
            : 'image/png';

        return {
            filename,
            content: fs.readFileSync(filePath),
            contentType
        };
    } catch (error) {
        logger.warn('Could not load organization logo for leave approval email', {
            organizationId: String(organizationId),
            error: error.message
        });
        return null;
    }
};

/**
 * Get manager email and CC email addresses for leave notifications
 * @param {Object} employee - Employee document
 * @param {string} organizationId - Organization ID
 * @returns {Promise<Object>} Object with managerEmail and ccEmails array
 */
export const getLeaveNotificationEmails = async (employee, organizationId) => {
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
            functionalRoles: 'hr',
            status: 'active',
            email: { $exists: true, $ne: null }
        }).select('email').lean();

        hrEmployees.forEach(hr => {
            if (hr.email && hr.email !== managerEmail && !ccEmails.includes(hr.email)) {
                ccEmails.push(hr.email);
            }
        });

        // Get Admin employees for CC
        const adminEmployees = await Employee.find({
            organizationId,
            role: 'admin',
            status: 'active',
            email: { $exists: true, $ne: null }
        }).select('email').lean();

        adminEmployees.forEach(admin => {
            if (admin.email && admin.email !== managerEmail && !ccEmails.includes(admin.email)) {
                ccEmails.push(admin.email);
            }
        });

        // Remove duplicates
        const uniqueCcEmails = [...new Set(ccEmails)];

        logger.info('Leave notification emails retrieved', {
            employeeId: employee._id,
            managerEmail: managerEmail ? '***' + managerEmail.split('@')[1] : 'Not found',
            ccCount: uniqueCcEmails.length
        });

        return {
            managerEmail,
            ccEmails: uniqueCcEmails
        };
    } catch (error) {
        logger.error('Error getting leave notification emails', {
            employeeId: employee._id,
            error: error.message
        });
        // Return empty values on error to not block leave operations
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
    const { managerEmail, ccEmails } = await getLeaveNotificationEmails(employee, organizationId);
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
 * Send leave request notification with error handling
 * @param {Object} leaveData - Leave request data
 * @param {string} employeeId - Employee ID
 * @param {string} organizationId - Organization ID
 * @returns {Promise<void>}
 */
export const sendLeaveRequestNotification = async (leaveData, employeeId, organizationId) => {
    try {
        const employee = await Employee.findById(employeeId).lean();
        if (!employee || !employee.email) {
            logger.warn('Employee email not found for leave request notification', { employeeId });
            return;
        }

        const { managerEmail, ccEmails } = await getLeaveNotificationEmails(employee, organizationId);

        if (!managerEmail) {
            logger.warn('No manager email found for leave request notification', { employeeId });
            return;
        }

        const { sendLeaveRequestEmail } = await import('./emailSender.js');
        
        // Add employee details to leave data
        const enhancedLeaveData = {
            ...leaveData,
            employeeId: employee.employeeId,
            employeeEmail: employee.email,
            managerName: employee.manager || 'Manager'
        };

        const recordId = leaveData._id || leaveData.id;
        const threadRootMessageId = await resolveStoredThreadRootMessageId(
            Leave,
            recordId,
            leaveData.emailThreadMessageId
        );

        // Send email appearing FROM employee TO manager, CC HR and Admin
        const sendResult = await sendLeaveRequestEmail(
            enhancedLeaveData,
            managerEmail,
            ccEmails,
            employee.email,
            { threadRootMessageId }
        );

        await persistThreadRootMessageId(Leave, recordId, sendResult?.threadRootMessageId);
        
        logger.info('Leave request notification sent successfully', {
            leaveId: leaveData._id || leaveData.id,
            employeeId,
            fromEmail: '***' + employee.email.split('@')[1],
            toEmail: '***' + managerEmail.split('@')[1],
            ccCount: ccEmails.length
        });
    } catch (error) {
        logger.error('Failed to send leave request notification', {
            employeeId,
            leaveId: leaveData._id || leaveData.id,
            error: error.message
        });
        // Don't throw - email failures should not block leave operations
    }
};

/**
 * Send leave approval notification with error handling
 * @param {Object} leaveData - Leave request data
 * @param {string} employeeId - Employee ID
 * @returns {Promise<void>}
 */
export const sendLeaveApprovalNotification = async (leaveData, employeeId) => {
    try {
        const employee = await Employee.findById(employeeId).lean();
        if (!employee || !employee.email) {
            logger.warn('Employee email not found for leave approval notification', { employeeId });
            return;
        }

        const organizationId = employee.organizationId;
        const ccEmails = organizationId
            ? await getApprovalRejectionCcEmails(employee, organizationId)
            : [];

        const logoAttachment = await getOrganizationLogoAttachment(organizationId);

        const { sendLeaveApprovalEmail } = await import('./emailSender.js');
        
        const enhancedLeaveData = {
            ...leaveData,
            employeeId: employee.employeeId
        };

        const recordId = leaveData._id || leaveData.id;
        const threadRootMessageId = await resolveStoredThreadRootMessageId(
            Leave,
            recordId,
            leaveData.emailThreadMessageId,
            THREAD_ROOT_REPLY_LOOKUP
        );

        if (!threadRootMessageId) {
            logger.warn('Leave thread root Message-ID not found before approval email', { recordId });
        }

        const sendResult = await sendLeaveApprovalEmail(
            enhancedLeaveData,
            employee.email,
            ccEmails,
            { threadRootMessageId, logoAttachment }
        );

        await persistThreadRootMessageId(Leave, recordId, sendResult?.threadRootMessageId);
        
        logger.info('Leave approval notification sent successfully', {
            leaveId: leaveData._id || leaveData.id,
            employeeId,
            employeeEmail: '***' + employee.email.split('@')[1],
            ccCount: ccEmails.length
        });
    } catch (error) {
        logger.error('Failed to send leave approval notification', {
            employeeId,
            leaveId: leaveData._id || leaveData.id,
            error: error.message
        });
        // Don't throw - email failures should not block leave operations
    }
};

/**
 * Send leave rejection notification with error handling
 * @param {Object} leaveData - Leave request data
 * @param {string} employeeId - Employee ID
 * @returns {Promise<void>}
 */
export const sendLeaveRejectionNotification = async (leaveData, employeeId) => {
    try {
        const employee = await Employee.findById(employeeId).lean();
        if (!employee || !employee.email) {
            logger.warn('Employee email not found for leave rejection notification', { employeeId });
            return;
        }

        const organizationId = employee.organizationId;
        const ccEmails = organizationId
            ? await getApprovalRejectionCcEmails(employee, organizationId)
            : [];

        const { sendLeaveRejectionEmail } = await import('./emailSender.js');
        
        const enhancedLeaveData = {
            ...leaveData,
            employeeId: employee.employeeId
        };

        const recordId = leaveData._id || leaveData.id;
        const threadRootMessageId = await resolveStoredThreadRootMessageId(
            Leave,
            recordId,
            leaveData.emailThreadMessageId,
            THREAD_ROOT_REPLY_LOOKUP
        );

        if (!threadRootMessageId) {
            logger.warn('Leave thread root Message-ID not found before rejection email', { recordId });
        }

        const sendResult = await sendLeaveRejectionEmail(
            enhancedLeaveData,
            employee.email,
            ccEmails,
            { threadRootMessageId }
        );

        await persistThreadRootMessageId(Leave, recordId, sendResult?.threadRootMessageId);
        
        logger.info('Leave rejection notification sent successfully', {
            leaveId: leaveData._id || leaveData.id,
            employeeId,
            employeeEmail: '***' + employee.email.split('@')[1],
            ccCount: ccEmails.length
        });
    } catch (error) {
        logger.error('Failed to send leave rejection notification', {
            employeeId,
            leaveId: leaveData._id || leaveData.id,
            error: error.message
        });
        // Don't throw - email failures should not block leave operations
    }
};

export default {
    getLeaveNotificationEmails,
    sendLeaveRequestNotification,
    sendLeaveApprovalNotification,
    sendLeaveRejectionNotification
};
