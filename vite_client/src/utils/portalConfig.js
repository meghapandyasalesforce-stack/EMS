import { isExecutive, getMePortalHomePath } from './navigationConfig';

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

/** Org owner sidebar tabs: Admin workspace, HR workspace, personal employee profile. */
export const ORG_OWNER_PORTAL_TABS = ['admin', 'hr_manager', 'employee'];

/** Delegated HR staff — single locked HR workspace (no portal switcher). */
export const HR_PORTAL_TABS = ['hr_manager'];

const ME_PROFILE_ROUTES = [
  '/profile-details',
  '/contact-details',
  '/next-of-kin-details',
  '/education-qualifications',
  '/guarantor-details',
  '/family-details',
  '/job-details',
  '/financial-details',
  '/employee/id-card',
];

/** Standard employee workspace routes (not org-owner Me profile sections). */
const EMPLOYEE_WORKSPACE_ROUTES = [
  '/dashboard-employee',
  '/employee/leave-attendance',
  '/my-attendance-regularization',
  '/employee/projects',
  '/one-on-one',
  '/employee/benefits-learning',
  '/employee/documents-id',
  '/employee/my-documents',
  '/employee/calendar',
  '/employee-payroll',
  '/notifications',
];

const ROUTE_TO_PORTAL = [
  ['/organization/dashboard', 'admin'],
  ['/dashboard-admin', 'admin'],
  ['/dashboard-administration', 'executive'],
  ['/dashboard-hr', 'hr_manager'],
  ['/dashboard-finance', 'payroll_admin'],
  ['/dashboard-manager', 'line_manager'],
  ...EMPLOYEE_WORKSPACE_ROUTES.map((path) => [path, 'employee']),
  ...ME_PROFILE_ROUTES.map((path) => [path, 'employee']),
];

const executiveLabel = (position) => {
  const pos = (position || '').toLowerCase().trim();
  if (pos === 'ceo' || pos.includes('chief executive')) return 'CEO';
  if (pos === 'cto' || pos.includes('chief technology')) return 'CTO';
  if (pos === 'cfo' || pos.includes('chief financial')) return 'CFO';
  if (pos === 'vp' || pos.includes('vice president')) return 'VP';
  return PORTAL_META.executive.label;
};

/** Delegated HR staff (not org owner). */
export const isHrPortalUser = (permissionFlags = {}) =>
  Boolean(
    (permissionFlags.isHrManager || permissionFlags.isHrExecutive) &&
    !permissionFlags.isOrgOwner
  );

/** Session role from JWT / Redux / localStorage (employee vs admin login). */
export const resolveSessionRole = (user = null, permissionFlags = {}) => {
  const jwtRole = permissionFlags?.jwtRole;
  if (jwtRole) return String(jwtRole).toLowerCase();
  if (user?.role) return String(user.role).toLowerCase();
  if (typeof localStorage !== 'undefined') {
    const stored = localStorage.getItem('role');
    if (stored) return stored.toLowerCase();
  }
  return 'employee';
};

/**
 * Portal tabs only for org owners logged in with an admin session.
 * HR and employee logins always get a single locked workspace.
 */
export const canSwitchPortals = (
  user = null,
  permissionFlags = {},
  roleBuckets = []
) => {
  const sessionRole = resolveSessionRole(user, permissionFlags);
  if (sessionRole !== 'admin') return false;
  if (Boolean(permissionFlags.isOrgOwner)) return true;
  if (Array.isArray(roleBuckets) && roleBuckets.includes('org_owner')) return true;
  return false;
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

  if (employee?._id || employee?.id || user?.employeeProfileId) {
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

/** HR / manager / finance staff — used for session and login routing (not portal tabs). */
export const isDelegatedStaff = (permissionFlags = {}) =>
  Boolean(
    permissionFlags.isHrManager ||
    permissionFlags.isHrExecutive ||
    permissionFlags.isLineManager ||
    permissionFlags.isPayrollAdmin
  );

/**
 * Locked portal for non-tab users: highest operational portal they hold.
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

const buildOrgOwnerPortalTabs = (allPortals, position, employee = null) => {
  const byId = Object.fromEntries(allPortals.map((p) => [p.id, p]));

  return ORG_OWNER_PORTAL_TABS.map((id) => {
    if (id === 'employee') {
      const base = byId[id] || {
        id: 'employee',
        label: PORTAL_META.employee.label,
        home: PORTAL_META.employee.home,
        theme: PORTAL_META.employee.theme,
      };
      return { ...base, home: getMePortalHomePath(employee || {}) };
    }
    if (byId[id]) return byId[id];
    return {
      id,
      label: PORTAL_META[id].label,
      home: PORTAL_META[id].home,
      theme: PORTAL_META[id].theme,
    };
  });
};

/**
 * Portals exposed in UI / Redux.
 * Org owner admin session: Admin + HR + Me.
 * HR / employee / manager sessions: one locked portal only.
 */
export const deriveAvailablePortals = (ctx = {}) => {
  const { user = null, employee = null, permissionFlags = {}, roleBuckets = [] } = ctx;
  const position = (employee?.position || user?.position || '').toLowerCase().trim();
  const entitledIds = deriveEntitledPortalIds(ctx);
  const allPortals = buildPortalObjects(entitledIds, position);

  if (canSwitchPortals(user, permissionFlags, roleBuckets)) {
    return buildOrgOwnerPortalTabs(allPortals, position, employee);
  }

  if (isHrPortalUser(permissionFlags)) {
    const hrPortal =
      allPortals.find((p) => p.id === 'hr_manager') ||
      {
        id: 'hr_manager',
        label: PORTAL_META.hr_manager.label,
        home: PORTAL_META.hr_manager.home,
        theme: PORTAL_META.hr_manager.theme,
      };
    return [hrPortal];
  }

  const sessionRole = resolveSessionRole(user, permissionFlags);
  if (sessionRole === 'employee') {
    const primaryId = resolvePrimaryPortalId(entitledIds);
    const primary =
      allPortals.find((p) => p.id === primaryId) ||
      {
        id: 'employee',
        label: PORTAL_META.employee.label,
        home: PORTAL_META.employee.home,
        theme: PORTAL_META.employee.theme,
      };
    return [primary];
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
  roleBuckets = [],
  availablePortals = [],
  activePortal = null,
  routeHint = '',
} = {}) => {
  if (!availablePortals?.length) return null;

  if (!canSwitchPortals(user, permissionFlags, roleBuckets)) {
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
    roleBuckets,
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
  { user = null, permissionFlags = {}, roleBuckets = [], availablePortals = [] } = {}
) => {
  if (!canSwitchPortals(user, permissionFlags, roleBuckets)) return false;
  return availablePortals.some((p) => p.id === portalId);
};
