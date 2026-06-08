/**
 * Client mirror of server RBAC (see server/config/permissions.constants.js).
 */

export const PERMISSIONS = {
  EMPLOYEE_VIEW_ALL: 'employee.view.all',
  EMPLOYEE_VIEW_TEAM: 'employee.view.team',
  EMPLOYEE_CREATE: 'employee.create',
  EMPLOYEE_EDIT: 'employee.edit',
  EMPLOYEE_EDIT_SENSITIVE: 'employee.edit.sensitive',
  EMPLOYEE_DELETE: 'employee.delete',
  LEAVE_VIEW_ALL: 'leave.view.all',
  LEAVE_VIEW_TEAM: 'leave.view.team',
  LEAVE_APPROVE_ALL: 'leave.approve.all',
  LEAVE_APPROVE_TEAM: 'leave.approve.team',
  LEAVE_POLICY_MANAGE: 'leave.policy.manage',
  ATTENDANCE_VIEW_ALL: 'attendance.view.all',
  ATTENDANCE_VIEW_TEAM: 'attendance.view.team',
  ATTENDANCE_RULE_MANAGE: 'attendance.rule.manage',
  PAYROLL_VIEW_ALL: 'payroll.view.all',
  PAYROLL_VIEW_SELF: 'payroll.view.self',
  PAYROLL_CREATE: 'payroll.create',
  PAYROLL_EDIT: 'payroll.edit',
  PAYROLL_PROCESS: 'payroll.process',
  PAYROLL_PUBLISH: 'payroll.publish',
  EXECUTIVE_DASHBOARD: 'executive.dashboard',
  ORG_SETTINGS_MANAGE: 'org.settings.manage',
  REVIEW_CYCLE_MANAGE: 'review.manage',
  PROJECT_ADMIN_VIEW: 'project.admin.view',
  ONBOARDING_MANAGE: 'onboarding.manage',
  ENGAGEMENT_MANAGE: 'engagement.manage',
  ID_CARD_MANAGE: 'idcard.manage',
};

/** Route → any of these permissions grants access (when permissions are loaded). */
export const ROUTE_PERMISSIONS = {
  addEmployee: [PERMISSIONS.EMPLOYEE_CREATE],
  employees: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM],
  employeeDetails: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.EMPLOYEE_VIEW_TEAM],
  adminPayroll: [PERMISSIONS.PAYROLL_VIEW_ALL],
  payrollCreate: [PERMISSIONS.PAYROLL_CREATE],
  payrollEdit: [PERMISSIONS.PAYROLL_EDIT, PERMISSIONS.PAYROLL_PROCESS],
  leaveManagement: [PERMISSIONS.LEAVE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_TEAM],
  attendanceAll: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM],
  attendanceToday: [PERMISSIONS.ATTENDANCE_VIEW_ALL, PERMISSIONS.ATTENDANCE_VIEW_TEAM],
  attendanceRules: [PERMISSIONS.ATTENDANCE_RULE_MANAGE],
  leavePolicy: [PERMISSIONS.LEAVE_POLICY_MANAGE],
  orgSettings: [PERMISSIONS.ORG_SETTINGS_MANAGE],
  executiveDashboard: [PERMISSIONS.EXECUTIVE_DASHBOARD],
  adminDashboard: [PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_CREATE],
  hrDashboard: [PERMISSIONS.EMPLOYEE_VIEW_ALL, PERMISSIONS.LEAVE_VIEW_ALL],
  managerDashboard: [PERMISSIONS.EMPLOYEE_VIEW_TEAM, PERMISSIONS.LEAVE_VIEW_TEAM],
  financeDashboard: [PERMISSIONS.PAYROLL_VIEW_ALL],
  idCards: [PERMISSIONS.ID_CARD_MANAGE],
  projects: [PERMISSIONS.PROJECT_ADMIN_VIEW, PERMISSIONS.EMPLOYEE_VIEW_ALL],
  platformRoles: [PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE],
  onboarding: [PERMISSIONS.ONBOARDING_MANAGE, PERMISSIONS.EMPLOYEE_VIEW_ALL],
  engagement: [PERMISSIONS.ENGAGEMENT_MANAGE],
  recruitment: [PERMISSIONS.EMPLOYEE_VIEW_ALL],
  pendingApprovals: [PERMISSIONS.LEAVE_APPROVE_ALL, PERMISSIONS.LEAVE_APPROVE_TEAM],
  salaryStructure: [PERMISSIONS.PAYROLL_EDIT, PERMISSIONS.PAYROLL_CREATE],
  adminSettings: [PERMISSIONS.ORG_SETTINGS_MANAGE],
  roleHierarchy: [PERMISSIONS.ORG_SETTINGS_MANAGE],
};

export const hasPermission = (permissions, key) => {
  if (!Array.isArray(permissions)) return false;
  if (permissions.includes('*')) return true;
  return permissions.includes(key);
};

export const hasAnyPermission = (permissions, keys = [], { isOrgOwner = false } = {}) => {
  if (!keys.length) return true;
  if (isOrgOwner) return true;
  return keys.some((k) => hasPermission(permissions, k));
};

/** Access check used by ProtectedRoute and PermissionGate */
export const canAccess = (
  permissions,
  requiredPermissions = [],
  { isOrgOwner = false, allowedRoles = [], effectiveRoles = [] } = {}
) => {
  if (!requiredPermissions.length) {
    if (!allowedRoles.length) return true;
    return allowedRoles.some((r) => effectiveRoles.includes(r));
  }
  if (permissions.length > 0) {
    return hasAnyPermission(permissions, requiredPermissions, { isOrgOwner });
  }
  if (allowedRoles.length > 0) {
    return allowedRoles.some((r) => effectiveRoles.includes(r));
  }
  return false;
};

export const roleBucketLabel = (bucket) => {
  const labels = {
    org_owner: 'Organization owner',
    hr_manager: 'HR Manager',
    hr_executive: 'HR Executive',
    payroll_admin: 'Payroll Admin',
    line_manager: 'Line Manager',
    executive: 'Executive',
    employee: 'Employee',
  };
  return labels[bucket] || bucket;
};

/** Filter nav items that declare `permissions: string[]` */
export const filterNavByPermissions = (items, permissions) => {
  if (!Array.isArray(items)) return [];
  if (!permissions?.length) return items;
  return items.filter((item) => {
    if (!item.permissions?.length) return true;
    return hasAnyPermission(permissions, item.permissions);
  });
};
