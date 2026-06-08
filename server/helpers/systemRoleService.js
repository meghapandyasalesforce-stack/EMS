import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import { PLATFORM_ROLES } from '../config/identity.constants.js';
import {
  SYSTEM_ROLE_IDS,
  SYSTEM_ROLE_DEFINITIONS,
  ALL_SYSTEM_ROLE_IDS,
} from '../config/systemRole.constants.js';
import { ROLE_BUCKETS } from '../config/permissions.constants.js';
import { permissionsFromBuckets } from './permissionService.js';
import { linkUserToEmployeeProfile } from './identityService.js';
import logger from './logger.js';

export const getSystemRoleDefinition = (systemRoleId) =>
  SYSTEM_ROLE_DEFINITIONS[systemRoleId] || SYSTEM_ROLE_DEFINITIONS[SYSTEM_ROLE_IDS.EMPLOYEE];

export const systemRoleRequiresLinkedUser = (systemRoleId) => {
  const def = getSystemRoleDefinition(systemRoleId);
  return (
    systemRoleId !== SYSTEM_ROLE_IDS.EMPLOYEE &&
    (def.platformRoles?.length > 1 ||
      def.platformRoles?.some((r) =>
        [PLATFORM_ROLES.HR_ADMIN, PLATFORM_ROLES.HR_EXECUTIVE, PLATFORM_ROLES.PAYROLL_ADMIN].includes(r)
      ))
  );
};

/** Apply functional roles from system role (skips auto dept/position guessing). */
export const applySystemRoleToEmployee = (employee, systemRoleId) => {
  const def = getSystemRoleDefinition(systemRoleId);
  employee.functionalRoles = [...(def.functionalRoles || [])];
  // Prevent dept/job-title guessing from overriding an explicit SaaS role pick
  employee._skipFunctionalRoleInference = true;
  return employee;
};

/**
 * Infer current system role from employee + optional linked user.
 */
export const resolveSystemRoleFromRecords = (employee, user = null) => {
  if (!employee) return SYSTEM_ROLE_IDS.EMPLOYEE;

  const platformRoles = new Set([
    ...(Array.isArray(user?.roles) ? user.roles : []),
  ]);
  const functional = new Set(
    Array.isArray(employee.functionalRoles) ? employee.functionalRoles : []
  );

  if (platformRoles.has(PLATFORM_ROLES.ORG_OWNER) || platformRoles.has(PLATFORM_ROLES.HR_ADMIN)) {
    return SYSTEM_ROLE_IDS.HR_MANAGER;
  }
  if (platformRoles.has(PLATFORM_ROLES.PAYROLL_ADMIN) || functional.has('finance')) {
    return SYSTEM_ROLE_IDS.PAYROLL_ADMIN;
  }
  if (platformRoles.has(PLATFORM_ROLES.HR_EXECUTIVE) || functional.has('hr')) {
    return SYSTEM_ROLE_IDS.HR_EXECUTIVE;
  }
  if (
    functional.has('executive') ||
    functional.has('ceo') ||
    functional.has('cto') ||
    functional.has('cfo') ||
    functional.has('vp')
  ) {
    return SYSTEM_ROLE_IDS.EXECUTIVE;
  }
  if (functional.has('manager') || functional.has('project_manager')) {
    return SYSTEM_ROLE_IDS.LINE_MANAGER;
  }

  return SYSTEM_ROLE_IDS.EMPLOYEE;
};

export const getPermissionPreviewForSystemRole = (systemRoleId) => {
  const def = getSystemRoleDefinition(systemRoleId);
  const buckets = [def.primaryBucket, ROLE_BUCKETS.EMPLOYEE];
  return permissionsFromBuckets([...new Set(buckets)]);
};

/**
 * Create or update linked User for platform roles (SaaS-style login permissions).
 */
export const syncLinkedUserForSystemRole = async ({
  employee,
  systemRoleId,
  plaintextPassword = null,
  organizationId,
  existingUser = null,
}) => {
  const def = getSystemRoleDefinition(systemRoleId);
  const platformRoles = [...new Set(def.platformRoles || ['employee'])];

  let user = existingUser;
  if (!user && employee.userId) {
    user = await User.findById(employee.userId);
  }

  if (!user && systemRoleRequiresLinkedUser(systemRoleId)) {
    if (!plaintextPassword) {
      throw new Error('Password required to create login account for this system role');
    }
    user = new User({
      name: employee.name,
      email: employee.email,
      password: plaintextPassword,
      organizationId: organizationId || employee.organizationId,
      role: 'employee',
      roles: platformRoles,
    });
    await user.save();
    await linkUserToEmployeeProfile(user, employee);
    logger.info('Created linked User for system role', {
      employeeId: employee._id,
      userId: user._id,
      systemRoleId,
    });
    return user;
  }

  if (user) {
    const preserved = (user.roles || []).filter((r) => r === PLATFORM_ROLES.ORG_OWNER);
    user.roles = [...new Set([...preserved, ...platformRoles])];
    if (!user.employeeProfileId) {
      user.employeeProfileId = employee._id;
    }
    if (!employee.userId) {
      employee.userId = user._id;
      await employee.save();
    }
    await user.save();
    return user;
  }

  return null;
};

export const assignSystemRoleToEmployee = async ({
  employeeId,
  systemRoleId,
  organizationId,
  plaintextPassword = null,
}) => {
  if (!ALL_SYSTEM_ROLE_IDS.includes(systemRoleId)) {
    throw new Error(`Invalid system role: ${systemRoleId}`);
  }

  const employee = await Employee.findOne({ _id: employeeId, organizationId });
  if (!employee) {
    throw new Error('Employee not found');
  }

  applySystemRoleToEmployee(employee, systemRoleId);
  await employee.save();

  let user = null;
  if (employee.userId) {
    user = await User.findById(employee.userId);
  } else if (employee.email) {
    user = await User.findOne({ email: employee.email, organizationId });
  }

  user = await syncLinkedUserForSystemRole({
    employee,
    systemRoleId,
    plaintextPassword,
    organizationId,
    existingUser: user,
  });

  return {
    employee,
    user,
    systemRoleId,
    functionalRoles: employee.functionalRoles,
    platformRoles: user?.roles || [],
    resolvedRole: resolveSystemRoleFromRecords(employee, user),
    permissionPreview: getPermissionPreviewForSystemRole(systemRoleId),
  };
};
