import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import { attachUserToRequest } from './authHelpers.js';
import {
  ensureOrgOwnerEmployeeRoot,
  isOrgOwnerUser,
} from '../helpers/identityService.js';
import logger from '../helpers/logger.js';

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
 * Resolve linked Me workforce profile for an admin User (JWT may be stale).
 * Never returns the permanent isOrgOwnerRoot Admin/CEO Employee as Me.
 * Ensures the chart root exists for org owners without linking it as Me.
 */
const resolveAdminLinkedEmployee = async (decoded) => {
  if (!decoded?.userId) return null;

  const userDoc = await User.findById(decoded.userId)
    .select('employeeProfileId organizationId email roles role name phone')
    .lean();

  if (!userDoc) return null;

  // Keep permanent Admin/CEO root present for the org chart (does not set employeeProfileId)
  if (userDoc.organizationId && isOrgOwnerUser(userDoc)) {
    try {
      await ensureOrgOwnerEmployeeRoot(userDoc, userDoc.organizationId);
    } catch (err) {
      logger.warn('Failed to ensure org-owner employee root on context load', {
        organizationId: userDoc.organizationId,
        error: err.message,
      });
    }
  }

  if (userDoc.employeeProfileId) {
    const byProfileLink = await Employee.findById(userDoc.employeeProfileId)
      .select('-password -__v')
      .lean();
    if (byProfileLink && byProfileLink.isOrgOwnerRoot !== true) {
      return byProfileLink;
    }
  }

  if (userDoc.organizationId) {
    const byUserId = await Employee.findOne({
      userId: decoded.userId,
      organizationId: userDoc.organizationId,
      isOrgOwnerRoot: { $ne: true },
      status: { $ne: 'terminated' },
    })
      .select('-password -__v')
      .lean();
    if (byUserId) return byUserId;
  }

  // No separate Me profile yet — do not fall back to the CEO root
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
