import { formatPermissionDisplayLabel } from './textFormat.js';

/** Client mirror of server SaaS system roles (systemRole.constants.js) */
export const SYSTEM_ROLE_IDS = {
  EMPLOYEE: 'employee',
  HR_EXECUTIVE: 'hr_executive',
  HR_MANAGER: 'hr_manager',
  PAYROLL_ADMIN: 'payroll_admin',
  LINE_MANAGER: 'line_manager',
  PROJECT_MANAGER: 'project_manager',
  EXECUTIVE: 'executive',
};

export const DEFAULT_SYSTEM_ROLE = SYSTEM_ROLE_IDS.EMPLOYEE;

export const formatPermissionLabel = (perm) => formatPermissionDisplayLabel(perm);
