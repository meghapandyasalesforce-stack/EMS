/**
 * Platform operator account management.
 */

import asyncHandler from '../../helpers/asyncHandler.js';
import User from '../../models/user.model.js';
import {
  sendSuccess,
  sendNotFound,
  sendValidationError,
  sendError,
} from '../../helpers/responseHelper.js';
import {
  SAAS_OPERATOR_ROLES,
  ALL_SAAS_OPERATOR_ROLES,
  isPlatformOperatorRoles,
  resolveOperatorPermissions,
} from '../../config/identity.constants.js';
import { logPlatformAction } from '../../helpers/platformAudit.js';
import { normalizeEmail } from '../../helpers/authHelpers.js';

const ASSIGNABLE_OPERATOR_ROLES = [
  SAAS_OPERATOR_ROLES.SUPER_ADMIN,
  SAAS_OPERATOR_ROLES.SAAS_ADMIN,
  SAAS_OPERATOR_ROLES.SUPPORT,
  SAAS_OPERATOR_ROLES.READONLY,
];

const ROLE_LABELS = {
  [SAAS_OPERATOR_ROLES.SUPER_ADMIN]: 'Super admin',
  [SAAS_OPERATOR_ROLES.SAAS_ADMIN]: 'SaaS admin',
  [SAAS_OPERATOR_ROLES.SUPPORT]: 'Support',
  [SAAS_OPERATOR_ROLES.READONLY]: 'Read-only',
  [SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR]: 'Operator (legacy)',
};

const normalizeOperatorRoles = (rolesInput) => {
  if (!rolesInput) return [SAAS_OPERATOR_ROLES.SUPPORT];
  const list = Array.isArray(rolesInput) ? rolesInput : [rolesInput];
  const cleaned = [...new Set(list.map((r) => String(r).trim()).filter(Boolean))];
  const invalid = cleaned.filter((r) => !ALL_SAAS_OPERATOR_ROLES.includes(r));
  if (invalid.length) {
    return { error: `Invalid roles: ${invalid.join(', ')}` };
  }
  if (!cleaned.length) return [SAAS_OPERATOR_ROLES.SUPPORT];
  return cleaned;
};

/**
 * GET /api/v1/platform/operators
 */
export const listOperators = asyncHandler(async (req, res) => {
  const operators = await User.find({
    $or: [{ role: 'platform' }, { roles: { $in: ALL_SAAS_OPERATOR_ROLES } }],
  })
    .select('name email roles role isActive createdAt')
    .sort({ createdAt: -1 })
    .lean();

  return sendSuccess(res, {
    operators: operators.map((u) => ({
      id: u._id,
      name: u.name,
      email: u.email,
      roles: u.roles || [],
      permissions: resolveOperatorPermissions(u.roles || []),
      isActive: u.isActive !== false,
      createdAt: u.createdAt,
      isSelf: String(u._id) === String(req.platformOperator?._id),
    })),
    assignableRoles: ASSIGNABLE_OPERATOR_ROLES.map((id) => ({
      id,
      label: ROLE_LABELS[id] || id,
    })),
  });
});

/**
 * POST /api/v1/platform/operators
 */
export const createOperator = asyncHandler(async (req, res) => {
  const { name, email, password, roles: rolesInput } = req.body;
  const normalizedEmail = normalizeEmail(email);

  if (!name || !normalizedEmail || !password) {
    return sendValidationError(res, {
      name: !name ? 'Required' : undefined,
      email: !normalizedEmail ? 'Invalid email' : undefined,
      password: !password ? 'Required' : undefined,
    });
  }
  if (String(password).length < 8) {
    return sendValidationError(res, { password: 'Must be at least 8 characters' });
  }

  const roles = normalizeOperatorRoles(rolesInput);
  if (roles.error) {
    return sendValidationError(res, { roles: roles.error });
  }

  const existing = await User.findOne({ email: normalizedEmail });
  if (existing) {
    if (existing.role === 'platform' || isPlatformOperatorRoles(existing.roles)) {
      return sendError(res, 'Operator already exists', 409, 'OPERATOR_EXISTS');
    }
    return sendError(res, 'Email already used by another account', 409, 'EMAIL_IN_USE');
  }

  const user = new User({
    name: String(name).trim(),
    email: normalizedEmail,
    password,
    role: 'platform',
    roles,
    organizationId: null,
    isActive: true,
    emailVerified: true,
  });
  await user.save();

  await logPlatformAction({
    req,
    action: 'create_operator',
    entityType: 'PlatformOperator',
    entityId: user._id,
    summary: `Created operator ${user.email} (${roles.join(', ')})`,
  });

  return sendSuccess(
    res,
    {
      operator: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        permissions: resolveOperatorPermissions(user.roles),
        isActive: true,
      },
    },
    'Operator created',
    201
  );
});

/**
 * PATCH /api/v1/platform/operators/:userId
 */
export const updateOperator = asyncHandler(async (req, res) => {
  const { userId } = req.params;
  const { isActive, password, name, roles: rolesInput } = req.body;

  const user = await User.findById(userId).select('+password');
  if (!user || (user.role !== 'platform' && !isPlatformOperatorRoles(user.roles))) {
    return sendNotFound(res, 'Operator not found');
  }

  if (typeof isActive === 'boolean') {
    if (!isActive && String(user._id) === String(req.platformOperator?._id)) {
      return sendError(res, 'Cannot deactivate your own account', 400, 'CANNOT_DEACTIVATE_SELF');
    }
    user.isActive = isActive;
  }
  if (name !== undefined) user.name = String(name).trim();
  if (password) {
    if (String(password).length < 8) {
      return sendValidationError(res, { password: 'Must be at least 8 characters' });
    }
    user.password = password;
  }
  if (rolesInput !== undefined) {
    if (String(user._id) === String(req.platformOperator?._id)) {
      return sendError(res, 'Cannot change your own roles', 400, 'CANNOT_CHANGE_OWN_ROLES');
    }
    const roles = normalizeOperatorRoles(rolesInput);
    if (roles.error) {
      return sendValidationError(res, { roles: roles.error });
    }
    user.roles = roles;
  }
  await user.save();

  await logPlatformAction({
    req,
    action: password ? 'reset_operator_password' : 'update_operator',
    entityType: 'PlatformOperator',
    entityId: user._id,
    summary: `Updated operator ${user.email}`,
  });

  return sendSuccess(
    res,
    {
      operator: {
        id: user._id,
        name: user.name,
        email: user.email,
        roles: user.roles,
        permissions: resolveOperatorPermissions(user.roles),
        isActive: user.isActive,
      },
    },
    'Operator updated'
  );
});
