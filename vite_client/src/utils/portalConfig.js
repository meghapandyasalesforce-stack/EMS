import { isExecutive } from './navigationConfig';

/** Canonical portal tab order (highest privilege first). */
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
 * SaaS policy: only organization administrators may switch between portal tabs.
 * Delegated roles (HR, manager, finance, employee) are locked to one portal.
 */
export const canSwitchPortals = (user = null, permissionFlags = {}) => {
  const role = (user?.role || '').toLowerCase();
  return role === 'admin' || Boolean(permissionFlags.isOrgOwner);
};

/**
 * All portal IDs the principal is entitled to based on RBAC (before switch policy).
 */
export const deriveEntitledPortalIds = ({
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

  return ids;
};

/**
 * Locked portal for non-admin users: highest operational portal they hold.
 */
export const resolvePrimaryPortalId = (entitledIds) => {
  const ids = entitledIds instanceof Set ? entitledIds : new Set(entitledIds || []);
  if (ids.size === 0) return 'employee';

  for (const id of PORTAL_ORDER) {
    if (id === 'admin') continue;
    if (ids.has(id)) return id;
  }

  if (ids.has('admin')) return 'admin';
  return 'employee';
};

const buildPortalObjects = (ids, position) => {
  const employeeHome =
    typeof localStorage !== 'undefined'
      ? localStorage.getItem('employeeDashboardRoute')
      : null;

  return PORTAL_ORDER.filter((id) => ids.has(id)).map((id) => ({
    id,
    label: id === 'executive' ? executiveLabel(position) : PORTAL_META[id].label,
    home: id === 'employee' && employeeHome ? employeeHome : PORTAL_META[id].home,
    theme: PORTAL_META[id].theme,
  }));
};

/**
 * Portals exposed in UI / Redux.
 * Admins: all entitled portals (tab switcher).
 * Everyone else: exactly one locked portal.
 */
export const deriveAvailablePortals = (ctx = {}) => {
  const { user = null, employee = null, permissionFlags = {} } = ctx;
  const position = (employee?.position || user?.position || '').toLowerCase().trim();
  const entitledIds = deriveEntitledPortalIds(ctx);
  const allPortals = buildPortalObjects(entitledIds, position);

  if (canSwitchPortals(user, permissionFlags)) {
    return allPortals;
  }

  const primaryId = resolvePrimaryPortalId(entitledIds);
  const primary = allPortals.find((p) => p.id === primaryId);
  return primary ? [primary] : allPortals.slice(0, 1);
};

/**
 * Active portal for navigation — ignores tampered localStorage for non-admins.
 */
export const getEffectiveActivePortal = ({
  user = null,
  permissionFlags = {},
  availablePortals = [],
  activePortal = null,
  routeHint = '',
} = {}) => {
  if (!availablePortals?.length) return null;

  if (!canSwitchPortals(user, permissionFlags)) {
    return availablePortals[0].id;
  }

  if (activePortal && availablePortals.some((p) => p.id === activePortal)) {
    return activePortal;
  }

  return resolveInitialPortal(availablePortals, routeHint, { allowSavedPreference: true });
};

/**
 * Sync portals + active tab after login, session refresh, or role change.
 */
export const syncPortalsForSession = ({
  user = null,
  employee = null,
  roleBuckets = [],
  permissionFlags = {},
  routeHint = '',
  currentActivePortal = null,
} = {}) => {
  const portals = deriveAvailablePortals({
    user,
    employee,
    roleBuckets,
    permissionFlags,
  });
  const activePortal = getEffectiveActivePortal({
    user,
    permissionFlags,
    availablePortals: portals,
    activePortal: currentActivePortal,
    routeHint,
  });
  return { portals, activePortal };
};

/**
 * Pick initial portal for org admins (saved preference, route hint, or first tab).
 */
export const resolveInitialPortal = (portals, routeHint = '', options = {}) => {
  const { allowSavedPreference = true } = options;
  if (!portals?.length) return null;

  const saved =
    allowSavedPreference && typeof localStorage !== 'undefined'
      ? localStorage.getItem('activePortal')
      : null;

  const hasHigherPortal = portals.some((p) => p.id !== 'employee');

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

export const isPortalSwitchAllowed = (
  portalId,
  { user = null, permissionFlags = {}, availablePortals = [] } = {}
) => {
  if (!canSwitchPortals(user, permissionFlags)) return false;
  return availablePortals.some((p) => p.id === portalId);
};
