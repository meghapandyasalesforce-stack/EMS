import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import { isOrgOwnerUser } from './identityService.js';
import { PLATFORM_ROLES } from '../config/identity.constants.js';
import {
  PERMISSIONS,
  ROLE_BUCKETS,
  ROLE_PERMISSION_MAP,
} from '../config/permissions.constants.js';
import { getEffectiveFunctionalRoles } from './functionalRolesHelper.js';

const HR_ADMIN_ALIASES = new Set([PLATFORM_ROLES.HR_ADMIN, ROLE_BUCKETS.HR_MANAGER]);

/**
 * Resolve role buckets for the current principal.
 */
export const resolveRoleBuckets = async (decoded, req = {}) => {
  const buckets = new Set([ROLE_BUCKETS.EMPLOYEE]);
  const platformRoles = new Set([
    ...(Array.isArray(decoded?.platformRoles) ? decoded.platformRoles : []),
  ]);

  let user = req.user || null;
  let employee = req.employee || null;

  if (decoded?.role === 'admin') {
    if (!user) {
      user = await User.findById(decoded.userId)
        .select('name email roles role organizationId')
        .lean();
    }
    if (Array.isArray(user?.roles)) {
      user.roles.forEach((r) => platformRoles.add(r));
    }
    if (user?.role === 'admin' && platformRoles.size === 0) {
      if (isOrgOwnerUser(user)) {
        platformRoles.add(PLATFORM_ROLES.ORG_OWNER);
        platformRoles.add(PLATFORM_ROLES.HR_ADMIN);
      }
    }
    if (platformRoles.has(PLATFORM_ROLES.ORG_OWNER)) {
      buckets.add(ROLE_BUCKETS.ORG_OWNER);
    }
    if ([...platformRoles].some((r) => HR_ADMIN_ALIASES.has(r))) {
      buckets.add(ROLE_BUCKETS.HR_MANAGER);
    }
    if (platformRoles.has(PLATFORM_ROLES.HR_EXECUTIVE)) {
      buckets.add(ROLE_BUCKETS.HR_EXECUTIVE);
    }
    if (platformRoles.has(PLATFORM_ROLES.PAYROLL_ADMIN)) {
      buckets.add(ROLE_BUCKETS.PAYROLL_ADMIN);
    }
    if (decoded.employeeProfileId && !employee) {
      employee = await Employee.findById(decoded.employeeProfileId)
        .select(
          'name lastName email employeeId functionalRoles department departmentId position jobTitle organizationId status active isManager isHR manager managerId userId accessDataScope accessDepartmentIds'
        )
        .lean();
    }
  } else if (decoded?.role === 'employee') {
    if (!employee) {
      employee = await Employee.findById(decoded.userId)
        .select(
          'name lastName email employeeId functionalRoles department departmentId position jobTitle organizationId status active isManager isHR manager managerId userId accessDataScope accessDepartmentIds'
        )
        .lean();
    }
    if (employee?.userId) {
      user = await User.findById(employee.userId)
        .select('name email roles role organizationId')
        .lean();
    }
    if (!user && employee?.email) {
      user = await User.findOne({
        email: employee.email,
        organizationId: employee.organizationId,
      })
        .select('name email roles role organizationId')
        .lean();
    }
    if (user) {
      if (Array.isArray(user?.roles)) {
        user.roles.forEach((r) => platformRoles.add(r));
      }
      if (platformRoles.has(PLATFORM_ROLES.ORG_OWNER)) {
        buckets.add(ROLE_BUCKETS.ORG_OWNER);
      }
      if ([...platformRoles].some((r) => HR_ADMIN_ALIASES.has(r))) {
        buckets.add(ROLE_BUCKETS.HR_MANAGER);
      }
      if (platformRoles.has(PLATFORM_ROLES.HR_EXECUTIVE)) {
        buckets.add(ROLE_BUCKETS.HR_EXECUTIVE);
      }
      if (platformRoles.has(PLATFORM_ROLES.PAYROLL_ADMIN)) {
        buckets.add(ROLE_BUCKETS.PAYROLL_ADMIN);
      }
    }
  }

  const functionalRoles = employee ? getEffectiveFunctionalRoles(employee) : [];
  const jobTitle = String(employee?.jobTitle || '').toLowerCase().trim();

  // Job title distinguishes HR Manager vs HR Executive (both use functionalRoles: ['hr'])
  if (jobTitle === 'hr manager') {
    buckets.add(ROLE_BUCKETS.HR_MANAGER);
    buckets.delete(ROLE_BUCKETS.HR_EXECUTIVE); // job title wins over stale hr_executive on User
  } else if (functionalRoles.includes('hr') && !buckets.has(ROLE_BUCKETS.HR_MANAGER)) {
    buckets.add(ROLE_BUCKETS.HR_EXECUTIVE);
  }

  // Line manager (people manager) vs project manager are separate buckets.
  // Job title "Project Manager" with a stale LINE_MANAGER functional role is treated as PM.
  const hasProjectManagerRole = functionalRoles.includes('project_manager');
  const hasLineManagerRole = functionalRoles.includes('manager');
  const isProjectManagerTitle = jobTitle === 'project manager';

  if (hasProjectManagerRole || isProjectManagerTitle) {
    buckets.add(ROLE_BUCKETS.PROJECT_MANAGER);
  }

  if (hasLineManagerRole) {
    // Mis-inferred: Project Manager title stored as manager-only → PM bucket only
    if (isProjectManagerTitle && !hasProjectManagerRole) {
      buckets.add(ROLE_BUCKETS.PROJECT_MANAGER);
    } else {
      buckets.add(ROLE_BUCKETS.LINE_MANAGER);
    }
  }

  if (functionalRoles.includes('finance')) {
    buckets.add(ROLE_BUCKETS.PAYROLL_ADMIN);
  }
  if (
    functionalRoles.some((r) =>
      ['executive', 'ceo', 'cto', 'cfo', 'vp'].includes(r)
    )
  ) {
    buckets.add(ROLE_BUCKETS.EXECUTIVE);
  }

  return {
    buckets: [...buckets],
    platformRoles: [...platformRoles],
    functionalRoles,
    user,
    employee,
    jwtRole: decoded?.role,
  };
};

export const permissionsFromBuckets = (buckets) => {
  const perms = new Set();
  for (const bucket of buckets) {
    const list = ROLE_PERMISSION_MAP[bucket] || [];
    list.forEach((p) => perms.add(p));
  }
  return [...perms];
};

export const resolveAuthContext = async (decoded, req = {}) => {
  if (decoded?.role === 'platform') {
    return {
      buckets: [],
      platformRoles: ['platform_operator'],
      functionalRoles: [],
      user: null,
      employee: null,
      jwtRole: 'platform',
      permissions: [],
      isOrgOwner: false,
      isHrManager: false,
      isHrExecutive: false,
      isPayrollAdmin: false,
      isLineManager: false,
      isProjectManager: false,
      isExecutive: false,
      isPlatformOperator: true,
    };
  }

  const roleInfo = await resolveRoleBuckets(decoded, req);
  const permissions = permissionsFromBuckets(roleInfo.buckets);
  return {
    ...roleInfo,
    permissions,
    isOrgOwner: roleInfo.buckets.includes(ROLE_BUCKETS.ORG_OWNER),
    isHrManager: roleInfo.buckets.includes(ROLE_BUCKETS.HR_MANAGER),
    isHrExecutive: roleInfo.buckets.includes(ROLE_BUCKETS.HR_EXECUTIVE),
    isPayrollAdmin: roleInfo.buckets.includes(ROLE_BUCKETS.PAYROLL_ADMIN),
    isLineManager: roleInfo.buckets.includes(ROLE_BUCKETS.LINE_MANAGER),
    isProjectManager: roleInfo.buckets.includes(ROLE_BUCKETS.PROJECT_MANAGER),
    isExecutive: roleInfo.buckets.includes(ROLE_BUCKETS.EXECUTIVE),
    isPlatformOperator: false,
  };
};

export const hasPermission = (authContext, permission) => {
  if (!authContext?.permissions) return false;
  if (authContext.isOrgOwner) return true;
  return authContext.permissions.includes(permission);
};

export const hasAnyPermission = (authContext, permissionList = []) => {
  if (!permissionList.length) return true;
  if (authContext?.isOrgOwner) return true;
  return permissionList.some((p) => hasPermission(authContext, p));
};

export const hasAllPermissions = (authContext, permissionList = []) => {
  if (!permissionList.length) return true;
  if (authContext?.isOrgOwner) return true;
  return permissionList.every((p) => hasPermission(authContext, p));
};

/**
 * True when the requester is a people manager who must only see their direct reports.
 * Does NOT use !req.user (linked User accounts used to skip team filters incorrectly).
 * Pure project managers are excluded (org roster for project membership).
 */
export const shouldScopeDataToManagedTeam = (req) => {
  if (!req?.employee?._id) return false;

  const ctx = req.authContext;
  if (ctx) {
    if (ctx.isOrgOwner || ctx.isHrManager || ctx.isHrExecutive) return false;
    if (ctx.isExecutive && hasPermission(ctx, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
      return false;
    }
    if (ctx.isPayrollAdmin && hasPermission(ctx, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
      return false;
    }
    // People managers are team-scoped even if they also have project_manager
    if (ctx.isLineManager) return true;
    return false;
  }

  // Legacy fallback when authContext was not attached
  return Boolean(req.employee?.isManager && !req.employee?.isHR);
};

/** Data scope for list endpoints — role default, overridable via employee.accessDataScope */
export const getDataScope = (authContext) => {
  const override = String(authContext?.employee?.accessDataScope || 'default').toLowerCase();
  if (
    override === 'organization' ||
    override === 'department' ||
    override === 'departments' ||
    override === 'team' ||
    override === 'self'
  ) {
    return override;
  }

  if (authContext?.isOrgOwner || authContext?.isHrManager || authContext?.isHrExecutive) {
    if (hasPermission(authContext, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
      return 'organization';
    }
  }
  if (authContext?.isExecutive && hasPermission(authContext, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
    return 'organization';
  }
  if (authContext?.isPayrollAdmin && hasPermission(authContext, PERMISSIONS.EMPLOYEE_VIEW_ALL)) {
    return 'organization';
  }
  // Department-scoped HR (employee.departmentId when enforced in queries)
  if (
    (authContext?.isHrManager || authContext?.isHrExecutive) &&
    hasPermission(authContext, PERMISSIONS.EMPLOYEE_VIEW_TEAM) &&
    !hasPermission(authContext, PERMISSIONS.EMPLOYEE_VIEW_ALL) &&
    authContext?.employee?.departmentId
  ) {
    return 'department';
  }
  if (authContext?.isLineManager) {
    return 'team';
  }
  if (authContext?.isProjectManager) {
    return 'organization';
  }
  return 'self';
};
