import Employee from '../models/employee.model.js';
import { attachUserToRequest } from './authHelpers.js';

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
 * Load workforce employee onto req (department, organizationId, etc.).
 * Used by isAuthenticated and isAuthenticatedBoth so rule API matches clock-in.
 */
export const loadEmployeeContext = async (req, decoded) => {
  const employeeId = resolveEmployeeIdFromToken(decoded);
  if (!employeeId) {
    attachUserToRequest(req, decoded);
    return { loaded: false };
  }

  const employee = await Employee.findById(employeeId).select('-password -__v').lean();
  if (!employee) {
    return { loaded: false, notFound: true };
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
    };
  }

  return { loaded: true, employee };
};
