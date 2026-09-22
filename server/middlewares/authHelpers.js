import jwt from "jsonwebtoken";
import logger from "../helpers/logger.js";
import { enrichEmployeeRoleFlags } from "../helpers/functionalRolesHelper.js";

/**
 * Extract JWT token from request (cookie or Authorization header)
 * @param {Object} req - Express request object
 * @returns {string|null} - JWT token or null if not found
 */
export const extractToken = (req) => {
    // Try cookie first
    let token = req.cookies?.jwt;
    
    // Fallback to Authorization header
    if (!token && req.headers.authorization) {
        const authHeader = req.headers.authorization;
        if (authHeader.startsWith('Bearer ')) {
            token = authHeader.substring(7);
        }
    }
    
    return token || null;
};

/**
 * Verify JWT token and return decoded payload
 * @param {string} token - JWT token to verify
 * @returns {Object} - Decoded token payload
 * @throws {Error} - If token is invalid or expired
 */
export const verifyToken = (token) => {
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        
        if (!decoded || !decoded.userId) {
            throw new Error('Invalid token payload');
        }
        
        return decoded;
    } catch (error) {
        if (error.name === "TokenExpiredError") {
            const expiredError = new Error("Session expired, please log in again");
            expiredError.name = "TokenExpiredError";
            expiredError.statusCode = 401;
            throw expiredError;
        }
        if (error.name === "JsonWebTokenError") {
            const invalidError = new Error("Invalid token");
            invalidError.name = "JsonWebTokenError";
            invalidError.statusCode = 401;
            throw invalidError;
        }
        const authError = new Error("Authentication failed");
        authError.statusCode = 401;
        throw authError;
    }
};

/**
 * Verify that token was issued after password was last changed
 * @param {Object} decoded - Decoded JWT token
 * @param {Date|number} passwordChangedAt - Timestamp when password was last changed
 * @returns {boolean} - True if token is valid, false if password was changed after token was issued
 */
export const verifyPasswordNotChanged = (decoded, passwordChangedAt) => {
    if (!passwordChangedAt) {
        // No password change recorded, assume valid
        return true;
    }
    
    const tokenPasswordTime = decoded?.passwordChangedAt
        ?? (decoded?.iat ? decoded.iat * 1000 : null);
    if (!tokenPasswordTime) {
        // Backward compatibility: token missing timing info
        return true;
    }
    const currentPasswordTime = passwordChangedAt instanceof Date 
        ? passwordChangedAt.getTime() 
        : passwordChangedAt;
    
    // Token is valid if it was issued after password was changed
    return tokenPasswordTime >= currentPasswordTime;
};

/**
 * Create standardized authentication error response
 * @param {Error} error - Error object
 * @param {Object} res - Express response object
 * @returns {Object} - Error response
 */
export const handleAuthError = (error, res) => {
    const statusCode = error.statusCode || 401;
    const message = error.message || "Authentication failed";
    
    return res.status(statusCode).json({
        success: false,
        message,
        code: error.name || 'AUTH_ERROR'
    });
};

/**
 * Attach user/employee to request based on role
 * @param {Object} req - Express request object
 * @param {Object} decoded - Decoded JWT token
 */
export const attachUserToRequest = (req, decoded) => {
    const tokenOrgId = decoded.organizationId || null;

    if (decoded.role === 'platform') {
        req.user = {
            ...(req.user || {}),
            _id: decoded.userId,
            role: 'platform',
            organizationId: null,
            platformRoles: decoded.platformRoles || ['platform_operator'],
        };
        req.organizationId = undefined;
        return;
    }

    if (decoded.role === 'admin') {
        req.user = {
            ...(req.user || {}),
            _id: decoded.userId,
            role: 'admin',
            organizationId:
                tokenOrgId ||
                req.user?.organizationId ||
                req.employee?.organizationId ||
                null,
            platformRoles: decoded.platformRoles || req.user?.platformRoles || [],
        };
        if (decoded.employeeProfileId) {
            req.employeeProfileId = decoded.employeeProfileId;
            const profileId = String(decoded.employeeProfileId);
            const existingId = req.employee?._id ? String(req.employee._id) : null;
            if (!existingId || existingId === profileId) {
                req.employee = {
                    ...(req.employee || {}),
                    _id: decoded.employeeProfileId,
                    role: 'employee',
                    organizationId:
                        req.employee?.organizationId ||
                        tokenOrgId ||
                        req.user?.organizationId ||
                        null,
                };
            }
        }
    } else {
        req.employee = {
            ...(req.employee || {}),
            _id: decoded.userId,
            role: 'employee',
            organizationId:
                req.employee?.organizationId ||
                tokenOrgId ||
                null,
            platformRoles: decoded.platformRoles || req.employee?.platformRoles || [],
        };
    }

    req.organizationId =
        req.employee?.organizationId ||
        req.user?.organizationId ||
        tokenOrgId ||
        req.organizationId ||
        null;
};

/**
 * Copy authContext identity onto req for controllers using req.user / req.employee.
 * Permission middleware only built req.authContext; this restores the legacy shape.
 */
export const hydrateRequestIdentity = async (req, decoded, authContext) => {
    if (!decoded || !authContext) {
        return;
    }

    const platformRoles = authContext.platformRoles || [];

    if (authContext.user) {
        req.user = {
            ...authContext.user,
            _id: authContext.user._id || decoded.userId,
            role: 'admin',
            organizationId:
                authContext.user.organizationId ||
                decoded.organizationId ||
                authContext.employee?.organizationId ||
                null,
            platformRoles,
        };
    }

    const employeeId =
        decoded.role === 'employee'
            ? decoded.userId
            : decoded.employeeProfileId || authContext.employee?._id;

    if (employeeId) {
        const Employee = (await import('../models/employee.model.js')).default;
        const fullEmployee = await Employee.findById(employeeId)
            .select('-password -__v')
            .lean();
        if (fullEmployee) {
            req.employee = enrichEmployeeRoleFlags({
                ...fullEmployee,
                role: 'employee',
                platformRoles,
            });
        } else if (authContext.employee) {
            req.employee = enrichEmployeeRoleFlags({
                ...authContext.employee,
                role: 'employee',
                platformRoles,
            });
        }
    }

    attachUserToRequest(req, decoded);

    if (authContext.user && decoded.role === 'admin') {
        req.user = {
            ...req.user,
            ...authContext.user,
            _id: authContext.user._id || decoded.userId,
            role: 'admin',
            platformRoles,
        };
    }

    const orgId =
        req.employee?.organizationId ||
        req.user?.organizationId ||
        decoded.organizationId ||
        null;

    req.organizationId = orgId;
    if (orgId && !decoded.organizationId) {
        decoded.organizationId = orgId;
    }

    if (orgId) {
        try {
            const { attachTenantToRequest } = await import('../services/tenantService.js');
            await attachTenantToRequest(req);
        } catch {
            // Non-fatal — tenant limits checked explicitly on write paths
        }
    }
};

