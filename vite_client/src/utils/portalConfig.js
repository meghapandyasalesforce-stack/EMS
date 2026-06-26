import { isExecutive } from './navigationConfig';

export const PORTAL_ORDER = [
  'admin',
  'executive',
  'hr_manager',
  'payroll_admin',
  'line_manager',
  'employee',
];

export const PORTAL_META = {
  admin: { label: 'Admin', home: '/organization/dashboard', theme: 'admin' },
  executive: { label: 'Executive', home: '/dashboard-administration', theme: 'admin' },
  hr_manager: { label: 'HR', home: '/dashboard-hr', theme: 'admin' },
  payroll_admin: { label: 'Finance', home: '/dashboard-finance', theme: 'admin' },
  line_manager: { label: 'Manager', home: '/dashboard-manager', theme: 'admin' },
  employee: { label: 'Me', home: '/dashboard-employee', theme: 'employee' },
};

const ROUTE_TO_PORTAL = [
  ['/organization/dashboard', 'admin'],
  ['/dashboard-admin', 'admin'],
  ['/dashboard-administration', 'executive'],
  ['/dashboard-hr', 'hr_manager'],
  ['/dashboard-finance', 'payroll_admin'],
  ['/dashboard-manager', 'line_manager'],
  ['/dashboard-employee', 'employee'],
];

const executiveLabel = (position) => {
  const pos = (position || '').toLowerCase().trim();
  if (pos === 'ceo' || pos.includes('chief executive')) return 'CEO';
  if (pos === 'cto' || pos.includes('chief technology')) return 'CTO';
  if (pos === 'cfo' || pos.includes('chief financial')) return 'CFO';
  if (pos === 'vp' || pos.includes('vice president')) return 'VP';
  return PORTAL_META.executive.label;
};

/**
 * Build the list of portal tabs the user may switch between.
 */
export const deriveAvailablePortals = ({
  user = null,
  employee = null,
  roleBuckets = [],
  permissionFlags = {},
} = {}) => {
  const buckets = new Set(roleBuckets);
  const position = (employee?.position || user?.position || '').toLowerCase().trim();
  const ids = new Set();

  const isAdminUser =
    (user?.role || '').toLowerCase() === 'admin' ||
    buckets.has('org_owner') ||
    permissionFlags.isOrgOwner;

  if (isAdminUser) ids.add('admin');

  if (buckets.has('executive') || permissionFlags.isExecutive || isExecutive(position)) {
    ids.add('executive');
  }

  if (
    buckets.has('hr_manager') ||
    buckets.has('hr_executive') ||
    permissionFlags.isHrManager ||
    permissionFlags.isHrExecutive
  ) {
    ids.add('hr_manager');
  }

  if (buckets.has('payroll_admin') || permissionFlags.isPayrollAdmin) {
    ids.add('payroll_admin');
  }

  if (buckets.has('line_manager') || permissionFlags.isLineManager) {
    ids.add('line_manager');
  }

  if (employee?._id || employee?.id) {
    ids.add('employee');
  }

  if (ids.size === 0 && (user?.role || '').toLowerCase() === 'employee') {
    ids.add('employee');
  }

  if (ids.size === 0 && isAdminUser) {
    ids.add('admin');
  }

  const employeeHome =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('employeeDashboardRoute')
      : null;

  return PORTAL_ORDER.filter((id) => ids.has(id)).map((id) => ({
    id,
    label: id === 'executive' ? executiveLabel(position) : PORTAL_META[id].label,
    home:
      id === 'employee' && employeeHome ? employeeHome : PORTAL_META[id].home,
    theme: PORTAL_META[id].theme,
  }));
};

/**
 * Pick initial portal from saved preference, route hint, or first available tab.
 * A saved 'employee' portal is only honoured if no higher-priority portal exists.
 */
export const resolveInitialPortal = (portals, routeHint = '') => {
  if (!portals?.length) return null;

  const saved =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('activePortal')
      : null;

  const hasHigherPortal = portals.some((p) => p.id !== 'employee');

  // Only restore saved 'employee' portal when there is no higher-priority portal
  if (saved && portals.some((p) => p.id === saved)) {
    if (saved !== 'employee' || !hasHigherPortal) {
      return saved;
    }
  }

  const hint = (routeHint || '').split('?')[0];
  for (const [prefix, portalId] of ROUTE_TO_PORTAL) {
    if (hint.startsWith(prefix) && portals.some((p) => p.id === portalId)) {
      return portalId;
    }
  }

  return portals[0].id;
};

export const isEmployeePortalTheme = (portalId) => portalId === 'employee';
