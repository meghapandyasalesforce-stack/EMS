import asyncHandler from '../../helpers/asyncHandler.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import { sendSuccess, sendNotFound, sendValidationError } from '../../helpers/responseHelper.js';
import { ALL_PLATFORM_ROLES } from '../../config/identity.constants.js';
import { buildRoleCatalog } from '../../config/systemRole.constants.js';
import {
  assignSystemRoleToEmployee,
  getSystemRoleDefinition,
  getPermissionPreviewForSystemRole,
  resolveSystemRoleFromRecords,
} from '../../helpers/systemRoleService.js';
import { getOrganizationId } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';

const VALID_FUNCTIONAL = new Set([
  'hr',
  'manager',
  'project_manager',
  'finance',
  'executive',
  'ceo',
  'cto',
  'cfo',
  'vp',
]);

/**
 * PATCH body: { roles: string[] }
 * Assign platform roles on a User (org_owner, hr_admin, hr_executive, payroll_admin, …).
 */
export const updateUserPlatformRoles = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { roles } = req.body;
  const organizationId = getOrganizationId(req);

  if (!Array.isArray(roles) || roles.length === 0) {
    return sendValidationError(res, { roles: 'roles must be a non-empty array' });
  }

  const invalid = roles.filter((r) => !ALL_PLATFORM_ROLES.includes(r));
  if (invalid.length) {
    return sendValidationError(res, {
      roles: `Invalid roles: ${invalid.join(', ')}. Allowed: ${ALL_PLATFORM_ROLES.join(', ')}`,
    });
  }

  const user = await User.findOne({ _id: userId, organizationId });
  if (!user) {
    return sendNotFound(res, 'User not found');
  }

  user.roles = [...new Set(roles)];
  await user.save();

  logger.info('Platform roles updated', { userId: user._id, roles: user.roles, organizationId });

  return sendSuccess(res, { userId: user._id, roles: user.roles }, 'Platform roles updated');
});

/**
 * PATCH body: { functionalRoles: string[] }
 * Assign workforce functional roles on an Employee profile.
 */
export const updateEmployeeFunctionalRoles = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { functionalRoles } = req.body;
  const organizationId = getOrganizationId(req);

  if (!Array.isArray(functionalRoles)) {
    return sendValidationError(res, { functionalRoles: 'functionalRoles must be an array' });
  }

  const invalid = functionalRoles.filter((r) => !VALID_FUNCTIONAL.has(r));
  if (invalid.length) {
    return sendValidationError(res, {
      functionalRoles: `Invalid: ${invalid.join(', ')}`,
    });
  }

  const employee = await Employee.findOne({ _id: employeeId, organizationId });
  if (!employee) {
    return sendNotFound(res, 'Employee not found');
  }

  employee.functionalRoles = [...new Set(functionalRoles)];
  await employee.save();

  logger.info('Functional roles updated', {
    employeeId: employee._id,
    functionalRoles: employee.functionalRoles,
    organizationId,
  });

  return sendSuccess(
    res,
    { employeeId: employee._id, functionalRoles: employee.functionalRoles },
    'Functional roles updated'
  );
});

/** GET SaaS system role catalog for Add Employee / Users & Roles UI */
export const getSystemRoleCatalog = asyncHandler(async (_req, res) => {
  return sendSuccess(res, { catalog: buildRoleCatalog() });
});

/** GET org roster with resolved system roles + linked User platform roles */
export const getUsersRolesRoster = asyncHandler(async (req, res) => {
  const organizationId = getOrganizationId(req);

  const employees = await Employee.find({ organizationId })
    .select('name lastName email jobTitle position department functionalRoles userId employeeId status')
    .sort({ name: 1, lastName: 1 })
    .lean();

  const userIds = employees.filter((e) => e.userId).map((e) => e.userId);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } }).select('roles email').lean()
    : [];
  const userMap = new Map(users.map((u) => [String(u._id), u]));

  const roster = employees.map((emp) => {
    const user = emp.userId ? userMap.get(String(emp.userId)) : null;
    const systemRoleId = resolveSystemRoleFromRecords(emp, user);
    const def = getSystemRoleDefinition(systemRoleId);
    return {
      employeeId: emp._id,
      name: `${emp.name || ''} ${emp.lastName || ''}`.trim(),
      email: emp.email,
      jobTitle: emp.jobTitle,
      department: emp.department,
      status: emp.status,
      systemRoleId,
      systemRoleLabel: def.shortLabel || def.label,
      hasLinkedUser: !!user,
      userId: user?._id,
      platformRoles: user?.roles || [],
      functionalRoles: emp.functionalRoles || [],
    };
  });

  return sendSuccess(res, { roster, catalog: buildRoleCatalog() });
});

/** GET access info for one employee (Access tab) */
export const getEmployeeAccess = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const organizationId = getOrganizationId(req);

  const employee = await Employee.findOne({ _id: employeeId, organizationId }).lean();
  if (!employee) {
    return sendNotFound(res, 'Employee not found');
  }

  let user = null;
  if (employee.userId) {
    user = await User.findById(employee.userId).select('roles email').lean();
  } else if (employee.email) {
    user = await User.findOne({ email: employee.email, organizationId })
      .select('roles email _id')
      .lean();
  }

  const systemRoleId = resolveSystemRoleFromRecords(employee, user);
  const def = getSystemRoleDefinition(systemRoleId);

  return sendSuccess(res, {
    employeeId: employee._id,
    systemRoleId,
    systemRoleLabel: def.label,
    description: def.description,
    hasLinkedUser: !!user,
    userId: user?._id,
    platformRoles: user?.roles || [],
    functionalRoles: employee.functionalRoles || [],
    catalog: buildRoleCatalog(),
    permissionPreview: getPermissionPreviewForSystemRole(systemRoleId),
  });
});

/** PATCH body: { systemRole: string } — assign SaaS system role */
export const assignEmployeeSystemRole = asyncHandler(async (req, res) => {
  const { employeeId } = req.params;
  const { systemRole } = req.body;
  const organizationId = getOrganizationId(req);

  if (!systemRole || typeof systemRole !== 'string') {
    return sendValidationError(res, { systemRole: 'systemRole is required' });
  }

  try {
    const result = await assignSystemRoleToEmployee({
      employeeId,
      systemRoleId: systemRole,
      organizationId,
    });

    return sendSuccess(
      res,
      {
        employeeId: result.employee._id,
        systemRoleId: result.systemRoleId,
        resolvedRole: result.resolvedRole,
        functionalRoles: result.functionalRoles,
        platformRoles: result.platformRoles,
        permissionPreview: result.permissionPreview,
      },
      'System role updated. The user should log out and back in for permissions to refresh.'
    );
  } catch (err) {
    if (err.message === 'Employee not found') {
      return sendNotFound(res, err.message);
    }
    return sendValidationError(res, { systemRole: err.message });
  }
});
