import { getOrganizationId } from '../helpers/organizationHelper.js';
import logger from '../helpers/logger.js';
import { sendError } from '../helpers/responseHelper.js';

/**
 * Middleware to validate that organizationId exists in request
 * Ensures multi-tenancy isolation
 * 
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const validateOrganizationId = (req, res, next) => {
    const organizationId = getOrganizationId(req);
    
    if (!organizationId) {
        logger.warn('Organization ID validation failed', {
            path: req.path,
            method: req.method,
            userId: req.user?._id || req.employee?._id,
            hasUser: !!req.user,
            hasEmployee: !!req.employee
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
    
    next();
};

export default validateOrganizationId;

