/**
 * Platform-level roles on User (login account).
 * Legacy JWT role field remains 'admin' | 'employee' | 'platform' for middleware routing.
 *
 * Note: PLATFORM_ROLES are org-scoped (tenant). SaaS operators use SAAS_OPERATOR_ROLES
 * and are not assignable via org "platform-roles" admin UI.
 */
export const PLATFORM_ROLES = Object.freeze({
  ORG_OWNER: 'org_owner',
  /** Full HRIS admin (maps to hr_manager permission bucket) */
  HR_ADMIN: 'hr_admin',
  /** Day-to-day HR ops — limited permissions vs hr_admin */
  HR_EXECUTIVE: 'hr_executive',
  PAYROLL_ADMIN: 'payroll_admin',
  MANAGER: 'manager',
  EMPLOYEE: 'employee',
});

/** Cross-tenant SaaS operator roles (control panel). Not org-assignable. */
export const SAAS_OPERATOR_ROLES = Object.freeze({
  /** Full power including operators + config */
  SUPER_ADMIN: 'platform_super_admin',
  /** Manage orgs, plans, entitlements */
  SAAS_ADMIN: 'platform_saas_admin',
  /** Support: org ops, no plan/operator edits */
  SUPPORT: 'platform_support',
  /** Read-only control panel */
  READONLY: 'platform_readonly',
  /** Legacy full operator (treated as SAAS_ADMIN) */
  PLATFORM_OPERATOR: 'platform_operator',
});

export const ORG_ADMIN_PLATFORM_ROLES = [
  PLATFORM_ROLES.ORG_OWNER,
  PLATFORM_ROLES.HR_ADMIN,
];

export const ALL_PLATFORM_ROLES = Object.values(PLATFORM_ROLES);

export const ALL_SAAS_OPERATOR_ROLES = Object.values(SAAS_OPERATOR_ROLES);

export const isPlatformOperatorRoles = (roles = []) =>
  Array.isArray(roles) && roles.some((r) => ALL_SAAS_OPERATOR_ROLES.includes(r));

/** Control-panel permission keys */
export const PLATFORM_PERMISSIONS = Object.freeze({
  ORGS_READ: 'orgs_read',
  ORGS_WRITE: 'orgs_write',
  PLANS_WRITE: 'plans_write',
  OPERATORS_WRITE: 'operators_write',
  AUDIT_READ: 'audit_read',
  BILLING_WRITE: 'billing_write',
});

const ALL_PERMS = Object.values(PLATFORM_PERMISSIONS);

const ROLE_PERMISSION_MAP = {
  [SAAS_OPERATOR_ROLES.SUPER_ADMIN]: ALL_PERMS,
  [SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR]: ALL_PERMS,
  [SAAS_OPERATOR_ROLES.SAAS_ADMIN]: [
    PLATFORM_PERMISSIONS.ORGS_READ,
    PLATFORM_PERMISSIONS.ORGS_WRITE,
    PLATFORM_PERMISSIONS.PLANS_WRITE,
    PLATFORM_PERMISSIONS.AUDIT_READ,
    PLATFORM_PERMISSIONS.BILLING_WRITE,
  ],
  [SAAS_OPERATOR_ROLES.SUPPORT]: [
    PLATFORM_PERMISSIONS.ORGS_READ,
    PLATFORM_PERMISSIONS.ORGS_WRITE,
    PLATFORM_PERMISSIONS.AUDIT_READ,
  ],
  [SAAS_OPERATOR_ROLES.READONLY]: [
    PLATFORM_PERMISSIONS.ORGS_READ,
    PLATFORM_PERMISSIONS.AUDIT_READ,
  ],
};

export const resolveOperatorPermissions = (roles = []) => {
  const perms = new Set();
  (roles || []).forEach((role) => {
    (ROLE_PERMISSION_MAP[role] || []).forEach((p) => perms.add(p));
  });
  // JWT role platform with no fine roles → legacy full access
  if (!perms.size && roles?.length === 0) {
    ALL_PERMS.forEach((p) => perms.add(p));
  }
  return [...perms];
};

export const operatorHasPermission = (roles, permission) =>
  resolveOperatorPermissions(roles).includes(permission);
