/**
 * Role-Based Access Control (RBAC) Middleware
 * Implements permission-based access control with role hierarchy support
 */

import Role from '../models/role.model.js';
import Employee from '../models/employee.model.js';
import User from '../models/user.model.js';
import logger from '../helpers/logger.js';

/**
 * Check if user has required permission
 * @param {string} module - Module name (e.g., 'employees', 'payroll')
 * @param {string|string[]} action - Required action(s) (e.g., 'read', 'write', ['read', 'write'])
 * @returns {Function} Express middleware
 */
export const requirePermission = (module, action) => {
    return async (req, res, next) => {
        try {
            const user = req.user || req.employee;
            const organizationId = req.organizationId;

            if (!user || !organizationId) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            // Admins have all permissions by default (can be overridden)
            if (user.role === 'admin') {
                // Check if admin has specific restrictions
                const adminUser = await User.findById(user._id)
                    .select('canManageSystem canAccessReports')
                    .lean();
                
                // System management requires special permission
                if (module === 'settings' && action === 'manage' && !adminUser?.canManageSystem) {
                    return res.status(403).json({
                        success: false,
                        message: 'Insufficient permissions: System management access required',
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }

                // Reports access requires special permission
                if (module === 'reports' && !adminUser?.canAccessReports) {
                    return res.status(403).json({
                        success: false,
                        message: 'Insufficient permissions: Reports access required',
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }

                return next();
            }

            // For employees, check role-based permissions
            if (user.role === 'employee') {
                const employee = await Employee.findById(user._id)
                    .select('assignedRole permissions rolePermissions')
                    .populate('assignedRole')
                    .lean();

                if (!employee) {
                    return res.status(404).json({
                        success: false,
                        message: 'Employee not found',
                        code: 'EMPLOYEE_NOT_FOUND'
                    });
                }

                // Get permissions from role
                let hasPermission = false;
                const requiredActions = Array.isArray(action) ? action : [action];

                // Check role permissions first
                if (employee.assignedRole) {
                    const role = employee.assignedRole;
                    if (role.permissions && Array.isArray(role.permissions)) {
                        const modulePermission = role.permissions.find(p => p.module === module);
                        if (modulePermission && modulePermission.actions) {
                            hasPermission = requiredActions.some(reqAction =>
                                modulePermission.actions.includes(reqAction)
                            );
                        }
                    }
                }

                // Check direct employee permissions (override role permissions)
                if (employee.permissions && Array.isArray(employee.permissions)) {
                    const modulePermission = employee.permissions.find(p => p.module === module);
                    if (modulePermission && modulePermission.actions) {
                        const hasDirectPermission = requiredActions.some(reqAction =>
                            modulePermission.actions.includes(reqAction)
                        );
                        if (hasDirectPermission) {
                            hasPermission = true;
                        }
                    }
                }

                // Check role hierarchy - higher level roles can access lower level resources
                if (!hasPermission && employee.assignedRole) {
                    const role = employee.assignedRole;
                    if (role.level && role.level <= 3) {
                        // Level 1-3 can read most modules
                        if (requiredActions.includes('read')) {
                            hasPermission = true;
                        }
                    }
                }

                if (!hasPermission) {
                    logger.warn('Permission denied', {
                        userId: user._id,
                        role: user.role,
                        module,
                        action: requiredActions,
                        organizationId
                    });
                    return res.status(403).json({
                        success: false,
                        message: `Insufficient permissions: ${module}.${requiredActions.join(' or ')} required`,
                        code: 'INSUFFICIENT_PERMISSIONS',
                        required: { module, action: requiredActions }
                    });
                }
            }

            next();
        } catch (error) {
            logger.error('RBAC middleware error', {
                error: error.message,
                stack: error.stack,
                module,
                action
            });
            return res.status(500).json({
                success: false,
                message: 'Permission check failed',
                code: 'RBAC_ERROR'
            });
        }
    };
};

/**
 * Check if user has any of the required roles
 * @param {string|string[]} roles - Required role(s)
 * @returns {Function} Express middleware
 */
export const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            const user = req.user || req.employee;
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Authentication required',
                    code: 'UNAUTHORIZED'
                });
            }

            const requiredRoles = Array.isArray(roles) ? roles : [roles];
            const userRole = user.role;

            if (!requiredRoles.includes(userRole)) {
                logger.warn('Role access denied', {
                    userId: user._id,
                    userRole,
                    requiredRoles
                });
                return res.status(403).json({
                    success: false,
                    message: `Access denied. Required role: ${requiredRoles.join(' or ')}`,
                    code: 'INSUFFICIENT_ROLE'
                });
            }

            next();
        } catch (error) {
            logger.error('Role check middleware error', {
                error: error.message,
                stack: error.stack
            });
            return res.status(500).json({
                success: false,
                message: 'Role check failed',
                code: 'ROLE_CHECK_ERROR'
            });
        }
    };
};

/**
 * Check if user can manage a specific role (role hierarchy)
 * @param {Object} req - Express request
 * @param {Object} targetRole - Target role to manage
 * @returns {boolean} True if user can manage the role
 */
export const canManageRole = async (req, targetRole) => {
    try {
        const user = req.user || req.employee;
        if (!user) return false;

        // Admins can manage all roles
        if (user.role === 'admin') {
            const adminUser = await User.findById(user._id)
                .select('canManageRoles')
                .lean();
            return adminUser?.canManageRoles !== false;
        }

        // Employees need to check their role level
        if (user.role === 'employee') {
            const employee = await Employee.findById(user._id)
                .select('assignedRole')
                .populate('assignedRole')
                .lean();

            if (!employee?.assignedRole) return false;

            const userRoleLevel = employee.assignedRole.level || 10;
            const targetRoleLevel = targetRole.level || 10;

            // User can only manage roles with higher level (lower number = higher privilege)
            return userRoleLevel < targetRoleLevel;
        }

        return false;
    } catch (error) {
        logger.error('canManageRole check error', {
            error: error.message,
            stack: error.stack
        });
        return false;
    }
};

export default {
    requirePermission,
    requireRole,
    canManageRole
};

