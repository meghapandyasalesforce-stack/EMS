import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { normalizeEmail } from './authHelpers.js';
import {
  isOrgOwnerUser,
  verifyEmployeeLoginPassword,
  getEmployeeLoginAuthRecord,
  getEmployeeTokenPasswordChangedAt,
} from './identityService.js';
import { PLATFORM_ROLES, isPlatformOperatorRoles } from '../config/identity.constants.js';
import { getDashboardRouteForUser } from './dashboardRouteHelper.js';
import { getCachedTimezoneContext } from './orgContextCache.js';
import { resolveAuthContext, getDataScope } from './permissionService.js';

/** Public inbox domains — many orgs can share these; never use as org domain key. */
const PUBLIC_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'googlemail.com',
  'yahoo.com',
  'yahoo.co.in',
  'hotmail.com',
  'outlook.com',
  'live.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

export const resolveOrganizationFromEmail = async (normalizedEmail, requestId = null) => {
  const emailParts = normalizedEmail.split('@');
  if (emailParts.length !== 2 || !emailParts[1]) {
    return null;
  }
  const emailDomain = emailParts[1].toLowerCase();

  // 1. Exact organization email (required for Gmail / personal-email org registrations)
  let organization = await Organization.findOne({
    email: normalizedEmail,
    isActive: true,
  }).select('_id name email domain');

  if (organization) {
    return organization;
  }

  // 2. Shared public domains cannot identify a single tenant
  if (PUBLIC_EMAIL_DOMAINS.has(emailDomain)) {
    return null;
  }

  // 3. Corporate domain match
  organization = await Organization.findOne({
    domain: emailDomain,
    isActive: true,
  }).select('_id name email domain');

  return organization || null;
};

const findUserAndEmployee = async (normalizedEmail, organizationId) => {
  const orgFilter = organizationId ? { organizationId } : {};
  const emailFilter = { email: normalizedEmail, ...orgFilter };

  let [user, employee] = await Promise.all([
    User.findOne(emailFilter).select('+password'),
    Employee.findOne(emailFilter).select('+password'),
  ]);

  if (!user) {
    user = await User.findOne({ email: normalizedEmail }).select('+password');
  }
  if (!employee) {
    employee = await Employee.findOne({ email: normalizedEmail }).select('+password');
  }

  const linkLookups = [];
  if (user?.employeeProfileId && !employee) {
    linkLookups.push(
      Employee.findById(user.employeeProfileId).select('+password').then((e) => {
        employee = e;
      })
    );
  }
  if (employee?.userId && !user) {
    linkLookups.push(
      User.findById(employee.userId).select('+password').then((u) => {
        user = u;
      })
    );
  }
  if (linkLookups.length) await Promise.all(linkLookups);

  // Platform operators must use /platform/login — never unified HRMS login
  if (user && (user.role === 'platform' || isPlatformOperatorRoles(user.roles))) {
    user = null;
  }

  return { user, employee };
};

const buildPlatformRoles = (user, employee) => {
  const roles = new Set(Array.isArray(user?.roles) ? user.roles : []);
  if (user && isOrgOwnerUser(user)) {
    roles.add(PLATFORM_ROLES.ORG_OWNER);
    roles.add(PLATFORM_ROLES.HR_ADMIN);
  }
  if (employee) {
    roles.add(PLATFORM_ROLES.EMPLOYEE);
  }
  return [...roles];
};

const buildAvailablePortals = (user, employee) => {
  const portals = [];
  if (user && isOrgOwnerUser(user)) portals.push('admin');
  if (employee) portals.push('employee');
  if (portals.length === 0 && user && isOrgOwnerUser(user)) portals.push('admin');
  if (portals.length === 0 && employee) portals.push('employee');
  return [...new Set(portals)];
};

const resolveSession = (user, employee) => {
  if (user && isOrgOwnerUser(user)) {
    const profileId = employee?._id || user.employeeProfileId || null;
    return {
      jwtRole: 'admin',
      jwtUserId: user._id,
      employeeProfileId: profileId,
      authRecord: user,
      authRecordType: 'user',
    };
  }

  if (employee) {
    return {
      jwtRole: 'employee',
      jwtUserId: employee._id,
      employeeProfileId: employee._id,
      authRecord: employee,
      authRecordType: 'employee',
    };
  }

  if (user) {
    return {
      jwtRole: user.role === 'employee' ? 'employee' : 'admin',
      jwtUserId: user._id,
      employeeProfileId: user.employeeProfileId || null,
      authRecord: user,
      authRecordType: 'user',
    };
  }

  return null;
};

export const performUnifiedLogin = async ({ email, password, requestId }) => {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail) {
    return { ok: false, status: 400, code: 'VALIDATION', message: 'Invalid email format' };
  }

  let organization = await resolveOrganizationFromEmail(normalizedEmail, requestId);

  const { user, employee } = await findUserAndEmployee(
    normalizedEmail,
    organization?._id || null
  );

  const organizationId =
    user?.organizationId || employee?.organizationId || organization?._id || null;

  if (
    organizationId &&
    (!organization || String(organization._id) !== String(organizationId))
  ) {
    organization = await Organization.findOne({
      _id: organizationId,
      isActive: true,
    }).select('_id name email domain');
  }

  if (!user && !employee) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    };
  }

  let passwordValid = false;
  let lockRecord = null;

  if (user) {
    lockRecord = user;
    passwordValid = await user.comparePassword(password);
  }

  if (!passwordValid && employee) {
    const { record } = await getEmployeeLoginAuthRecord(employee);
    lockRecord = record;
    passwordValid = await verifyEmployeeLoginPassword(employee, password);
  }

  if (!passwordValid) {
    if (lockRecord) {
      const { handleFailedLogin } = await import('./authHelpers.js');
      await handleFailedLogin(lockRecord);
    }
    return {
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    };
  }

  const session = resolveSession(user, employee);
  if (!session) {
    return {
      ok: false,
      status: 401,
      code: 'INVALID_CREDENTIALS',
      message: 'Invalid email or password',
    };
  }

  const { isAccountLocked, resetLoginAttempts, getLockoutMessage } = await import(
    './authHelpers.js'
  );

  if (isAccountLocked(session.authRecord)) {
    return {
      ok: false,
      status: 403,
      code: 'LOCKED',
      message: getLockoutMessage(session.authRecord),
    };
  }

  if (session.authRecordType === 'user' && !session.authRecord.isActive) {
    return {
      ok: false,
      status: 403,
      code: 'INACTIVE',
      message: 'Your account is inactive. Please contact administrator.',
    };
  }

  if (
    employee &&
    employee.active === false &&
    session.jwtRole === 'employee' &&
    !user
  ) {
    return {
      ok: false,
      status: 403,
      code: 'INACTIVE',
      message: 'Your account is inactive. Please contact HR or Admin.',
    };
  }

  await resetLoginAttempts(session.authRecord);

  const orgId = organizationId;

  if (organization && employee && orgId && employee.organizationId) {
    const empOrgId = String(employee.organizationId);
    const resolvedOrgId = String(orgId);
    if (empOrgId !== resolvedOrgId) {
      return {
        ok: false,
        status: 401,
        code: 'INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      };
    }
  }

  const platformRoles = buildPlatformRoles(user, employee);
  const availablePortals = buildAvailablePortals(user, employee);

  const dashboardUserId =
    session.jwtRole === 'employee' ? session.jwtUserId : user?._id || session.jwtUserId;

  const routePromises = [
    getDashboardRouteForUser(dashboardUserId, session.jwtRole, orgId, normalizedEmail),
    orgId ? getCachedTimezoneContext(orgId) : Promise.resolve(null),
  ];
  if (employee) {
    routePromises.push(
      getDashboardRouteForUser(employee._id, 'employee', orgId, normalizedEmail)
    );
  }

  const routeResults = await Promise.all(routePromises);
  const dashboardRoute = routeResults[0];
  const timezoneContext = routeResults[1];
  const employeeDashboardRoute = employee ? routeResults[2] : null;

  const passwordChangedAt =
    session.authRecordType === 'user'
      ? session.authRecord.passwordChangedAt || null
      : await getEmployeeTokenPasswordChangedAt(employee);

  const extraClaims = {};
  if (session.employeeProfileId) {
    extraClaims.employeeProfileId = session.employeeProfileId.toString();
  }
  if (platformRoles.length) {
    extraClaims.platformRoles = platformRoles;
  }

  let organizationPayload = null;
  if (orgId) {
    if (organization) {
      organizationPayload = {
        id: organization._id,
        name: organization.name,
        email: organization.email,
        domain: organization.domain,
      };
    } else {
      const orgDoc = await Organization.findById(orgId)
        .select('_id name email domain')
        .lean();
      if (orgDoc) {
        organizationPayload = {
          id: orgDoc._id,
          name: orgDoc.name,
          email: orgDoc.email,
          domain: orgDoc.domain,
        };
      }
    }
  }

  const sanitizeUser = user
    ? {
        id: user._id,
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        roles: platformRoles,
        organizationId: user.organizationId,
      }
    : null;

  const authContext = await resolveAuthContext(
    {
      role: session.jwtRole,
      userId: session.jwtUserId,
      employeeProfileId: session.employeeProfileId,
      organizationId: orgId,
      platformRoles,
    },
    { user: user || undefined, employee: employee || undefined }
  );

  const permissionFlags = {
    isOrgOwner: authContext.isOrgOwner,
    isHrManager: authContext.isHrManager,
    isHrExecutive: authContext.isHrExecutive,
    isPayrollAdmin: authContext.isPayrollAdmin,
    isLineManager: authContext.isLineManager,
    isProjectManager: authContext.isProjectManager,
    isExecutive: authContext.isExecutive,
    jwtRole: session.jwtRole,
  };

  const isOrganizationLogin = !!(
    user &&
    isOrgOwnerUser(user) &&
    organizationPayload &&
    (organizationPayload.email?.toLowerCase() === normalizedEmail ||
      normalizedEmail.endsWith('@gmail.com'))
  );

  const hasCompletedFirstLogin = employee?.hasCompletedFirstLogin !== false;

  // First-login Job Details for new hires (incl. HR Manager / HR Executive). Never org admin login.
  const redirectToJobDetails =
    employee?.hasCompletedFirstLogin === false &&
    session.jwtRole === 'employee' &&
    !isOrganizationLogin &&
    !permissionFlags.isOrgOwner &&
    !permissionFlags.isLineManager &&
    !permissionFlags.isProjectManager &&
    !permissionFlags.isPayrollAdmin &&
    !permissionFlags.isExecutive;

  const sanitizeEmployee = employee
    ? {
        id: employee._id,
        _id: employee._id,
        name: employee.name,
        lastName: employee.lastName,
        email: employee.email,
        employeeId: employee.employeeId,
        position: employee.position,
        department: employee.department,
        jobTitle: employee.jobTitle,
        jobCategory: employee.jobCategory,
        functionalRoles: employee.functionalRoles || [],
        mustResetPassword: employee.mustResetPassword,
        unifiedAuth: !!employee.userId,
        organizationId: employee.organizationId,
        hasCompletedFirstLogin,
      }
    : null;

  return {
    ok: true,
    redirectToJobDetails,
    permissions: authContext.permissions,
    roleBuckets: authContext.buckets,
    permissionFlags,
    dataScope: getDataScope(authContext),
    session: {
      jwtRole: session.jwtRole,
      jwtUserId: session.jwtUserId,
      employeeProfileId: session.employeeProfileId,
      passwordChangedAt,
      extraClaims,
    },
    platformRoles,
    availablePortals,
    dashboardRoute,
    employeeDashboardRoute,
    organization: organizationPayload,
    user: sanitizeUser,
    employee: sanitizeEmployee,
    timezoneContext,
    isOrganizationLogin,
  };
};
