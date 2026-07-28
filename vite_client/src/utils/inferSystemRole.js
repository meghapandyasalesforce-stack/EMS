import { SYSTEM_ROLE_IDS } from './systemRoles';

const normalize = (value) => String(value || '').toLowerCase().trim();

const EXECUTIVE_POSITIONS = new Set(['ceo', 'cto', 'cfo', 'vp']);
const LINE_MANAGER_POSITIONS = new Set(['lead', 'supervisor', 'manager', 'director']);
const PAYROLL_LEAD_POSITIONS = new Set(['manager', 'director']);

const isHrDepartment = (dept) => dept === 'hr' || dept.includes('human resource');

const isFinanceDepartment = (dept) => dept === 'finance' || dept.includes('finance');

/**
 * Client mirror of server/helpers/inferSystemRoleFromWorkInfo.js
 * @returns {{ systemRoleId: string, reason: string | null }}
 */
export const inferSystemRoleFromWorkInfo = ({ department, jobTitle, position } = {}) => {
  const dept = normalize(department);
  const title = normalize(jobTitle);
  const pos = normalize(position);

  if (EXECUTIVE_POSITIONS.has(pos)) {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.EXECUTIVE,
      reason: `Executive position (${position})`,
    };
  }

  if (title === 'hr manager') {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.HR_MANAGER,
      reason: 'Job title: HR Manager',
    };
  }

  if (isHrDepartment(dept)) {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.HR_EXECUTIVE,
      reason: 'Department: HR',
    };
  }

  if (isFinanceDepartment(dept) && PAYROLL_LEAD_POSITIONS.has(pos)) {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.PAYROLL_ADMIN,
      reason: 'Finance leadership (payroll administration)',
    };
  }

  if (title === 'project manager') {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.PROJECT_MANAGER,
      reason: 'Job title: Project Manager',
    };
  }

  if (title === 'product manager' && LINE_MANAGER_POSITIONS.has(pos)) {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.LINE_MANAGER,
      reason: 'Product Manager with people-management position',
    };
  }

  if (LINE_MANAGER_POSITIONS.has(pos)) {
    return {
      systemRoleId: SYSTEM_ROLE_IDS.LINE_MANAGER,
      reason: `People-management position (${position})`,
    };
  }

  return {
    systemRoleId: SYSTEM_ROLE_IDS.EMPLOYEE,
    reason: null,
  };
};

export default inferSystemRoleFromWorkInfo;
