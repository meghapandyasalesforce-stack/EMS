/**
 * Organization Isolation Middleware
 * Sets organizationId context for all queries
 * SECURITY: Ensures all database queries are scoped to the requesting organization
 */

import { getOrganizationId } from '../helpers/organizationHelper.js';
import logger from '../helpers/logger.js';
import { sendError } from '../helpers/responseHelper.js';
import { setRequestContextValue } from '../helpers/requestContext.js';

/**
 * Middleware to set organization context for queries
 * This middleware should be applied after authentication middleware
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const setOrganizationContext = (req, res, next) => {
    const organizationId = getOrganizationId(req);
    
    if (organizationId) {
        // Set organizationId on request for easy access
        req.organizationId = organizationId;
        
        // Set organization context for Mongoose queries
        // This will be used by the organizationIsolationPlugin
        req.queryContext = {
            organizationId
        };

        // Store in AsyncLocalStorage for automatic query scoping
        setRequestContextValue('organizationId', organizationId);
        
        logger.debug('Organization context set', {
            organizationId,
            path: req.path,
            userId: req.user?._id || req.employee?._id
        });
    } else {
        // Log warning but don't block (some endpoints may be public)
        logger.debug('No organizationId in request', {
            path: req.path,
            method: req.method,
            hasUser: !!req.user,
            hasEmployee: !!req.employee
        });
    }
    
    next();
};

/**
 * Middleware to require organizationId
 * Use this for endpoints that MUST have organization context
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const requireOrganizationId = (req, res, next) => {
    const organizationId = getOrganizationId(req);
    
    if (!organizationId) {
        logger.warn('Organization ID required but missing', {
            path: req.path,
            method: req.method,
            userId: req.user?._id || req.employee?._id
        });
        
        return sendError(
            res,
            'Organization ID is required. Please ensure you are authenticated.',
            400,
            'MISSING_ORGANIZATION_ID'
        );
    }
    
    // Validate organizationId format (MongoDB ObjectId)
    if (!/^[0-9a-fA-F]{24}$/.test(organizationId.toString())) {
        logger.warn('Invalid organization ID format', {
            organizationId,
            path: req.path
        });
        
        return sendError(
            res,
            'Invalid organization ID format',
            400,
            'INVALID_ORGANIZATION_ID'
        );
    }
    
    // Set context
    req.organizationId = organizationId;
    req.queryContext = { organizationId };
    
    next();
};

/**
 * Helper function to add organizationId to query
 * Use this in controllers to ensure organization isolation
 * 
 * @param {Object} req - Express request object
 * @param {Object} query - MongoDB query object
 * @returns {Object} - Query with organizationId filter
 */
export const addOrganizationFilter = (req, query = {}) => {
    const organizationId = getOrganizationId(req);
    
    if (organizationId) {
        query.organizationId = organizationId;
    } else {
        logger.warn('No organizationId found in request for query filter', {
            path: req.path,
            method: req.method
        });
    }
    
    return query;
};

export default {
    setOrganizationContext,
    requireOrganizationId,
    addOrganizationFilter
};

