import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { attachUserToRequest } from './authHelpers.js';
import { findOrgOwnerEmployeeProfile, resolveOrgOwnerUser } from '../helpers/identityService.js';

/**
 * Resolve employee id from JWT (employee session or admin with linked profile).
 */
export const resolveEmployeeIdFromToken = (decoded) => {
  if (decoded.role === 'employee') {
    return decoded.userId;
  }
  if (decoded.role === 'admin' && decoded.employeeProfileId) {
    return decoded.employeeProfileId;
  }
  return null;
};

/**
 * Resolve linked workforce profile for an admin User (JWT may be stale).
 */
const resolveAdminLinkedEmployee = async (decoded) => {
  if (!decoded?.userId) return null;

  const userDoc = await User.findById(decoded.userId)
    .select('employeeProfileId organizationId email roles role')
    .lean();

  if (!userDoc) return null;

  if (userDoc.employeeProfileId) {
    const byProfileLink = await Employee.findById(userDoc.employeeProfileId)
      .select('-password -__v')
      .lean();
    if (byProfileLink) return byProfileLink;
  }

  if (userDoc.organizationId) {
    const byUserId = await Employee.findOne({
      userId: decoded.userId,
      organizationId: userDoc.organizationId,
    })
      .select('-password -__v')
      .lean();
    if (byUserId) return byUserId;
  }

  const orgOwner = await resolveOrgOwnerUser(userDoc.organizationId);
  if (orgOwner && String(orgOwner._id) === String(decoded.userId)) {
    const ownerEmail = String(orgOwner.email || '').toLowerCase().trim();
    const byOwnerEmail = await findOrgOwnerEmployeeProfile(
      orgOwner,
      userDoc.organizationId,
      ownerEmail
    );
    if (byOwnerEmail) {
      return typeof byOwnerEmail.toObject === 'function'
        ? byOwnerEmail.toObject()
        : byOwnerEmail;
    }
  }

  return null;
};

/**
 * Load workforce employee onto req (department, organizationId, etc.).
 * Used by isAuthenticated and isAuthenticatedBoth so rule API matches clock-in.
 */
export const loadEmployeeContext = async (req, decoded) => {
  let employee = null;
  const tokenEmployeeId = resolveEmployeeIdFromToken(decoded);

  if (tokenEmployeeId) {
    employee = await Employee.findById(tokenEmployeeId).select('-password -__v').lean();
  }

  if (!employee && decoded.role === 'admin') {
    employee = await resolveAdminLinkedEmployee(decoded);
  }

  if (!employee) {
    attachUserToRequest(req, decoded);
    return { loaded: false };
  }

  req.employee = employee;
  req.organizationId =
    employee.organizationId || decoded.organizationId || req.organizationId || null;

  attachUserToRequest(req, decoded);

  if (decoded.role === 'admin') {
    req.user = {
      ...(req.user || {}),
      _id: decoded.userId,
      role: 'admin',
      organizationId:
        employee.organizationId ||
        decoded.organizationId ||
        req.user?.organizationId ||
        null,
      platformRoles: decoded.platformRoles || req.user?.platformRoles || [],
      employeeProfileId: employee._id,
    };
  }

  return { loaded: true, employee };
};
