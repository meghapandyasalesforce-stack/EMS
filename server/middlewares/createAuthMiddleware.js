/**
 * Factory function to create configurable authentication middleware
 * Reduces code duplication across multiple auth middlewares
 * 
 * @param {Object} options - Configuration options
 * @param {string[]} options.allowedRoles - Roles allowed to access (['admin', 'employee'])
 * @param {Function} options.customCheck - Optional custom role/permission check function
 * @param {string} options.errorMessage - Custom error message for access denied
 * @param {string} options.errorCode - Custom error code for access denied
 * @returns {Function} Express middleware function
 */
import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest } from "./authHelpers.js";
import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";

export const createAuthMiddleware = (options = {}) => {
    const {
        allowedRoles = ['admin', 'employee'],
        customCheck = null,
        errorMessage = 'Access denied',
        errorCode = 'INSUFFICIENT_PERMISSIONS',
        requireActive = true
    } = options;

    return async (req, res, next) => {
        try {
            // Extract token from request
            const token = extractToken(req);
            
            if (!token) {
                return res.status(401).json({ 
                    success: false,
                    message: "User not authenticated",
                    code: 'NO_TOKEN'
                });
            }

            // Verify token
            let decoded;
            try {
                decoded = verifyToken(token);
            } catch (error) {
                return handleAuthError(error, res);
            }

            // Check if role is allowed
            const role = decoded.role;
            if (!allowedRoles.includes(role)) {
                logger.warn('Access denied - role not allowed', { 
                    role, 
                    allowedRoles, 
                    userId: decoded.userId 
                });
                return res.status(403).json({ 
                    success: false,
                    message: errorMessage,
                    code: errorCode,
                    debug: process.env.NODE_ENV === 'development' ? { role, allowedRoles } : undefined
                });
            }

            // Load user/employee data if needed for custom checks or active status
            let userData = null;
            if (customCheck || requireActive) {
                if (role === 'admin') {
                    userData = await User.findById(decoded.userId)
                        .select('isActive organizationId')
                        .lean();
                    
                    if (!userData) {
                        return res.status(401).json({
                            success: false,
                            message: 'User not found',
                            code: 'USER_NOT_FOUND'
                        });
                    }
                    
                    if (requireActive && !userData.isActive) {
                        return res.status(403).json({
                            success: false,
                            message: 'User account is inactive',
                            code: 'USER_INACTIVE'
                        });
                    }
                    
                    // Update decoded with organizationId if missing
                    if (userData.organizationId && !decoded.organizationId) {
                        decoded.organizationId = userData.organizationId;
                    }
                } else if (role === 'employee') {
                    userData = await Employee.findById(decoded.userId)
                        .select('status active organizationId')
                        .lean();
                    
                    if (!userData) {
                        return res.status(401).json({
                            success: false,
                            message: 'Employee not found',
                            code: 'EMPLOYEE_NOT_FOUND'
                        });
                    }
                    
                    if (requireActive && userData.status !== 'active' && userData.active !== true) {
                        return res.status(403).json({
                            success: false,
                            message: 'Employee account is inactive',
                            code: 'EMPLOYEE_INACTIVE'
                        });
                    }
                    
                    // Update decoded with organizationId if missing
                    if (userData.organizationId && !decoded.organizationId) {
                        decoded.organizationId = userData.organizationId;
                    }
                }
            }

            // Run custom check if provided
            if (customCheck) {
                const customResult = await customCheck(req, decoded, userData);
                if (customResult !== true) {
                    const message = typeof customResult === 'string' ? customResult : errorMessage;
                    return res.status(403).json({
                        success: false,
                        message,
                        code: errorCode
                    });
                }
            }

            // Attach user/employee to request
            attachUserToRequest(req, decoded);

            next();
        } catch (error) {
            logger.error("Auth Middleware Error", { 
                error: error.message, 
                stack: error.stack,
                options
            });
            return res.status(500).json({ 
                success: false,
                message: "Server authentication error",
                code: 'SERVER_ERROR'
            });
        }
    };
};

/**
 * Pre-configured middleware for admin-only access
 */
export const isAdminOnly = createAuthMiddleware({
    allowedRoles: ['admin'],
    errorMessage: 'Access restricted to admins only',
    errorCode: 'ADMIN_ONLY'
});

/**
 * Pre-configured middleware for employee-only access
 */
export const isEmployeeOnly = createAuthMiddleware({
    allowedRoles: ['employee'],
    errorMessage: 'Access restricted to employees only',
    errorCode: 'EMPLOYEE_ONLY'
});

/**
 * Pre-configured middleware for both admin and employee access
 */
export const isAdminOrEmployee = createAuthMiddleware({
    allowedRoles: ['admin', 'employee'],
    errorMessage: 'Access denied',
    errorCode: 'INSUFFICIENT_PERMISSIONS'
});

/**
 * Helper function to check if employee has HR role
 * SECURITY: Uses explicit functionalRoles array instead of string matching
 */
const checkIsHR = (employee) => {
    const functionalRoles = employee.functionalRoles || [];
    return functionalRoles.includes('hr');
};

/**
 * Helper function to check if employee has Manager role
 * SECURITY: Uses explicit functionalRoles array instead of string matching
 */
const checkIsManager = (employee) => {
    const functionalRoles = employee.functionalRoles || [];
    return functionalRoles.includes('manager');
};

/**
 * Helper function to check if employee is Executive
 * SECURITY: Uses explicit functionalRoles array instead of string matching
 */
const checkIsExecutive = (employee) => {
    const functionalRoles = employee.functionalRoles || [];
    return functionalRoles.includes('executive') || 
           functionalRoles.includes('ceo') ||
           functionalRoles.includes('cto') ||
           functionalRoles.includes('cfo') ||
           functionalRoles.includes('vp');
};

/**
 * Pre-configured middleware for admin or HR access
 */
export const isAdminOrHR = createAuthMiddleware({
    allowedRoles: ['admin', 'employee'],
    errorMessage: 'Access restricted to admins and HR personnel only',
    errorCode: 'INSUFFICIENT_PERMISSIONS',
    customCheck: async (req, decoded, userData) => {
        // Admin is always allowed
        if (decoded.role === 'admin') {
            return true;
        }

        // For employees, check if they are HR
        if (decoded.role === 'employee') {
            const employee = await Employee.findById(decoded.userId)
                .select('functionalRoles organizationId')
                .lean();

            if (!employee) {
                return 'Employee not found';
            }

            if (checkIsHR(employee)) {
                // Ensure organizationId is available from employee record if not in token
                if (employee.organizationId && !decoded.organizationId) {
                    decoded.organizationId = employee.organizationId;
                }
                // Set organizationId on request first
                req.organizationId = employee.organizationId || decoded.organizationId || null;
                // Attach user to request (this sets basic req.employee)
                attachUserToRequest(req, decoded);
                // Then enhance req.employee with functional roles
                req.employee = {
                    ...req.employee,
                    functionalRoles: employee.functionalRoles || [],
                    organizationId: employee.organizationId || decoded.organizationId || req.organizationId
                };
                return true;
            }

            logger.warn('HR access denied - not HR employee', { 
                userId: decoded.userId,
                functionalRoles: employee.functionalRoles || []
            });
            return 'Access restricted to admins and HR personnel only';
        }

        return 'Access restricted to admins and HR personnel only';
    }
});

/**
 * Pre-configured middleware for admin or executive access
 */
export const isAdminOrExecutive = createAuthMiddleware({
    allowedRoles: ['admin', 'employee'],
    errorMessage: 'Access restricted to admins and executives only',
    errorCode: 'INSUFFICIENT_PERMISSIONS',
    customCheck: async (req, decoded, userData) => {
        // Admin is always allowed
        if (decoded.role === 'admin') {
            return true;
        }

        // For employees, check if they are executives
        if (decoded.role === 'employee') {
            const employee = await Employee.findById(decoded.userId)
                .select('functionalRoles organizationId status active')
                .lean();

            if (!employee) {
                return 'Employee not found';
            }

            if (checkIsExecutive(employee)) {
                // Ensure organizationId is available from employee record if not in token
                if (employee.organizationId && !decoded.organizationId) {
                    decoded.organizationId = employee.organizationId;
                }
                // Attach employee to request
                attachUserToRequest(req, decoded);
                // Also attach full employee data for easy access
                req.employee = {
                    ...req.employee,
                    functionalRoles: employee.functionalRoles || [],
                    organizationId: employee.organizationId,
                    status: employee.status,
                    active: employee.active
                };
                // Ensure organizationId is set on request (double-check)
                if (employee.organizationId) {
                    req.organizationId = employee.organizationId;
                }
                return true;
            }

            logger.warn('Executive access denied - not an executive position', { 
                userId: decoded.userId,
                functionalRoles: employee.functionalRoles || []
            });
            return 'Access restricted to admins and executives only';
        }

        return 'Access restricted to admins and executives only';
    }
});

/**
 * Pre-configured middleware for admin, HR, or executive access
 */
export const isAdminOrHROrExecutive = createAuthMiddleware({
    allowedRoles: ['admin', 'employee'],
    errorMessage: 'Access restricted to admins, HR personnel, and executives only',
    errorCode: 'INSUFFICIENT_PERMISSIONS',
    customCheck: async (req, decoded, userData) => {
        // Admin is always allowed
        if (decoded.role === 'admin') {
            return true;
        }

        // For employees, check if they are HR or Executive
        if (decoded.role === 'employee') {
            const employee = await Employee.findById(decoded.userId)
                .select('functionalRoles organizationId status active')
                .lean();

            if (!employee) {
                return 'Employee not found';
            }

            const isHR = checkIsHR(employee);
            const isExec = checkIsExecutive(employee);

            if (isHR || isExec) {
                // Ensure organizationId is available
                if (employee.organizationId && !decoded.organizationId) {
                    decoded.organizationId = employee.organizationId;
                }
                req.organizationId = employee.organizationId || decoded.organizationId || null;
                attachUserToRequest(req, decoded);
                req.employee = {
                    ...req.employee,
                    functionalRoles: employee.functionalRoles || [],
                    organizationId: employee.organizationId || decoded.organizationId || req.organizationId
                };
                return true;
            }

            logger.warn('HR/Executive access denied', { 
                userId: decoded.userId,
                functionalRoles: employee.functionalRoles || []
            });
            return 'Access restricted to admins, HR personnel, and executives only';
        }

        return 'Access restricted to admins, HR personnel, and executives only';
    }
});

/**
 * Pre-configured middleware for admin, HR, manager, or executive access
 */
export const isAdminOrManagerOrHR = createAuthMiddleware({
    allowedRoles: ['admin', 'employee'],
    errorMessage: 'Access restricted to admins, HR personnel, managers, and executives only',
    errorCode: 'INSUFFICIENT_PERMISSIONS',
    customCheck: async (req, decoded, userData) => {
        // Admin is always allowed
        if (decoded.role === 'admin') {
            return true;
        }

        // For employees, check if they are HR, Manager, or Executive
        if (decoded.role === 'employee') {
            const employee = await Employee.findById(decoded.userId)
                .select('functionalRoles organizationId status active')
                .lean();

            if (!employee) {
                return 'Employee not found';
            }

            const isHR = checkIsHR(employee);
            const isManager = checkIsManager(employee);
            const isExec = checkIsExecutive(employee);

            if (isHR || isManager || isExec) {
                // Enhance req.employee with functional roles
                if (req.employee) {
                    req.employee = {
                        ...req.employee,
                        functionalRoles: employee.functionalRoles || [],
                        organizationId: employee.organizationId || decoded.organizationId || req.organizationId,
                        isManager: isManager,
                        isHR: isHR,
                        isExecutive: isExec
                    };
                }
                if (employee.organizationId && !decoded.organizationId) {
                    decoded.organizationId = employee.organizationId;
                }
                req.organizationId = employee.organizationId || decoded.organizationId || null;
                return true;
            }

            logger.warn('Access denied - not HR, Manager, or Executive', { 
                userId: decoded.userId,
                functionalRoles: employee.functionalRoles || []
            });
            return 'Access restricted to admins, HR personnel, managers, and executives only';
        }

        return 'Access restricted to admins, HR personnel, managers, and executives only';
    }
});

export default createAuthMiddleware;

