/**
 * Functional role resolution (legacy department/position fallback).
 */

const deriveFunctionalRolesFromLegacy = (employee) => {
  const roles = [];
  const dept = (employee.department || '').toLowerCase().trim();
  const pos = (employee.position || '').toLowerCase().trim();
  const jobTitle = (employee.jobTitle || '').toLowerCase().trim();

  if (
    dept === 'hr' ||
    dept.includes('hr') ||
    dept.includes('human resource') ||
    jobTitle.includes('hr manager') ||
    jobTitle.includes('human resource') ||
    jobTitle.includes('hr') ||
    (pos.includes('hr') && pos.includes('manager'))
  ) {
    roles.push('hr');
  }

  if (jobTitle === 'project manager') {
    roles.push('project_manager');
  }

  if (
    jobTitle !== 'project manager' &&
    (pos === 'manager' ||
      pos === 'director' ||
      pos.includes('manager') ||
      pos.includes('director') ||
      jobTitle.includes('manager') ||
      jobTitle.includes('director'))
  ) {
    roles.push('manager');
  }

  if (
    pos === 'ceo' ||
    pos === 'cto' ||
    pos === 'cfo' ||
    pos === 'vp' ||
    pos === 'vice president' ||
    pos.includes('chief executive') ||
    pos.includes('chief technology') ||
    pos.includes('chief financial') ||
    pos.includes('vice president')
  ) {
    if (pos === 'ceo' || pos.includes('chief executive')) roles.push('ceo');
    if (pos === 'cto' || pos.includes('chief technology')) roles.push('cto');
    if (pos === 'cfo' || pos.includes('chief financial')) roles.push('cfo');
    if (pos === 'vp' || pos === 'vice president') roles.push('vp');
    roles.push('executive');
  }

  if (dept === 'finance' || dept.includes('finance')) {
    roles.push('finance');
  }

  if (
    dept === 'engineering' ||
    dept === 'it support' ||
    dept.includes('engineering') ||
    dept.includes('technology') ||
    jobTitle.includes('engineer') ||
    jobTitle.includes('developer')
  ) {
    roles.push('tech');
  }

  return [...new Set(roles)];
};

export const getEffectiveFunctionalRoles = (employee) => {
  const roles = Array.isArray(employee?.functionalRoles) ? employee.functionalRoles : [];
  return roles.length > 0 ? roles : deriveFunctionalRolesFromLegacy(employee);
};

/** True when employee record resolves to HR functional role (platform admin role ignored). */
export const isHrStaffEmployee = (employee) =>
  !!employee && getEffectiveFunctionalRoles(employee).includes('hr');

/** Load requester's employee profile and check HR staff (not org admin alone). */
export const loadRequesterHrStaff = async (req) => {
  if (!req.employee?._id) return false;
  const Employee = (await import('../models/employee.model.js')).default;
  const employee = await Employee.findById(req.employee._id)
    .select('functionalRoles department position jobTitle')
    .lean();
  return isHrStaffEmployee(employee);
};

/** Org owner / platform admin (may lack a linked employee profile). */
export const isOrgAdminRequest = (req) => {
  const role = (req.user?.role || req.decoded?.role || '').toLowerCase();
  if (role === 'admin') return true;
  return Boolean(req.authContext?.isOrgOwner);
};

/** HR document & ID-card management — HR staff or org admin / HR portal delegates. */
export const canAccessHrDocumentManagement = async (req) => {
  if (isOrgAdminRequest(req)) return true;
  if (req.authContext?.isHrManager || req.authContext?.isHrExecutive) return true;
  return loadRequesterHrStaff(req);
};

const EXECUTIVE_ROLE_KEYS = new Set(['executive', 'ceo', 'cto', 'cfo', 'vp']);

/**
 * Attach legacy controller flags (isManager, isHR, etc.) from functional roles.
 */
export const enrichEmployeeRoleFlags = (employee) => {
  if (!employee) return employee;

  const effectiveRoles = getEffectiveFunctionalRoles(employee);
  const jobTitle = (employee.jobTitle || '').toLowerCase().trim();
  const isProjectManager =
    effectiveRoles.includes('project_manager') || jobTitle === 'project manager';

  return {
    ...employee,
    functionalRoles: effectiveRoles,
    isHR: effectiveRoles.includes('hr'),
    isManager: effectiveRoles.includes('manager'),
    isProjectManager,
    isExecutive: effectiveRoles.some((role) => EXECUTIVE_ROLE_KEYS.has(role)),
  };
};
