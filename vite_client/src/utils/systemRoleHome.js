import { SYSTEM_ROLE_IDS } from './systemRoles';

/**
 * Zoho-style: System Role chooses product home/dashboard.
 * Org Structure (dept/job/designation) does not.
 */
export const SYSTEM_ROLE_HOME = Object.freeze({
  [SYSTEM_ROLE_IDS.EMPLOYEE]: {
    path: '/dashboard-employee',
    label: 'Employee home',
  },
  [SYSTEM_ROLE_IDS.HR_EXECUTIVE]: {
    path: '/dashboard-hr',
    label: 'HR home',
  },
  [SYSTEM_ROLE_IDS.HR_MANAGER]: {
    path: '/dashboard-hr',
    label: 'HR home',
  },
  [SYSTEM_ROLE_IDS.PAYROLL_ADMIN]: {
    path: '/dashboard-finance',
    label: 'Finance / payroll home',
  },
  [SYSTEM_ROLE_IDS.LINE_MANAGER]: {
    path: '/dashboard-manager',
    label: 'Manager home',
  },
  [SYSTEM_ROLE_IDS.PROJECT_MANAGER]: {
    path: '/dashboard-manager',
    label: 'Manager / projects home',
  },
  [SYSTEM_ROLE_IDS.EXECUTIVE]: {
    path: '/dashboard-administration',
    label: 'Leadership home',
  },
});

export function getSystemRoleHome(systemRoleId) {
  return SYSTEM_ROLE_HOME[systemRoleId] || SYSTEM_ROLE_HOME[SYSTEM_ROLE_IDS.EMPLOYEE];
}
