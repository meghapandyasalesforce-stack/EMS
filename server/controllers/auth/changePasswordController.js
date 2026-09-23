/**
 * Change password while authenticated (SaaS-style account security).
 * Verifies current password, updates hash, re-issues session cookies.
 */

import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import {
  sendSuccess,
  sendError,
  sendValidationError,
  sendUnauthorized,
  sendNotFound,
} from '../../helpers/responseHelper.js';
import { generateToken } from '../../helpers/utils.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../helpers/asyncHandler.js';

const PASSWORD_RULES = {
  min: 8,
  max: 128,
  upper: /[A-Z]/,
  lower: /[a-z]/,
  digit: /[0-9]/,
  special: /[!@#$%^&*(),.?":{}|<>]/,
};

const validateNewPassword = (password) => {
  if (!password || password.length < PASSWORD_RULES.min || password.length > PASSWORD_RULES.max) {
    return 'Password must be between 8 and 128 characters';
  }
  if (!PASSWORD_RULES.upper.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!PASSWORD_RULES.lower.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!PASSWORD_RULES.digit.test(password)) {
    return 'Password must contain at least one number';
  }
  if (!PASSWORD_RULES.special.test(password)) {
    return 'Password must contain at least one special character';
  }
  return null;
};

/**
 * POST /api/v1/both/auth/change-password
 * Body: { currentPassword, newPassword, confirmPassword }
 */
export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword, confirmPassword } = req.body || {};
  const decoded = req.decoded;

  if (!currentPassword || !newPassword || !confirmPassword) {
    return sendValidationError(res, {
      currentPassword: !currentPassword ? 'Required' : undefined,
      newPassword: !newPassword ? 'Required' : undefined,
      confirmPassword: !confirmPassword ? 'Required' : undefined,
    });
  }

  if (newPassword !== confirmPassword) {
    return sendError(res, 'New password and confirmation do not match', 400, 'PASSWORD_MISMATCH');
  }

  if (currentPassword === newPassword) {
    return sendError(
      res,
      'New password must be different from your current password',
      400,
      'PASSWORD_UNCHANGED'
    );
  }

  const ruleError = validateNewPassword(newPassword);
  if (ruleError) {
    return sendError(res, ruleError, 400, 'WEAK_PASSWORD');
  }

  if (!decoded?.userId || !['admin', 'employee'].includes(decoded.role)) {
    return sendUnauthorized(res, 'Not authenticated');
  }

  let accountDoc = null;
  let accountKind = null; // 'user' | 'employee'
  let organizationId = decoded.organizationId || null;
  let extraClaims = {};

  if (decoded.role === 'admin') {
    accountDoc = await User.findById(decoded.userId).select('+password');
    if (!accountDoc) return sendNotFound(res, 'User account');
    accountKind = 'user';
    organizationId = accountDoc.organizationId || organizationId;
    if (accountDoc.employeeProfileId || decoded.employeeProfileId) {
      extraClaims.employeeProfileId = accountDoc.employeeProfileId || decoded.employeeProfileId;
    }
    if (Array.isArray(decoded.platformRoles) && decoded.platformRoles.length) {
      extraClaims.platformRoles = decoded.platformRoles;
    }
  } else {
    // Employee JWT userId is employee id
    const employee = await Employee.findById(decoded.userId).select('+password userId organizationId mustResetPassword');
    if (!employee) return sendNotFound(res, 'Employee');

    if (employee.userId) {
      accountDoc = await User.findById(employee.userId).select('+password');
      if (!accountDoc) return sendNotFound(res, 'Linked user account');
      accountKind = 'user';
      extraClaims.employeeProfileId = employee._id;
    } else {
      accountDoc = employee;
      accountKind = 'employee';
    }
    organizationId = employee.organizationId || organizationId;
  }

  const matches = await accountDoc.comparePassword(currentPassword);
  if (!matches) {
    return sendError(res, 'Current password is incorrect', 401, 'INVALID_CURRENT_PASSWORD');
  }

  accountDoc.password = newPassword;
  await accountDoc.save();

  // Clear forced-reset flag on employee if present
  if (decoded.role === 'employee' || extraClaims.employeeProfileId) {
    const empId = decoded.role === 'employee' ? decoded.userId : extraClaims.employeeProfileId;
    if (empId) {
      await Employee.findByIdAndUpdate(empId, { $set: { mustResetPassword: false } });
    }
  }

  const passwordChangedAt = accountDoc.passwordChangedAt || new Date();

  // For employee sessions, JWT userId must remain the employee id
  const jwtUserId = decoded.role === 'employee' ? decoded.userId : accountDoc._id;

  const tokenResult = generateToken(
    jwtUserId,
    decoded.role,
    organizationId,
    res,
    passwordChangedAt,
    Object.keys(extraClaims).length ? extraClaims : null
  );

  logger.info('Password changed in-session', {
    role: decoded.role,
    accountKind,
    userId: decoded.userId,
  });

  return sendSuccess(
    res,
    {
      changed: true,
      csrfToken: tokenResult?.csrfToken || null,
    },
    'Password updated successfully'
  );
});

export default { changePassword };
