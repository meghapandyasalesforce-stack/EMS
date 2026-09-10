/**
 * Functional role resolution (legacy department/position fallback).
 */

/** Department / title signals that mark someone as HR staff. */
export const hasHrProfileSignals = (employee) => {
  const dept = (employee?.department || '').toLowerCase().trim();
  const pos = (employee?.position || '').toLowerCase().trim();
  const jobTitle = (employee?.jobTitle || '').toLowerCase().trim();

  return (
    dept === 'hr' ||
    dept.includes('hr') ||
    dept.includes('human resource') ||
    jobTitle.includes('hr manager') ||
    jobTitle.includes('human resource') ||
    jobTitle.includes('hr') ||
    (pos.includes('hr') && pos.includes('manager'))
  );
};

const deriveFunctionalRolesFromLegacy = (employee) => {
  const roles = [];
  const dept = (employee.department || '').toLowerCase().trim();
  const pos = (employee.position || '').toLowerCase().trim();
  const jobTitle = (employee.jobTitle || '').toLowerCase().trim();

  if (hasHrProfileSignals(employee)) {
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

/** Fields needed to resolve HR staff status on an applicant record. */
export const HR_ROLE_SELECT = 'functionalRoles department position jobTitle userId email';

/** Platform roles that make the linked user HR, mirroring permissionService buckets. */
const HR_PLATFORM_ROLES = new Set(['hr_admin', 'hr_executive']);

/**
 * HR check that does not depend on the legacy fallback firing. A stored
 * functionalRoles value such as ['executive'] suppresses that fallback, so an
 * HR Manager would otherwise read as non-HR here while staying HR everywhere else.
 */
export const isHrApplicantEmployee = (employee) =>
  isHrStaffEmployee(employee) || hasHrProfileSignals(employee);

/**
 * HR applicants among the given employee records, resolved in one extra query.
 * Falls back to the linked user's platform roles for HR staff whose profile
 * carries no HR department or title.
 */
export const resolveHrApplicantIds = async (employees = []) => {
  const hrIds = new Set();
  const unresolved = [];

  for (const employee of employees) {
    if (!employee?._id) continue;
    if (isHrApplicantEmployee(employee)) hrIds.add(String(employee._id));
    else unresolved.push(employee);
  }
  if (!unresolved.length) return hrIds;

  const userIds = unresolved.map((e) => e.userId).filter(Boolean);
  const emails = unresolved.map((e) => e.email).filter(Boolean);
  if (!userIds.length && !emails.length) return hrIds;

  const User = (await import('../models/user.model.js')).default;
  const users = await User.find({
    $or: [{ _id: { $in: userIds } }, { email: { $in: emails } }],
  })
    .select('email roles')
    .lean();

  const hrUsers = users.filter((u) => {
    const roles = Array.isArray(u.roles) ? u.roles : [];
    // Org owners implicitly carry hr_admin, so that alone must not mark them HR staff.
    if (roles.includes('org_owner')) return false;
    return roles.some((r) => HR_PLATFORM_ROLES.has(r));
  });
  const hrUserIds = new Set(hrUsers.map((u) => String(u._id)));
  const hrEmails = new Set(hrUsers.map((u) => String(u.email || '').toLowerCase()));

  for (const employee of unresolved) {
    const byId = employee.userId && hrUserIds.has(String(employee.userId));
    const byEmail = employee.email && hrEmails.has(String(employee.email).toLowerCase());
    if (byId || byEmail) hrIds.add(String(employee._id));
  }

  return hrIds;
};

/**
 * Leave / regularization raised BY HR staff is decided by the org admin only:
 * HR cannot approve its own request and a line manager cannot approve HR's.
 * Applies to the applicant's role — HR acting on someone else's request is unaffected.
 */
export const applicantRequiresOrgAdminApproval = async (applicantId) => {
  if (!applicantId) return false;
  const Employee = (await import('../models/employee.model.js')).default;
  const applicant = await Employee.findById(applicantId).select(HR_ROLE_SELECT).lean();
  if (!applicant) return false;
  const hrIds = await resolveHrApplicantIds([applicant]);
  return hrIds.has(String(applicant._id));
};

export const assertApplicantApprovalAccess = async (req, applicantId, label = 'this request') => {
  if (req.authContext?.isOrgOwner) return;
  if (!(await applicantRequiresOrgAdminApproval(applicantId))) return;
  const err = new Error(
    `${label} was raised by HR staff and can only be approved or rejected by an organization admin`
  );
  err.statusCode = 403;
  throw err;
};

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
