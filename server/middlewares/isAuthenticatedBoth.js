import logger from '../helpers/logger.js';
import { extractToken, verifyToken, handleAuthError, verifyPasswordNotChanged } from './authHelpers.js';
import { loadEmployeeContext } from './loadEmployeeContext.js';

/**
 * Middleware for routes shared by admin and employees.
 * Loads full employee profile when JWT maps to a workforce record (aligned with clock-in).
 */
const isAuthenticatedBoth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
        code: 'NO_TOKEN',
      });
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (error) {
      return handleAuthError(error, res);
    }

    if (decoded.role !== 'admin' && decoded.role !== 'employee') {
      return res.status(403).json({
        success: false,
        message: 'Access denied',
        code: 'INSUFFICIENT_PERMISSIONS',
      });
    }

    const ctx = await loadEmployeeContext(req, decoded);

    // Only workforce-only sessions hard-fail when profile is missing
    if (ctx.notFound && decoded.role === 'employee') {
      return res.status(404).json({
        success: false,
        message: 'Employee not found',
        code: 'EMPLOYEE_NOT_FOUND',
      });
    }

    if (ctx.loaded && req.employee) {
      let passwordChangedAt = req.employee.passwordChangedAt;
      if (decoded.role === 'admin' && req.employee.userId) {
        const User = (await import('../models/user.model.js')).default;
        const linkedUser = await User.findById(req.employee.userId)
          .select('passwordChangedAt createdAt')
          .lean();
        if (linkedUser) {
          passwordChangedAt = linkedUser.passwordChangedAt || linkedUser.createdAt;
        }
      }

      if (!verifyPasswordNotChanged(decoded, passwordChangedAt)) {
        return res.status(401).json({
          success: false,
          message: 'Session expired due to password change. Please log in again.',
          code: 'PASSWORD_CHANGED',
        });
      }
    }

    return next();
  } catch (error) {
    logger.error('Auth Middleware Error', {
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).json({
      success: false,
      message: 'Server authentication error',
      code: 'SERVER_ERROR',
    });
  }
};

export { isAuthenticatedBoth };
export default isAuthenticatedBoth;
