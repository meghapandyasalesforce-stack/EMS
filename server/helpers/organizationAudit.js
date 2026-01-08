/**
 * Organization Isolation Audit Helper
 * Helps identify potential multi-tenancy security issues
 */

import logger from './logger.js';

/**
 * Audit a database query to ensure organizationId is included
 * @param {Object} query - MongoDB query object
 * @param {string} modelName - Name of the model being queried
 * @param {string} operation - Operation type (find, findOne, update, etc.)
 * @param {Object} req - Express request object
 * @returns {Object} - Audit result
 */
export const auditQuery = (query, modelName, operation, req) => {
    const hasOrganizationId = query.organizationId !== undefined;
    const organizationId = req.user?.organizationId || req.employee?.organizationId || req.organizationId;
    
    if (!hasOrganizationId && organizationId) {
        logger.warn('Potential organization isolation issue detected', {
            model: modelName,
            operation,
            path: req.path,
            method: req.method,
            hasOrganizationIdInQuery: false,
            organizationIdInRequest: !!organizationId,
            query: JSON.stringify(query)
        });
        
        return {
            hasIssue: true,
            severity: 'high',
            message: `Query on ${modelName} missing organizationId filter`,
            recommendation: 'Add organizationId filter using addOrganizationFilter helper'
        };
    }
    
    if (!hasOrganizationId && !organizationId) {
        logger.debug('Query without organizationId (may be intentional)', {
            model: modelName,
            operation,
            path: req.path,
            method: req.method
        });
        
        return {
            hasIssue: false,
            severity: 'info',
            message: 'Query without organizationId - verify this is intentional',
            recommendation: 'Ensure this endpoint is public or organization-agnostic'
        };
    }
    
    return {
        hasIssue: false,
        severity: 'none',
        message: 'Query properly includes organizationId filter'
    };
};

/**
 * Validate that a result belongs to the requesting organization
 * @param {Object} result - Database result
 * @param {Object} req - Express request object
 * @param {string} modelName - Name of the model
 * @returns {boolean} - True if result belongs to organization
 */
export const validateOrganizationAccess = (result, req, modelName) => {
    const organizationId = req.user?.organizationId || req.employee?.organizationId || req.organizationId;
    
    if (!organizationId) {
        logger.warn('Cannot validate organization access - no organizationId in request', {
            path: req.path,
            model: modelName
        });
        return false;
    }
    
    if (!result) {
        return true; // No result to validate
    }
    
    // Handle single document
    if (result.organizationId) {
        const matches = result.organizationId.toString() === organizationId.toString();
        if (!matches) {
            logger.error('Organization access violation detected', {
                path: req.path,
                model: modelName,
                requestedOrgId: organizationId,
                resultOrgId: result.organizationId,
                userId: req.user?._id || req.employee?._id
            });
        }
        return matches;
    }
    
    // Handle array of documents
    if (Array.isArray(result)) {
        const violations = result.filter(item => 
            item.organizationId && 
            item.organizationId.toString() !== organizationId.toString()
        );
        
        if (violations.length > 0) {
            logger.error('Organization access violation detected in array result', {
                path: req.path,
                model: modelName,
                requestedOrgId: organizationId,
                violationCount: violations.length,
                userId: req.user?._id || req.employee?._id
            });
            return false;
        }
        return true;
    }
    
    // If no organizationId field, log warning
    logger.warn('Result does not have organizationId field', {
        path: req.path,
        model: modelName,
        hasOrganizationId: false
    });
    
    return true; // Allow if model doesn't have organizationId (may be intentional)
};

export default {
    auditQuery,
    validateOrganizationAccess
};
