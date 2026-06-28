import logger from '../helpers/logger.js';
import {
  extractToken,
  verifyToken,
  handleAuthError,
  hydrateRequestIdentity,
} from './authHelpers.js';
import {
  resolveAuthContext,
  hasAnyPermission,
  hasAllPermissions,
} from '../helpers/permissionService.js';
import { LEGACY_ACCESS, PERMISSIONS } from '../config/permissions.constants.js';
import { hasPermission } from '../helpers/permissionService.js';

/**
 * Attach req.authContext { permissions, role buckets, scope } from JWT.
 */
export const attachAuthContext = async (req, res, next) => {
  try {
    if (req.authContext) {
      if (!req.organizationId && (!req.user || !req.employee) && req.decoded) {
        await hydrateRequestIdentity(req, req.decoded, req.authContext);
      }
      return next();
    }

    const token = extractToken(req);
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        code: 'NO_TOKEN',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return handleAuthError(error, res);
    }

    req.authContext = await resolveAuthContext(decoded, req);
    req.decoded = decoded;
    await hydrateRequestIdentity(req, decoded, req.authContext);
    return next();
  } catch (error) {
    logger.error('attachAuthContext failed', { error: error.message });
    return res.status(500).json({
      success: false,
      message: 'Server authentication error',
      code: 'SERVER_ERROR',
    });
  }
};

export const requireAnyPermission = (permissionList, options = {}) => {
  const { message = 'Access denied', code = 'INSUFFICIENT_PERMISSIONS' } = options;
  return [
    attachAuthContext,
    (req, res, next) => {
      if (hasAnyPermission(req.authContext, permissionList)) {
        return next();
      }
      logger.warn('Permission denied', {
        path: req.path,
        required: permissionList,
        held: req.authContext?.permissions?.slice(0, 12),
        buckets: req.authContext?.buckets,
      });
      return res.status(403).json({ success: false, message, code });
    },
  ];
};

export const requireAllPermissions = (permissionList, options = {}) => {
  const { message = 'Access denied', code = 'INSUFFICIENT_PERMISSIONS' } = options;
  return [
    attachAuthContext,
    (req, res, next) => {
      if (hasAllPermissions(req.authContext, permissionList)) {
        return next();
      }
      return res.status(403).json({ success: false, message, code });
    },
  ];
};

/** Compose middleware array into one Express handler */
export const composeMiddleware = (middlewares) => {
  const flat = middlewares.flat();
  return (req, res, next) => {
    let index = 0;
    const dispatch = (err) => {
      if (err) return next(err);
      const layer = flat[index++];
      if (!layer) return next();
      layer(req, res, dispatch);
    };
    dispatch();
  };
};

/** Shorthand for legacy middleware groups */
export const requireLegacyAccess = (legacyKey, options) =>
  composeMiddleware(requireAnyPermission(LEGACY_ACCESS[legacyKey] || [], options));

const gate =
  (predicate, message = 'Access denied') =>
  composeMiddleware([
    attachAuthContext,
    (req, res, next) => {
      if (predicate(req.authContext)) return next();
      return res.status(403).json({
        success: false,
        message,
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    },
  ]);

/** Former isAdminAuthenticated — org owner or HR manager */
export const requireOrgOwnerOrHrManager = gate(
  (ctx) => ctx?.isOrgOwner || ctx?.isHrManager,
  'Access restricted to organization owners and HR managers'
);

/** HR document management — HR staff, org admin, or delegated HR managers. */
export const requireHrDocumentAccess = composeMiddleware([
  attachAuthContext,
  async (req, res, next) => {
    const { canAccessHrDocumentManagement } = await import('../helpers/functionalRolesHelper.js');
    if (!(await canAccessHrDocumentManagement(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only HR can access all employee documents',
        code: 'HR_ONLY',
      });
    }
    return next();
  },
]);

/** HR ID card management — HR staff, org admin, or delegated HR managers. */
export const requireHrIdCardAccess = composeMiddleware([
  attachAuthContext,
  async (req, res, next) => {
    const { canAccessHrDocumentManagement } = await import('../helpers/functionalRolesHelper.js');
    if (!(await canAccessHrDocumentManagement(req))) {
      return res.status(403).json({
        success: false,
        message: 'Only HR can manage employee ID cards',
        code: 'HR_ONLY',
      });
    }
    return next();
  },
]);

/** Former isAdminOrHR */
export const requireHrStaff = composeMiddleware(
  requireAnyPermission([
    PERMISSIONS.PAYROLL_PROCESS,
    PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE,
    PERMISSIONS.ATTENDANCE_RULE_MANAGE,
    PERMISSIONS.LEAVE_POLICY_MANAGE,
  ])
);

/** Former isAdminOrHROrExecutive */
export const requireHrOrExecutive = requireLegacyAccess('HR_OR_EXECUTIVE', {
  message: 'Access restricted to admins, HR personnel, and executives only',
});

/** Former isAdminOrManagerOrHR */
export const requireManagerHrOrExecutive = requireLegacyAccess('MANAGER_HR_OR_EXEC', {
  message: 'Access restricted to admins, HR personnel, managers, and executives only',
});

/** Former isAdminOrExecutive */
export const requireExecutiveAccess = composeMiddleware(
  requireAnyPermission([PERMISSIONS.EXECUTIVE_DASHBOARD])
);

/** Payroll publish / visibility toggle */
export const requirePayrollPublish = composeMiddleware(
  requireAnyPermission([PERMISSIONS.PAYROLL_PUBLISH])
);

export const requireEmployeeCreate = composeMiddleware(
  requireAnyPermission([PERMISSIONS.EMPLOYEE_CREATE])
);

export const requireEmployeeDelete = composeMiddleware(
  requireAnyPermission([PERMISSIONS.EMPLOYEE_DELETE])
);

export const requireEmployeeList = composeMiddleware(
  requireAnyPermission([
    PERMISSIONS.EMPLOYEE_VIEW_ALL,
    PERMISSIONS.EMPLOYEE_VIEW_TEAM,
  ])
);
