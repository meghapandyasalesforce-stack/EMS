import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import logger from './logger.js';
import { normalizeEmail } from './authHelpers.js';
import {
  isOrgAdminUser,
  verifyEmployeeLoginPassword,
  getEmployeeLoginAuthRecord,
} from './identityService.js';
import { PLATFORM_ROLES } from '../config/identity.constants.js';
import { getDashboardRouteForUser } from './dashboardRouteHelper.js';
import { getCachedTimezoneContext } from './orgContextCache.js';
import { resolveAuthContext, getDataScope } from './permissionService.js';

export const resolveOrganizationFromEmail = async (normalizedEmail, requestId = null) => {
  const emailDomain = normalizedEmail.split('@')[1];
  let organization = await Organization.findOne({
    domain: emailDomain,
    isActive: true,
  }).select('_id name email domain');

  if (!organization) {
    const organizations = await Organization.find({
      email: {
        $regex: new RegExp(
          `@${emailDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`,
          'i'
        ),
      },
      isActive: true,
    })
      .select('_id name email domain')
      .limit(1);

    if (organizations.length > 0) {
      organization = organizations[0];
      if (!organization.domain) {
        try {
          await Organization.updateOne(
            { _id: organization._id },
            { $set: { domain: emailDomain.toLowerCase() } }
          );
          organization.domain = emailDomain.toLowerCase();
        } catch (e) {
          logger.warn('Failed to auto-populate organization domain', {
            requestId,
            error: e.message,
          });
        }
      }
    }
  }

  return organization;
};

const findUserAndEmployee = async (normalizedEmail, organizationId) => {
  const orgFilter = organizationId ? { organizationId } : {};
  const emailFilter = { email: normalizedEmail, ...orgFilter };

  let [user, employee] = await Promise.all([
    User.findOne(emailFilter).select('+password'),
    Employee.findOne(emailFilter).select('+password userId'),
  ]);

  if (!user && !organizationId) {
    user = await User.findOne({ email: normalizedEmail }).select('+password');
  }
  if (!employee && !organizationId) {
    employee = await Employee.findOne({ email: normalizedEmail }).select(
      '+password userId'
    );
  }

  const linkLookups = [];
  if (user?.employeeProfileId && !employee) {
    linkLookups.push(
      Employee.findById(user.employeeProfileId).select('+password userId').then((e) => {
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

  return { user, employee };
};

const buildPlatformRoles = (user, employee) => {
  const roles = new Set(Array.isArray(user?.roles) ? user.roles : []);
  if (user && isOrgAdminUser(user)) {
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
  if (user && isOrgAdminUser(user)) portals.push('admin');
  if (employee) portals.push('employee');
  if (portals.length === 0 && user) portals.push('admin');
  if (portals.length === 0 && employee) portals.push('employee');
  return [...new Set(portals)];
};

const resolveSession = (user, employee) => {
  if (user && isOrgAdminUser(user)) {
    const profileId = employee?._id || user.employeeProfileId || null;
    return {
      jwtRole: 'admin',
      jwtUserId: user._id,
      employeeProfileId: profileId,
      authRecord: user,
      authRecordType: 'user',
    };
  }

  if (user && employee) {
    return {
      jwtRole: 'admin',
      jwtUserId: user._id,
      employeeProfileId: employee._id,
      authRecord: user,
      authRecordType: 'user',
    };
  }

  if (employee) {
    return {
      jwtRole: 'employee',
      jwtUserId: employee._id,
      employeeProfileId: null,
      authRecord: employee,
      authRecordType: 'employee',
    };
  }

  if (user) {
    return {
      jwtRole: user.role === 'employee' ? 'employee' : 'admin',
      jwtUserId: user._id,
      employeeProfileId: null,
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

  const organization = await resolveOrganizationFromEmail(normalizedEmail, requestId);
  const organizationId = organization?._id || null;

  const { user, employee } = await findUserAndEmployee(
    normalizedEmail,
    organizationId
  );

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

  const orgId =
    organizationId || user?.organizationId || employee?.organizationId || null;

  if (organization && employee && orgId && employee.organizationId) {
    const empOrgId = String(employee.organizationId);
    const resolvedOrgId = String(organization._id);
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
      ? session.authRecord.passwordChangedAt || session.authRecord.createdAt
      : employee?.passwordChangedAt || employee?.createdAt;

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

  return {
    ok: true,
    permissions: authContext.permissions,
    roleBuckets: authContext.buckets,
    permissionFlags: {
      isOrgOwner: authContext.isOrgOwner,
      isHrManager: authContext.isHrManager,
      isHrExecutive: authContext.isHrExecutive,
      isPayrollAdmin: authContext.isPayrollAdmin,
      isLineManager: authContext.isLineManager,
      isExecutive: authContext.isExecutive,
    },
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
    isOrganizationLogin: !!(
      user &&
      isOrgAdminUser(user) &&
      organizationPayload &&
      (organizationPayload.email?.toLowerCase() === normalizedEmail ||
        normalizedEmail.endsWith('@gmail.com'))
    ),
  };
};
