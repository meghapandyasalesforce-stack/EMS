import { SYSTEM_ROLE_IDS } from './systemRoles';
import { inferSystemRoleFromWorkInfo } from './inferSystemRole';

/** Roles that warrant an explicit confirmation before assign (elevated access). */
export const ELEVATED_SYSTEM_ROLES = new Set([
  SYSTEM_ROLE_IDS.HR_MANAGER,
  SYSTEM_ROLE_IDS.HR_EXECUTIVE,
  SYSTEM_ROLE_IDS.EXECUTIVE,
  SYSTEM_ROLE_IDS.PAYROLL_ADMIN,
]);

export const isElevatedSystemRole = (roleId) => ELEVATED_SYSTEM_ROLES.has(roleId);

export const getRoleLabel = (roleId, catalog = []) =>
  catalog.find((role) => role.id === roleId)?.label || roleId || 'Employee';

export const getRoleMismatch = ({
  department,
  jobTitle,
  position,
  systemRoleId,
  suggestedRoleId: suggestedRoleIdInput,
  suggestedReason: suggestedReasonInput,
}) => {
  const inferred = inferSystemRoleFromWorkInfo({ department, jobTitle, position });
  const suggestedRoleId = suggestedRoleIdInput ?? inferred.systemRoleId;
  const suggestedReason = suggestedReasonInput ?? inferred.reason;
  const mismatch = Boolean(
    systemRoleId && suggestedRoleId && systemRoleId !== suggestedRoleId
  );

  return {
    mismatch,
    suggestedRoleId,
    suggestedReason,
  };
};

export const getElevatedRoleConfirmMessage = (roleId, roleLabel) => {
  if (roleId === SYSTEM_ROLE_IDS.HR_MANAGER) {
    return `${roleLabel} can add employees, manage policies, and run payroll. Only assign this if they are a trusted HR administrator.`;
  }
  if (roleId === SYSTEM_ROLE_IDS.HR_EXECUTIVE) {
    return `${roleLabel} can view and edit employee records, leave, and attendance across the organization.`;
  }
  if (roleId === SYSTEM_ROLE_IDS.EXECUTIVE) {
    return `${roleLabel} has leadership-level visibility across HR, payroll, and executive dashboards.`;
  }
  if (roleId === SYSTEM_ROLE_IDS.PAYROLL_ADMIN) {
    return `${roleLabel} can create, process, and publish payroll for the organization.`;
  }
  return `You are granting elevated system access (${roleLabel}).`;
};
