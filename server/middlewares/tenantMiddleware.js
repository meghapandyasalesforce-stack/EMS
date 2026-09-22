/**
 * SaaS tenant pipeline middleware.
 * Auth → Tenant → Subscription → Feature → (existing Permission middleware)
 */

import { sendError } from '../helpers/responseHelper.js';
import { getOrganizationId } from '../helpers/organizationHelper.js';
import {
    attachTenantToRequest,
    assertFeatureEnabled,
    assertSubscriptionActive,
    TenantError,
} from '../services/tenantService.js';
import {
    extractToken,
    verifyToken,
    handleAuthError,
    hydrateRequestIdentity,
} from './authHelpers.js';
import { resolveAuthContext } from '../helpers/permissionService.js';
import logger from '../helpers/logger.js';

/**
 * Ensure req.organizationId / identity exist so requireFeature can run
 * before route-level auth middleware (e.g. router.use(requireFeature(...))).
 */
const ensureOrganizationContextForFeatureGate = async (req) => {
    if (getOrganizationId(req)) {
        req.organizationId = req.organizationId || getOrganizationId(req);
        return;
    }

    let decoded = req.decoded;
    if (!decoded) {
        const token = extractToken(req);
        if (!token) return;
        decoded = verifyToken(token);
        req.decoded = decoded;
    }

    if (decoded.organizationId) {
        req.organizationId = decoded.organizationId;
        return;
    }

    if (!req.authContext) {
        req.authContext = await resolveAuthContext(decoded, req);
    }
    await hydrateRequestIdentity(req, decoded, req.authContext);
};

/** Paths that never require tenant context */
const TENANT_EXEMPT_PREFIXES = [
    '/api/health',
    '/api/v1/organization/auth',
    '/api/v1/public/',
    '/api/v1/both/auth',
    '/api/v1/admin/auth',
    '/api/v1/platform/',
    '/api/v1/webhooks/',
    '/api/v1/employee/auth/login',
    '/api/v1/employee/auth/refresh-token',
    '/api/push',
    '/uploads/',
    '/metrics',
];

const isTenantExemptPath = (path = '') =>
    TENANT_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));

/**
 * Strip client-supplied organizationId when the user is authenticated.
 * Prevents cross-tenant ID injection via body/query.
 */
export const sanitizeClientOrganizationId = (req, res, next) => {
    const hasSessionOrg =
        req.user?.organizationId ||
        req.employee?.organizationId ||
        req.organizationId;

    if (hasSessionOrg) {
        if (req.body && Object.prototype.hasOwnProperty.call(req.body, 'organizationId')) {
            delete req.body.organizationId;
        }
        if (req.query && Object.prototype.hasOwnProperty.call(req.query, 'organizationId')) {
            delete req.query.organizationId;
        }
    }

    next();
};

/**
 * Attach tenant snapshot when organizationId is already on the request.
 * Non-blocking globally — route auth runs after this middleware.
 */
export const requireTenantContext = async (req, res, next) => {
    try {
        if (isTenantExemptPath(req.path)) {
            return next();
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return next();
        }

        if (!/^[0-9a-fA-F]{24}$/.test(String(organizationId))) {
            return next();
        }

        req.organizationId = organizationId;
        await attachTenantToRequest(req);
        return next();
    } catch (error) {
        if (error instanceof TenantError) {
            return sendError(res, error.message, error.statusCode, error.code, error.details);
        }
        logger.error('requireTenantContext failed', { error: error.message, path: req.path });
        return next();
    }
};

/**
 * Require active subscription on req.tenant (run after requireTenantContext).
 */
export const requireActiveSubscription = (req, res, next) => {
    try {
        if (isTenantExemptPath(req.path) || !req.tenant) {
            return next();
        }
        assertSubscriptionActive(req.tenant);
        return next();
    } catch (error) {
        if (error instanceof TenantError) {
            return sendError(res, error.message, error.statusCode, error.code, error.details);
        }
        return sendError(res, 'Subscription check failed', 500, 'SUBSCRIPTION_CHECK_ERROR');
    }
};

/**
 * Factory: gate route/module by SaaS feature flag.
 * @param {string} featureKey — from saasFeatures.js
 */
export const requireFeature = (featureKey) => async (req, res, next) => {
    try {
        if (isTenantExemptPath(req.path)) {
            return next();
        }
        if (!req.tenant) {
            try {
                await ensureOrganizationContextForFeatureGate(req);
            } catch (authError) {
                return handleAuthError(authError, res);
            }
            await attachTenantToRequest(req);
        }
        if (!req.tenant) {
            return sendError(res, 'Organization context required', 401, 'MISSING_TENANT_CONTEXT');
        }
        assertFeatureEnabled(req.tenant, featureKey);
        return next();
    } catch (error) {
        if (error instanceof TenantError) {
            return sendError(res, error.message, error.statusCode, error.code, error.details);
        }
        logger.error('requireFeature failed', { featureKey, error: error.message });
        return sendError(res, 'Feature access check failed', 500, 'FEATURE_CHECK_ERROR');
    }
};

export default {
    sanitizeClientOrganizationId,
    requireTenantContext,
    requireActiveSubscription,
    requireFeature,
};
