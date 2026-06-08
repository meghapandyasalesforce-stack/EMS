import asyncHandler from '../../helpers/asyncHandler.js';
import logger from '../../helpers/logger.js';
import { generateToken } from '../../helpers/utils.js';
import {
  sendSuccess,
  sendUnauthorized,
  sendForbidden,
  sendValidationError,
} from '../../helpers/responseHelper.js';
import { normalizeEmail } from '../../helpers/authHelpers.js';
import { performUnifiedLogin } from '../../helpers/unifiedLoginService.js';

/**
 * Unified login — one endpoint for org admin, admin, and employee.
 * @route POST /api/v1/both/auth/login
 */
export const unifiedLogin = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const requestId = req.id;

  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return sendValidationError(res, { email: 'Invalid email format' });
  }

  logger.debug('Unified login attempt', { requestId, email: normalizedEmail });

  const result = await performUnifiedLogin({ email, password, requestId });

  if (!result.ok) {
    if (result.status === 400) {
      return sendValidationError(res, { email: result.message });
    }
    if (result.status === 403) {
      return sendForbidden(res, result.message);
    }
    return sendUnauthorized(res, result.message);
  }

  const { session } = result;
  const orgIdForToken =
    result.organization?.id ??
    result.employee?.organizationId ??
    result.user?.organizationId ??
    null;

  const tokenResult = generateToken(
    session.jwtUserId,
    session.jwtRole,
    orgIdForToken,
    res,
    session.passwordChangedAt,
    session.extraClaims
  );

  const timezoneContext = result.timezoneContext ?? null;

  logger.info('Unified login successful', {
    requestId,
    email: normalizedEmail,
    jwtRole: session.jwtRole,
    platformRoles: result.platformRoles,
    hasEmployeeProfile: !!result.employee,
  });

  return sendSuccess(
    res,
    {
      sessionRole: session.jwtRole,
      platformRoles: result.platformRoles,
      permissions: result.permissions,
      roleBuckets: result.roleBuckets,
      permissionFlags: result.permissionFlags,
      dataScope: result.dataScope,
      availablePortals: result.availablePortals,
      dashboardRoute: result.dashboardRoute,
      employeeDashboardRoute: result.employeeDashboardRoute,
      isOrganizationLogin: result.isOrganizationLogin,
      user: result.user,
      employee: result.employee,
      organization: result.organization,
      timezone: timezoneContext?.timezone || 'UTC',
      timezoneContext,
      token: typeof tokenResult === 'object' ? tokenResult.token : tokenResult,
      refreshToken:
        typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined,
      csrfToken: typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined,
    },
    'Login successful'
  );
});
