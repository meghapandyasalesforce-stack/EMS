/**
 * Ensures tenant is loaded after route-level auth middleware.
 * Use on protected tenant routers (admin, employee data, both).
 */
import { getOrganizationId } from '../helpers/organizationHelper.js';
import { attachTenantToRequest, TenantError } from '../services/tenantService.js';
import { sendError } from '../helpers/responseHelper.js';

export const ensureTenantLoaded = async (req, res, next) => {
    try {
        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(
                res,
                'Organization context is required. Please sign in again.',
                401,
                'MISSING_TENANT_CONTEXT'
            );
        }
        req.organizationId = organizationId;
        await attachTenantToRequest(req);
        return next();
    } catch (error) {
        if (error instanceof TenantError) {
            return sendError(res, error.message, error.statusCode, error.code, error.details);
        }
        return sendError(res, 'Failed to load organization context', 500, 'TENANT_CONTEXT_ERROR');
    }
};

export default ensureTenantLoaded;
