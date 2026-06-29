/**
 * Session bootstrap helpers — keep auth.user consistent after checkAuthSession.
 */

import { isDelegatedStaff } from './portalConfig';

/**
 * Whether the current session is an organization administrator (not delegated employee login).
 */
export function isAdminAuthSession({
  existingUser = null,
  payloadUser = null,
  permissionFlags = {},
  storedRole = null,
} = {}) {
  const roleFromStorage =
    storedRole ??
    (typeof localStorage !== 'undefined' ? localStorage.getItem('role') : null);

  if (Boolean(permissionFlags.isOrgOwner)) return true;

  if (isDelegatedStaff(permissionFlags)) return false;

  return (
    (existingUser?.role || '').toLowerCase() === 'admin' ||
    (payloadUser?.role || '').toLowerCase() === 'admin' ||
    roleFromStorage === 'admin'
  );
}

/**
 * Build auth.user after checkAuthSession without downgrading admin → employee
 * when a linked employee profile is also returned.
 */
export function resolveSessionAuthUser(payload, existingUser, permissionFlags = {}) {
  const payloadUser = payload?.user || null;
  const payloadEmployee = payload?.employee || null;
  const isOrgOwner = Boolean(permissionFlags.isOrgOwner);

  // HR / manager staff: treat as employee session (no portal tabs)
  if (payloadEmployee && !isOrgOwner && isDelegatedStaff(permissionFlags)) {
    return {
      ...payloadEmployee,
      _id: payloadEmployee._id ?? payloadEmployee.id,
      role: 'employee',
      organizationId:
        payloadEmployee.organizationId ??
        payloadUser?.organizationId ??
        existingUser?.organizationId,
    };
  }

  if (payloadUser) {
    return {
      ...payloadUser,
      _id: payloadUser._id ?? payloadUser.id,
      role: (payloadUser.role || 'admin').toLowerCase(),
      employeeProfileId:
        payloadUser.employeeProfileId ?? payloadEmployee?._id ?? payloadEmployee?.id,
    };
  }

  const adminSession = isAdminAuthSession({
    existingUser,
    payloadUser,
    permissionFlags,
  });

  if (payloadEmployee && adminSession && isOrgOwner) {
    const adminBase =
      (existingUser?.role || '').toLowerCase() === 'admin' ? existingUser : null;
    return {
      ...(adminBase || {}),
      ...payloadEmployee,
      _id: adminBase?._id ?? payloadEmployee._id ?? payloadEmployee.id,
      role: 'admin',
      organizationId:
        adminBase?.organizationId ??
        payloadEmployee.organizationId ??
        existingUser?.organizationId,
    };
  }

  if (payloadEmployee) {
    return {
      ...payloadEmployee,
      _id: payloadEmployee._id ?? payloadEmployee.id,
      role: (payloadEmployee.role || 'employee').toLowerCase(),
    };
  }

  return existingUser || null;
}

/** Resolve Redux user role on login — delegated staff always use employee role. */
export function resolveLoginSessionRole(sessionRole, permissionFlags = {}, hasEmployee = false) {
  const isOrgOwner = Boolean(permissionFlags.isOrgOwner);
  if (!isOrgOwner && isDelegatedStaff(permissionFlags) && hasEmployee) {
    return 'employee';
  }
  return sessionRole || 'employee';
}
