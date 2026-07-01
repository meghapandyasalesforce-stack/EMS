import crypto from 'crypto';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import {
  PLATFORM_ROLES,
  ORG_ADMIN_PLATFORM_ROLES,
} from '../config/identity.constants.js';

/** Placeholder password for Employee rows linked to User (never used for login). */
export const unifiedAuthPlaceholderPassword = () =>
  crypto.randomBytes(32).toString('hex');

export const isOrgAdminUser = (user) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return ORG_ADMIN_PLATFORM_ROLES.some((r) => roles.includes(r));
};

/** Merge platform roles onto a User document (in-memory; caller saves). */
export const addPlatformRoles = (user, rolesToAdd = []) => {
  const current = Array.isArray(user.roles) ? [...user.roles] : [];
  const merged = new Set([...current, ...rolesToAdd]);
  user.roles = [...merged];
  return user.roles;
};

/**
 * Resolve which account receives a password-reset token.
 * Unified employees (employee.userId) always reset the linked User password.
 */
export const resolvePasswordResetTarget = async (email, organizationId = null) => {
  const baseFilter = { email };
  if (organizationId) {
    baseFilter.organizationId = organizationId;
  }

  const employee = await Employee.findOne(baseFilter);
  const user = await User.findOne(baseFilter);

  if (employee?.userId) {
    const authUser = await User.findById(employee.userId);
    if (authUser) {
      return { account: authUser, userType: 'admin', linked: true };
    }
  }

  if (user && employee) {
    if (isOrgAdminUser(user)) {
      return { account: user, userType: 'admin', linked: false };
    }
    return { account: employee, userType: 'employee', linked: false };
  }

  if (employee) {
    return { account: employee, userType: 'employee', linked: false };
  }

  if (user) {
    return { account: user, userType: 'admin', linked: false };
  }

  return null;
};

/** Verify login password for an employee (delegates to User when linked). */
export const verifyEmployeeLoginPassword = async (employee, candidatePassword) => {
  if (employee.userId) {
    const linkedUser = await User.findById(employee.userId).select('+password');
    if (!linkedUser) return false;
    return linkedUser.comparePassword(candidatePassword);
  }
  return employee.comparePassword(candidatePassword);
};

/** Lockout / active checks for employee login (User when unified). */
export const getEmployeeLoginAuthRecord = async (employee) => {
  if (employee.userId) {
    const linkedUser = await User.findById(employee.userId).select(
      '+password loginAttempts lockUntil isActive passwordChangedAt'
    );
    if (linkedUser) {
      return { record: linkedUser, type: 'user', unified: true };
    }
  }
  return { record: employee, type: 'employee', unified: false };
};

/** Password-changed timestamp for JWT when employee uses unified auth. */
export const getEmployeeTokenPasswordChangedAt = async (employee) => {
  if (employee.userId) {
    const linkedUser = await User.findById(employee.userId).select('passwordChangedAt createdAt');
    if (linkedUser) {
      return linkedUser.passwordChangedAt || linkedUser.createdAt;
    }
  }
  return employee.passwordChangedAt || employee.createdAt;
};

/** Link an existing org User to a new Employee HR profile. */
export const linkUserToEmployeeProfile = async (user, employee) => {
  addPlatformRoles(user, [PLATFORM_ROLES.EMPLOYEE]);
  user.employeeProfileId = employee._id;
  employee.userId = user._id;
  await user.save();
  await employee.save();
  return { user, employee };
};

/** Find org User for employee registration (same email, same org). */
export const findOrgUserForEmployeeEmail = async (normalizedEmail, organizationId) =>
  User.findOne({ email: normalizedEmail, organizationId });

/** True only for the organization owner account (not HR admin / delegated users). */
export const isOrgOwnerUser = (user) => {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.includes(PLATFORM_ROLES.ORG_OWNER)) return true;
  // Legacy org registrants: role admin with no delegated-only roles
  if (user.role === 'admin' && roles.length === 0) return true;
  return false;
};

/** Resolve the organization owner login for this tenant. */
export const resolveOrgOwnerUser = async (organizationId) => {
  if (!organizationId) return null;

  const withOwnerRole = await User.findOne({
    organizationId,
    roles: PLATFORM_ROLES.ORG_OWNER,
  });
  if (withOwnerRole) return withOwnerRole;

  return User.findOne({ organizationId, role: 'admin' }).sort({ createdAt: 1 });
};

/**
 * Org owner may share login with exactly one employee profile.
 * Returns the User only when email matches the org owner account in this org.
 */
export const findOrgOwnerUserForEmployeeEmail = async (normalizedEmail, organizationId) => {
  const orgOwner = await resolveOrgOwnerUser(organizationId);
  if (!orgOwner) return null;
  const ownerEmail = String(orgOwner.email || '').toLowerCase().trim();
  if (ownerEmail !== String(normalizedEmail || '').toLowerCase().trim()) return null;
  return orgOwner;
};

/** Existing workforce profile linked to org owner (at most one). */
export const findOrgOwnerEmployeeProfile = async (orgOwnerUser, organizationId, normalizedEmail) => {
  if (!orgOwnerUser || !organizationId) return null;

  const email = String(normalizedEmail || '').toLowerCase().trim();

  if (orgOwnerUser.employeeProfileId) {
    const byLink = await Employee.findOne({
      _id: orgOwnerUser.employeeProfileId,
      organizationId,
    });
    if (byLink) return byLink;
  }

  return Employee.findOne({
    organizationId,
    $or: [{ userId: orgOwnerUser._id }, ...(email ? [{ email }] : [])],
  }).sort({ createdAt: 1 });
};

/** Resolve org owner's Me-tab workforce profile (read-only). */
export const resolveOrgOwnerMeProfile = async (orgOwnerUser, organizationId) => {
  if (!orgOwnerUser || !organizationId) return null;
  const ownerEmail = String(orgOwnerUser.email || '').toLowerCase().trim();
  return findOrgOwnerEmployeeProfile(orgOwnerUser, organizationId, ownerEmail);
};

/**
 * Link one employee as the org owner's Me profile.
 * Clears prior links so only one profile shares the org owner login.
 */
export const linkOrgOwnerMeProfile = async (orgOwnerUser, employeeId, organizationId) => {
  if (!orgOwnerUser?._id || !employeeId || !organizationId) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Missing org owner, employee, or organization.' };
  }

  const employee = await Employee.findOne({ _id: employeeId, organizationId });
  if (!employee) {
    return { ok: false, code: 'NOT_FOUND', message: 'Employee not found in this organization.' };
  }

  const userDoc = await User.findById(orgOwnerUser._id);
  if (!userDoc) {
    return { ok: false, code: 'NOT_FOUND', message: 'Organization owner account not found.' };
  }

  const previousProfileId = userDoc.employeeProfileId;
  if (previousProfileId && String(previousProfileId) !== String(employeeId)) {
    await Employee.updateOne(
      { _id: previousProfileId, organizationId },
      { $unset: { userId: '' } }
    );
  }

  await Employee.updateMany(
    { organizationId, userId: userDoc._id, _id: { $ne: employeeId } },
    { $unset: { userId: '' } }
  );

  await linkUserToEmployeeProfile(userDoc, employee);

  return { ok: true, employee, user: userDoc };
};
