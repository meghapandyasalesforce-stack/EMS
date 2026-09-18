import asyncHandler from '../../helpers/asyncHandler.js';
import { sendSuccess } from '../../helpers/responseHelper.js';
import { extractToken, verifyToken, handleAuthError } from '../../middlewares/authHelpers.js';
import { resolveAuthContext, getDataScope } from '../../helpers/permissionService.js';
import { attachTenantToRequest } from '../../services/tenantService.js';
import { SAAS_FEATURE_LABELS } from '../../constants/saasFeatures.js';

/**
 * GET /api/v1/both/auth/permissions — current user's permission set for UI gating.
 */
export const getMyPermissions = asyncHandler(async (req, res) => {
  let decoded = req.decoded;
  if (!decoded) {
    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        code: 'NO_TOKEN',
      });
    }
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return handleAuthError(error, res);
    }
  }

  const authContext = req.authContext || (await resolveAuthContext(decoded, req));

  let saasFeatures = {};
  let planId = null;
  let planName = null;
  let subscriptionStatus = null;
  try {
    const organizationId =
      authContext.user?.organizationId ||
      authContext.employee?.organizationId ||
      decoded?.organizationId;
    if (!req.tenant && organizationId) {
      req.organizationId = organizationId;
      await attachTenantToRequest(req);
    }
    if (req.tenant?.features) {
      saasFeatures = req.tenant.features;
      planId = req.tenant.planId;
      planName = req.tenant.planName;
      subscriptionStatus = req.tenant.subscriptionStatus;
    }
  } catch {
    // Entitlements are best-effort for UI; RBAC still returned.
  }

  return sendSuccess(res, {
    permissions: authContext.permissions,
    roleBuckets: authContext.buckets,
    platformRoles: authContext.platformRoles,
    functionalRoles: authContext.functionalRoles,
    dataScope: getDataScope(authContext),
    permissionFlags: {
      isOrgOwner: authContext.isOrgOwner,
      isHrManager: authContext.isHrManager,
      isHrExecutive: authContext.isHrExecutive,
      isPayrollAdmin: authContext.isPayrollAdmin,
      isLineManager: authContext.isLineManager,
      isProjectManager: authContext.isProjectManager,
      isExecutive: authContext.isExecutive,
      jwtRole: authContext.jwtRole || decoded?.role || null,
    },
    saasFeatures,
    featureLabels: SAAS_FEATURE_LABELS,
    planId,
    planName,
    subscriptionStatus,
  });
});
