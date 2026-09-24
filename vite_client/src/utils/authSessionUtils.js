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
      employeeProfileId:
        adminBase?.employeeProfileId ??
        payloadEmployee._id ??
        payloadEmployee.id,
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

/**
 * Whether the current session belongs to an HRMS workforce/platform user.
 * Uses the same session fields populated by checkAuthSession() and login — not email heuristics.
 */
export function isHrmsAuthenticatedUser({
  user = null,
  employee = null,
  permissions = [],
  roleBuckets = [],
  permissionFlags = {},
} = {}) {
  const hasPermissions = Array.isArray(permissions) && permissions.length > 0;
  const hasRoleBuckets = Array.isArray(roleBuckets) && roleBuckets.length > 0;

  const flags = permissionFlags || {};
  const hasPlatformContext = Boolean(
    flags.isOrgOwner ||
    flags.isHrManager ||
    flags.isHrExecutive ||
    flags.isPayrollAdmin ||
    flags.isLineManager ||
    flags.isProjectManager ||
    flags.isExecutive
  );

  // Session restored via checkAuthSession permissions (workforce/platform context)
  if (hasPermissions || hasRoleBuckets || hasPlatformContext) {
    return true;
  }

  if (!user) return false;

  return (
    Boolean(employee?._id || employee?.id) ||
    Boolean(user?.employeeProfileId)
  );
}

/** Routes that must stay reachable without forcing HRMS login (guest / external visitors). */
export function isPublicGuestRoute(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return (
    pathname.startsWith('/careers/') ||
    pathname.startsWith('/application/') ||
    pathname.startsWith('/offer/')
  );
}

/** SaaS platform control-panel routes (separate from HRMS guest portals). */
export function isPlatformRoute(pathname) {
  if (!pathname || typeof pathname !== 'string') return false;
  return pathname.startsWith('/platform');
}

/** Allow only internal Career Portal return paths after login. */
export function getSafeCareerReturnTo(value) {
  if (!value || typeof value !== 'string') return null;
  let decoded = value.trim();
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    return null;
  }
  if (!decoded.startsWith('/careers/')) return null;
  if (decoded.startsWith('//')) return null;
  if (decoded.includes('\\') || decoded.includes('..')) return null;
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(decoded)) return null;
  const pathOnly = decoded.split('?')[0].split('#')[0];
  if (!pathOnly.startsWith('/careers/')) return null;
  return decoded;
}
