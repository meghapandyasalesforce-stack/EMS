/**
 * Shared client dashboard resolution — functionalRoles / assignedRole first (SaaS).
 * Department name is NOT used. Legacy position/jobTitle only if functionalRoles empty.
 */

export function resolveDashboardFromAccessProfile({
  functionalRoles = [],
  assignedRole = null,
  position = '',
  jobTitle = '',
  role = '',
  allowLegacyJobStrings = true,
} = {}) {
  if (assignedRole?.dashboardRoute) {
    return assignedRole.dashboardRoute;
  }

  const functional = new Set(
    (Array.isArray(functionalRoles) ? functionalRoles : []).map((r) =>
      String(r).toLowerCase().trim()
    )
  );
  const pos = String(position || '').toLowerCase().trim();
  const title = String(jobTitle || '').toLowerCase().trim();
  const hasFunctional = functional.size > 0;

  if (
    functional.has('executive') ||
    functional.has('ceo') ||
    functional.has('cto') ||
    functional.has('cfo') ||
    functional.has('vp')
  ) {
    return '/dashboard-administration';
  }
  if (functional.has('hr')) return '/dashboard-hr';
  if (functional.has('finance')) return '/dashboard-finance';
  if (functional.has('project_manager')) return '/dashboard-manager';
  if (functional.has('manager')) return '/dashboard-manager';

  if (allowLegacyJobStrings && !hasFunctional) {
    if (pos === 'ceo' || pos === 'cto' || pos === 'cfo' || pos === 'vp') {
      return '/dashboard-administration';
    }
    if (title === 'project manager') return '/dashboard-manager';
    if (pos === 'manager' || pos === 'director' || pos === 'lead' || pos === 'supervisor') {
      return '/dashboard-manager';
    }
  }

  if (role === 'admin') return '/dashboard-admin';
  return '/dashboard-employee';
}
