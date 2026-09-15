/**
 * Returns the correct dashboard route for a user.
 * SaaS rule: assignedRole / functionalRoles first — not department name.
 */

import { resolveDashboardFromAccessProfile } from './resolveDashboardFromAccess';

export function getDefaultDashboardRoute(user, employee) {
  const userObj = user || employee;
  if (!userObj) return '/dashboard-employee';

  const userRole = userObj.role;
  const assignedRole = userObj.assignedRole;
  const functionalRoles = Array.isArray(userObj.functionalRoles) ? userObj.functionalRoles : [];

  const isOrganizationLogin =
    typeof localStorage !== 'undefined' && localStorage.getItem('isOrganizationLogin') === 'true';
  const userEmail = (userObj.email || '').toLowerCase();
  const isGmailUser = userEmail.endsWith('@gmail.com');
  if ((isOrganizationLogin || isGmailUser) && userRole === 'admin') {
    return '/organization/dashboard';
  }

  return resolveDashboardFromAccessProfile({
    functionalRoles,
    assignedRole,
    position: userObj.position,
    jobTitle: userObj.jobTitle,
    role: userRole,
    allowLegacyJobStrings: true,
  });
}
