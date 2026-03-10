/**
 * Returns the correct dashboard route for a user based on role, position, department, and jobTitle.
 * Used for redirecting unauthorized users to their own dashboard (exact route).
 * Mirrors server-side and RoleBasedDashboard fallback logic.
 *
 * @param {Object} user - Auth user (admin)
 * @param {Object} employee - Employee details (when logged in as employee)
 * @returns {string} Dashboard path
 */
export function getDefaultDashboardRoute(user, employee) {
  const userObj = user || employee;
  if (!userObj) return '/dashboard-employee';

  const position = (userObj.position || '').toLowerCase().trim();
  const department = (userObj.department || '').toLowerCase().trim();
  const jobTitle = (userObj.jobTitle || '').toLowerCase().trim();
  const userRole = userObj.role;
  const assignedRole = userObj.assignedRole;

  if (assignedRole?.dashboardRoute) return assignedRole.dashboardRoute;

  const isOrganizationLogin = typeof localStorage !== 'undefined' && localStorage.getItem('isOrganizationLogin') === 'true';
  const userEmail = (userObj.email || '').toLowerCase();
  const isGmailUser = userEmail.endsWith('@gmail.com');
  if ((isOrganizationLogin || isGmailUser) && userRole === 'admin') return '/organization/dashboard';

  if (position === 'ceo' || position === 'cto' || position === 'cfo' || position === 'vp') return '/dashboard-administration';
  if (department === 'hr' || department.includes('hr') || department.includes('human resource') ||
      jobTitle.includes('hr manager') || jobTitle.includes('human resource') || jobTitle.includes('hr')) return '/dashboard-hr';
  if (department === 'technology' || department === 'tech' || department.includes('technology') ||
      department === 'it' || (department.includes('it') && !department.includes('support'))) return '/dashboard/tech';
  if (department === 'finance' || department.includes('finance')) return '/dashboard-finance';
  if (position === 'manager' || position === 'director') return '/dashboard-manager';
  if (userRole === 'admin') return '/dashboard-admin';

  return '/dashboard-employee';
}
