/**
 * Audit Logging Helper
 * Centralized audit logging for tracking system changes
 */

import AuditLog from '../models/auditLog.model.js';
import logger from './logger.js';
import { getOrganizationId } from './organizationHelper.js';

/**
 * Get client IP address from request
 * @param {Object} req - Express request object
 * @returns {string} IP address
 */
const getClientIP = (req) => {
    return req.ip ||
           req.connection?.remoteAddress ||
           req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
           req.socket?.remoteAddress ||
           'unknown';
};

/**
 * Detect field changes between old and new objects
 * @param {Object} oldObj - Old object state
 * @param {Object} newObj - New object state
 * @returns {Array} Array of changed fields
 */
const detectFieldChanges = (oldObj, newObj) => {
    if (!oldObj || !newObj) return [];
    
    const changes = [];
    const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);
    
    // Exclude internal fields
    const excludeFields = ['_id', '__v', 'createdAt', 'updatedAt', 'password', 'token'];
    
    for (const key of allKeys) {
        if (excludeFields.includes(key)) continue;
        
        const oldValue = oldObj[key];
        const newValue = newObj[key];
        
        // Deep comparison for objects/arrays
        if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            changes.push({
                field: key,
                oldValue: typeof oldValue === 'object' ? JSON.stringify(oldValue) : oldValue,
                newValue: typeof newValue === 'object' ? JSON.stringify(newValue) : newValue
            });
        }
    }
    
    return changes;
};

/**
 * Create an audit log entry
 * @param {Object} options - Audit log options
 * @param {string} options.action - Action type (Create, Update, Delete, etc.)
 * @param {string} options.entityType - Entity type (Employee, Leave, Payroll, etc.)
 * @param {Object} options.entityId - Entity ID
 * @param {string} options.entityName - Entity name (optional)
 * @param {Object} options.req - Express request object
 * @param {Object} options.before - Object state before change (optional)
 * @param {Object} options.after - Object state after change (optional)
 * @param {string} options.status - Status (Success, Failed, Error) - default: Success
 * @param {string} options.errorMessage - Error message if status is Failed/Error
 * @param {Object} options.metadata - Additional metadata
 * @returns {Promise<void>}
 */
export const createAuditLog = async ({
    action,
    entityType,
    entityId,
    entityName = null,
    req,
    before = null,
    after = null,
    status = 'Success',
    errorMessage = null,
    metadata = {}
}) => {
    try {
        const organizationId = getOrganizationId(req);
        
        if (!organizationId) {
            logger.warn('Cannot create audit log: no organizationId', {
                action,
                entityType,
                path: req?.path
            });
            return;
        }

        // Get user/employee info
        const userId = req.user?._id || null;
        const employeeId = req.employee?._id || null;
        
        // Detect field changes if both before and after are provided
        let fieldChanges = [];
        if (before && after) {
            fieldChanges = detectFieldChanges(before, after);
        }

        // Create audit log entry
        await AuditLog.create({
            organizationId,
            userId,
            employeeId,
            action,
            entityType,
            entityId,
            entityName,
            changes: {
                before: before ? JSON.parse(JSON.stringify(before)) : null,
                after: after ? JSON.parse(JSON.stringify(after)) : null,
                fields: fieldChanges.map(c => c.field)
            },
            ipAddress: getClientIP(req),
            userAgent: req?.get('user-agent') || null,
            requestMethod: req?.method || null,
            requestPath: req?.path || req?.originalUrl || null,
            status,
            errorMessage,
            metadata: {
                ...metadata,
                fieldChanges: fieldChanges.length > 0 ? fieldChanges : undefined
            }
        });

        logger.debug('Audit log created', {
            action,
            entityType,
            entityId,
            status
        });
    } catch (error) {
        // Don't throw - audit logging failure shouldn't break the main operation
        logger.error('Failed to create audit log', {
            error: error.message,
            action,
            entityType,
            entityId
        });
    }
};

/**
 * Helper to log Create action
 * @param {Object} options - Audit log options
 */
export const logCreate = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Create'
    });
};

/**
 * Helper to log Update action
 * @param {Object} options - Audit log options
 */
export const logUpdate = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Update'
    });
};

/**
 * Helper to log Delete action
 * @param {Object} options - Audit log options
 */
export const logDelete = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Delete'
    });
};

/**
 * Helper to log Approve action
 * @param {Object} options - Audit log options
 */
export const logApprove = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Approve'
    });
};

/**
 * Helper to log Reject action
 * @param {Object} options - Audit log options
 */
export const logReject = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Reject'
    });
};

/**
 * Helper to log Export action
 * @param {Object} options - Audit log options
 */
export const logExport = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Export'
    });
};

/**
 * Helper to log Download action
 * @param {Object} options - Audit log options
 */
export const logDownload = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Download'
    });
};

/**
 * Helper to log Login action
 * @param {Object} options - Audit log options
 */
export const logLogin = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Login'
    });
};

/**
 * Helper to log Logout action
 * @param {Object} options - Audit log options
 */
export const logLogout = async (options) => {
    await createAuditLog({
        ...options,
        action: 'Logout'
    });
};

export default {
    createAuditLog,
    logCreate,
    logUpdate,
    logDelete,
    logApprove,
    logReject,
    logExport,
    logDownload,
    logLogin,
    logLogout
};

