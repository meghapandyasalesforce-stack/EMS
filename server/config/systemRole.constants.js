import { ROLE_PERMISSION_MAP, ROLE_BUCKETS } from './permissions.constants.js';

/** SaaS-style system roles shown in Add Employee / Users & Roles UI */
export const SYSTEM_ROLE_IDS = Object.freeze({
  EMPLOYEE: 'employee',
  HR_EXECUTIVE: 'hr_executive',
  HR_MANAGER: 'hr_manager',
  PAYROLL_ADMIN: 'payroll_admin',
  LINE_MANAGER: 'line_manager',
  PROJECT_MANAGER: 'project_manager',
  EXECUTIVE: 'executive',
});

export const ALL_SYSTEM_ROLE_IDS = Object.values(SYSTEM_ROLE_IDS);

/**
 * Maps a system role to stored workforce + platform roles.
 * Platform roles apply to linked User (created on register when needed).
 */
export const SYSTEM_ROLE_DEFINITIONS = Object.freeze({
  [SYSTEM_ROLE_IDS.EMPLOYEE]: {
    label: 'Employee',
    shortLabel: 'Employee',
    description: 'Self-service portal: punch in/out, apply for leave, view own payroll.',
    functionalRoles: [],
    platformRoles: ['employee'],
    primaryBucket: ROLE_BUCKETS.EMPLOYEE,
  },
  [SYSTEM_ROLE_IDS.HR_EXECUTIVE]: {
    label: 'HR Executive',
    shortLabel: 'HR Executive',
    description:
      'Day-to-day HR: view and edit employees, leave and attendance, ID cards. Cannot add employees or publish payroll.',
    functionalRoles: ['hr'],
    platformRoles: ['hr_executive', 'employee'],
    primaryBucket: ROLE_BUCKETS.HR_EXECUTIVE,
  },
  [SYSTEM_ROLE_IDS.HR_MANAGER]: {
    label: 'HR Manager',
    shortLabel: 'HR Manager',
    description:
      'Full HR administration: add employees, policies, payroll processing, and org HR settings.',
    functionalRoles: ['hr'],
    platformRoles: ['hr_admin', 'employee'],
    primaryBucket: ROLE_BUCKETS.HR_MANAGER,
  },
  [SYSTEM_ROLE_IDS.PAYROLL_ADMIN]: {
    label: 'Payroll Admin',
    shortLabel: 'Payroll Admin',
    description: 'Payroll operations: create, process, and publish payroll. View employee records.',
    functionalRoles: ['finance'],
    platformRoles: ['payroll_admin', 'employee'],
    primaryBucket: ROLE_BUCKETS.PAYROLL_ADMIN,
  },
  [SYSTEM_ROLE_IDS.LINE_MANAGER]: {
    label: 'Line Manager',
    shortLabel: 'Manager',
    description:
      'People manager: sees only direct reports (My Team), team leave, and team attendance. Not org-wide HR.',
    functionalRoles: ['manager'],
    platformRoles: ['employee'],
    primaryBucket: ROLE_BUCKETS.LINE_MANAGER,
  },
  [SYSTEM_ROLE_IDS.PROJECT_MANAGER]: {
    label: 'Project Manager',
    shortLabel: 'Project Manager',
    description:
      'Org-wide project admin: create and manage projects, assign any employee. Not a people manager (no team leave/attendance).',
    functionalRoles: ['project_manager'],
    platformRoles: ['employee'],
    primaryBucket: ROLE_BUCKETS.PROJECT_MANAGER,
  },
  [SYSTEM_ROLE_IDS.EXECUTIVE]: {
    label: 'Executive',
    shortLabel: 'Executive',
    description: 'Leadership view: executive dashboard, org-wide HR and payroll visibility.',
    functionalRoles: ['executive'],
    platformRoles: ['employee'],
    primaryBucket: ROLE_BUCKETS.EXECUTIVE,
  },
});

export const buildRoleCatalog = () =>
  ALL_SYSTEM_ROLE_IDS.map((id) => {
    const def = SYSTEM_ROLE_DEFINITIONS[id];
    const perms = ROLE_PERMISSION_MAP[def.primaryBucket] || [];
    return {
      id,
      label: def.label,
      shortLabel: def.shortLabel,
      description: def.description,
      primaryBucket: def.primaryBucket,
      permissionCount: perms.length,
      permissionPreview: perms.slice(0, 8),
    };
  });
