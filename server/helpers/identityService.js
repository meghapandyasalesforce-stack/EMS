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
  if (!employee) return null;
  if (employee.userId) {
    const linkedUser = await User.findById(employee.userId).select('passwordChangedAt');
    if (linkedUser) {
      return linkedUser.passwordChangedAt || null;
    }
  }
  return employee?.passwordChangedAt || null;
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

/**
 * Permanent Admin/CEO org-chart root (isOrgOwnerRoot). Independent of Me / employeeProfileId.
 */
export const findOrgOwnerRootEmployee = async (organizationId) => {
  if (!organizationId) return null;
  return Employee.findOne({
    organizationId,
    isOrgOwnerRoot: true,
    status: { $ne: 'terminated' },
  }).sort({ createdAt: 1 });
};

/**
 * Drop legacy fully-unique email+org index so Admin/CEO root and one Me Employee
 * may share the org-owner login email. Idempotent.
 */
let ownerEmailIndexReady = false;
async function ensureOwnerEmailDualRecordIndexes() {
  if (ownerEmailIndexReady) return;
  ownerEmailIndexReady = true;
  try {
    const indexes = await Employee.collection.indexes();
    const legacy = indexes.find(
      (idx) =>
        idx.name === 'email_1_organizationId_1' &&
        idx.unique === true &&
        !idx.partialFilterExpression
    );
    if (legacy) {
      await Employee.collection.dropIndex(legacy.name);
    }
    await Employee.syncIndexes();
  } catch (err) {
    ownerEmailIndexReady = false;
    // Non-fatal: create may still fail with E11000 until indexes are migrated
  }
}

/**
 * Org owner's Me-tab workforce profile (at most one).
 * Never returns the permanent isOrgOwnerRoot Employee — that is the chart root, not Me.
 */
export const findOrgOwnerEmployeeProfile = async (orgOwnerUser, organizationId) => {
  if (!orgOwnerUser || !organizationId) return null;

  if (orgOwnerUser.employeeProfileId) {
    const byLink = await Employee.findOne({
      _id: orgOwnerUser.employeeProfileId,
      organizationId,
      isOrgOwnerRoot: { $ne: true },
      status: { $ne: 'terminated' },
    });
    if (byLink) return byLink;
  }

  return Employee.findOne({
    organizationId,
    userId: orgOwnerUser._id,
    isOrgOwnerRoot: { $ne: true },
    status: { $ne: 'terminated' },
  }).sort({ createdAt: 1 });
};

/** Resolve org owner's Me-tab workforce profile (read-only). */
export const resolveOrgOwnerMeProfile = async (orgOwnerUser, organizationId) => {
  if (!orgOwnerUser || !organizationId) return null;
  return findOrgOwnerEmployeeProfile(orgOwnerUser, organizationId);
};

/**
 * Count non-root Employees using the org-owner login email (the allowed Me slot).
 */
export const countOrgOwnerMeEmailEmployees = async (organizationId, ownerEmail) => {
  const email = String(ownerEmail || '').toLowerCase().trim();
  if (!organizationId || !email) return 0;
  return Employee.countDocuments({
    organizationId,
    email,
    isOrgOwnerRoot: { $ne: true },
    status: { $ne: 'terminated' },
  });
};

/**
 * Link one Employee as the org owner's Me profile (User.employeeProfileId).
 * Never modifies the permanent isOrgOwnerRoot Admin/CEO Employee.
 */
export const linkOrgOwnerMeProfile = async (orgOwnerUser, employeeId, organizationId) => {
  if (!orgOwnerUser?._id || !employeeId || !organizationId) {
    return { ok: false, code: 'INVALID_INPUT', message: 'Missing org owner, employee, or organization.' };
  }

  const employee = await Employee.findOne({ _id: employeeId, organizationId });
  if (!employee) {
    return { ok: false, code: 'NOT_FOUND', message: 'Employee not found in this organization.' };
  }

  if (employee.isOrgOwnerRoot === true) {
    return {
      ok: false,
      code: 'CANNOT_LINK_ROOT_AS_ME',
      message: 'The permanent Admin/CEO root cannot be linked as the Me profile.',
    };
  }

  const userDoc = await User.findById(orgOwnerUser._id);
  if (!userDoc) {
    return { ok: false, code: 'NOT_FOUND', message: 'Organization owner account not found.' };
  }

  const previousProfileId = userDoc.employeeProfileId;
  if (previousProfileId && String(previousProfileId) !== String(employeeId)) {
    // Unlink prior Me only — never touch the org-owner root
    await Employee.updateOne(
      {
        _id: previousProfileId,
        organizationId,
        isOrgOwnerRoot: { $ne: true },
      },
      { $unset: { userId: '' } }
    );
  }

  await Employee.updateMany(
    {
      organizationId,
      userId: userDoc._id,
      _id: { $ne: employeeId },
      isOrgOwnerRoot: { $ne: true },
    },
    { $unset: { userId: '' } }
  );

  await linkUserToEmployeeProfile(userDoc, employee);

  return { ok: true, employee, user: userDoc };
};

/**
 * Generate a unique employeeId for the org-owner root profile.
 */
async function generateOrgOwnerRootEmployeeId(organizationId, name) {
  const namePrefix = String(name || 'ADM').substring(0, 3).toUpperCase() || 'ADM';
  const joiningYear = new Date().getFullYear();
  for (let attempts = 0; attempts < 12; attempts += 1) {
    const random = Math.floor(1000 + Math.random() * 9000);
    const candidate = `EMP-${namePrefix}-${joiningYear}-${random}`;
    const existing = await Employee.findOne({ employeeId: candidate, organizationId }).select('_id').lean();
    if (!existing) return candidate;
  }
  return `EMP-${namePrefix}-${joiningYear}-${Date.now().toString().slice(-4)}`;
}

/**
 * Ensure a permanent Admin/CEO Employee exists as the org-chart root (isOrgOwnerRoot).
 * Idempotent. Does NOT set User.employeeProfileId (Me is a separate Employee).
 * Never overwrites or links the root as the Me profile.
 */
export const ensureOrgOwnerEmployeeRoot = async (orgOwnerUser, organizationId, options = {}) => {
  if (!orgOwnerUser?._id || !organizationId) {
    return { ok: false, created: false, linked: false, code: 'INVALID_INPUT', message: 'Missing org owner or organization.' };
  }

  await ensureOwnerEmailDualRecordIndexes();

  const userDoc = await User.findById(orgOwnerUser._id);
  if (!userDoc) {
    return { ok: false, created: false, linked: false, code: 'NOT_FOUND', message: 'Organization owner account not found.' };
  }

  if (!isOrgOwnerUser(userDoc)) {
    return { ok: false, created: false, linked: false, code: 'NOT_ORG_OWNER', message: 'User is not the organization owner.' };
  }

  const email = String(userDoc.email || '').toLowerCase().trim();
  if (!email) {
    return { ok: false, created: false, linked: false, code: 'INVALID_EMAIL', message: 'Organization owner email is required.' };
  }

  let existing = await findOrgOwnerRootEmployee(organizationId);

  if (existing) {
    let dirty = false;
    if (!existing.isOrgOwnerRoot) {
      existing.isOrgOwnerRoot = true;
      dirty = true;
    }
    if (existing.managerId) {
      existing.managerId = null;
      dirty = true;
    }
    if (existing.manager !== 'Admin') {
      existing.manager = 'Admin';
      dirty = true;
    }
    if (!String(existing.position || '').trim()) {
      existing.position = 'CEO';
      dirty = true;
    }
    if (!String(existing.jobTitle || '').trim() || existing.jobTitle === 'Organization Admin') {
      existing.jobTitle = 'CEO';
      dirty = true;
    }
    if (!String(existing.department || '').trim()) {
      existing.department = 'Administration';
      dirty = true;
    }
    if (!String(existing.jobCategory || '').trim()) {
      existing.jobCategory = 'Administration';
      dirty = true;
    }
    if (dirty) {
      await existing.save();
    }

    return { ok: true, created: false, linked: false, employee: existing };
  }

  const displayName = String(userDoc.name || '').trim() || 'Admin';
  const employeeId = await generateOrgOwnerRootEmployeeId(organizationId, displayName);

  const jobTitle =
    String(options.jobTitle || userDoc.title || '').trim() || 'CEO';
  const position =
    String(options.position || userDoc.position || '').trim() || 'CEO';
  const department = String(options.department || '').trim() || 'Administration';
  const jobCategory = String(options.jobCategory || '').trim() || 'Administration';

  const employee = new Employee({
    organizationId,
    // Root is chart identity only — Me uses userId + employeeProfileId on a separate Employee
    name: displayName,
    lastName: '',
    email,
    password: unifiedAuthPlaceholderPassword(),
    phone1: userDoc.phone || undefined,
    employeeId,
    joiningDate: new Date(),
    salary: 0,
    department,
    jobTitle,
    position,
    jobCategory,
    manager: 'Admin',
    managerId: null,
    role: 'employee',
    status: 'active',
    active: true,
    isOrgOwnerRoot: true,
    mustResetPassword: false,
    hasCompletedFirstLogin: true,
  });

  employee._skipFunctionalRoleInference = true;

  try {
    await employee.save();
  } catch (err) {
    if (err?.code === 11000) {
      const raced = await findOrgOwnerRootEmployee(organizationId);
      if (raced) {
        return { ok: true, created: false, linked: false, employee: raced };
      }
    }
    throw err;
  }

  return { ok: true, created: true, linked: false, employee };
};

