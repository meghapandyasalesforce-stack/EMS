/**
 * Session bootstrap helpers — keep auth.user consistent after checkAuthSession.
 */

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

  return (
    (existingUser?.role || '').toLowerCase() === 'admin' ||
    (payloadUser?.role || '').toLowerCase() === 'admin' ||
    roleFromStorage === 'admin' ||
    Boolean(permissionFlags.isOrgOwner)
  );
}

/**
 * Build auth.user after checkAuthSession without downgrading admin → employee
 * when a linked employee profile is also returned.
 */
export function resolveSessionAuthUser(payload, existingUser, permissionFlags = {}) {
  const payloadUser = payload?.user || null;
  const payloadEmployee = payload?.employee || null;

  if (payloadUser) {
    return {
      ...payloadUser,
      _id: payloadUser._id ?? payloadUser.id,
      role: (payloadUser.role || 'admin').toLowerCase(),
    };
  }

  const adminSession = isAdminAuthSession({
    existingUser,
    payloadUser,
    permissionFlags,
  });

  if (payloadEmployee && adminSession) {
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
