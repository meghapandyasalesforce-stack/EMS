/**
 * Platform-level roles on User (login account).
 * Legacy JWT role field remains 'admin' | 'employee' for middleware routing.
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

export const ORG_ADMIN_PLATFORM_ROLES = [
  PLATFORM_ROLES.ORG_OWNER,
  PLATFORM_ROLES.HR_ADMIN,
];

export const ALL_PLATFORM_ROLES = Object.values(PLATFORM_ROLES);
