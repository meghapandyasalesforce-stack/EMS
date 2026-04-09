/**
 * Organization Helper Functions
 * Utilities for multi-tenancy support
 */

import logger from "./logger.js";

/**
 * Get organizationId from request
 * Checks user, employee, or request body
 * @param {Object} req - Express request object
 * @returns {string|null} - Organization ID or null
 */
export const getOrganizationId = (req) => {
    // Priority 1: From authenticated user/employee
    if (req.user?.organizationId) {
        return req.user.organizationId;
    }
    if (req.employee?.organizationId) {
        return req.employee.organizationId;
    }
    
    // Priority 2: From request organizationId property (set by middleware)
    if (req.organizationId) {
        return req.organizationId;
    }
    
    // Priority 3: From request body (for some operations)
    if (req.body?.organizationId) {
        return req.body.organizationId;
    }
    
    return null;
};

/**
 * Add organizationId filter to query
 * @param {Object} req - Express request object
 * @param {Object} query - MongoDB query object
 * @returns {Object} - Query with organizationId filter
 */
export const addOrganizationFilter = (req, query = {}) => {
    const organizationId = getOrganizationId(req);
    
    if (organizationId) {
        query.organizationId = organizationId;
    } else {
        logger.warn('No organizationId found in request', {
            path: req.path,
            method: req.method,
            hasUser: !!req.user,
            hasEmployee: !!req.employee
        });
    }
    
    return query;
};

/**
 * Validate organizationId exists in request
 * @param {Object} req - Express request object
 * @returns {boolean} - True if organizationId exists
 */
export const hasOrganizationId = (req) => {
    return !!getOrganizationId(req);
};

/**
 * Require organizationId or throw error
 * @param {Object} req - Express request object
 * @throws {Error} - If organizationId is missing
 */
export const requireOrganizationId = (req) => {
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
        const error = new Error('Organization ID is required');
        error.statusCode = 400;
        error.code = 'MISSING_ORGANIZATION_ID';
        throw error;
    }
    return organizationId;
};

/**
 * Single-line mailing label from Organization.address subdocument
 * @param {Object|null|undefined} addr - organization.address
 * @returns {string}
 */
export const formatOrganizationAddress = (addr) => {
    if (!addr || typeof addr !== 'object') return '';
    const parts = [addr.street, addr.city, addr.state, addr.zipCode, addr.country]
        .map((p) => (p == null ? '' : String(p).trim()))
        .filter(Boolean);
    return parts.join(', ');
};

/** True when ID card should replace this string with org profile address */
export const isPlaceholderIdCardAddress = (s) => {
    if (s == null) return true;
    const t = String(s).trim().toLowerCase();
    return t === '' || t === 'your company address' || t === 'corporate office address';
};

