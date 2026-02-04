import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest, verifyPasswordNotChanged } from "./authHelpers.js";
import Employee from "../models/employee.model.js";

const isAuthenticated = async (req, res, next) => {
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

        // Restrict access to employees ONLY (Admins blocked)
        if (decoded.role !== "employee") {
            return res.status(403).json({ 
                success: false,
                message: "Access restricted to employees only",
                code: 'EMPLOYEE_ONLY'
            });
        }

        // Load full employee record from database
        try {
            const employee = await Employee.findById(decoded.userId)
                .select('-password -__v')
                .lean();

            if (!employee) {
                logger.warn('Employee not found in isAuthenticated', { userId: decoded.userId });
                return res.status(404).json({ 
                    success: false,
                    message: "Employee not found",
                    code: 'EMPLOYEE_NOT_FOUND'
                });
            }

            // Check if employee is active
            // ✅ Standardized: Use active field (boolean) for login checks
            // Status field is used for queries, active field is used for quick boolean checks
            if (!employee.active) {
                logger.warn('Inactive employee trying to access', { 
                    userId: decoded.userId,
                    status: employee.status,
                    active: employee.active
                });
                return res.status(403).json({ 
                    success: false,
                    message: "Account is inactive",
                    code: 'ACCOUNT_INACTIVE'
                });
            }

            // SECURITY: Check if password was changed after token was issued
            if (!verifyPasswordNotChanged(decoded, employee.passwordChangedAt)) {
                logger.warn('Token invalidated due to password change', { userId: decoded.userId });
                return res.status(401).json({ 
                    success: false,
                    message: "Session expired due to password change. Please log in again.",
                    code: 'PASSWORD_CHANGED'
                });
            }

            // Attach employee to request
            req.employee = employee;
            req.organizationId = employee.organizationId || decoded.organizationId || null;
            
            // Also attach basic user info for compatibility
            attachUserToRequest(req, decoded);
            
            // Ensure req.employee has all necessary fields
            if (req.employee && !req.employee._id) {
                req.employee._id = employee._id;
            }

        } catch (error) {
            logger.error('Error loading employee in isAuthenticated', { 
                error: error.message, 
                userId: decoded.userId 
            });
            return res.status(500).json({ 
                success: false,
                message: "Server authentication error",
                code: 'SERVER_ERROR'
            });
        }

        next();
    } catch (error) {
        logger.error("Auth Middleware Error", { error: error.message, stack: error.stack });
        return res.status(500).json({ 
            success: false,
            message: "Server authentication error",
            code: 'SERVER_ERROR'
        });
    }
};

export default isAuthenticated;