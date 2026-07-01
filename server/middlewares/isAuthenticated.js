import logger from "../helpers/logger.js";
import {
    extractToken,
    verifyToken,
    handleAuthError,
    verifyPasswordNotChanged,
} from "./authHelpers.js";
import User from "../models/user.model.js";
import { enrichEmployeeRoleFlags } from "../helpers/functionalRolesHelper.js";
import { loadEmployeeContext } from "./loadEmployeeContext.js";

const isAuthenticated = async (req, res, next) => {
    try {
        const token = extractToken(req);

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "User not authenticated",
                code: 'NO_TOKEN',
            });
        }

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (error) {
            return handleAuthError(error, res);
        }

        const ctx = await loadEmployeeContext(req, decoded);

        if (!ctx.loaded || !req.employee) {
            if (decoded.role === 'employee') {
                logger.warn('Employee not found in isAuthenticated', { userId: decoded.userId });
                return res.status(404).json({
                    success: false,
                    message: "Employee not found",
                    code: 'EMPLOYEE_NOT_FOUND',
                });
            }

            return res.status(403).json({
                success: false,
                message: 'No employee profile is linked to this account yet.',
                code: 'EMPLOYEE_PROFILE_REQUIRED',
            });
        }

        const employee = req.employee;

        if (!employee.active) {
            logger.warn('Inactive employee trying to access', {
                userId: decoded.userId,
                status: employee.status,
                active: employee.active,
            });
            return res.status(403).json({
                success: false,
                message: "Account is inactive",
                code: 'ACCOUNT_INACTIVE',
            });
        }

        let passwordChangedAt = employee.passwordChangedAt;
        if (decoded.role === 'admin' && employee.userId) {
            const linkedUser = await User.findById(employee.userId)
                .select('passwordChangedAt createdAt')
                .lean();
            if (linkedUser) {
                passwordChangedAt = linkedUser.passwordChangedAt || linkedUser.createdAt;
            }
        }

        if (!verifyPasswordNotChanged(decoded, passwordChangedAt)) {
            logger.warn('Token invalidated due to password change', { employeeId: employee._id });
            return res.status(401).json({
                success: false,
                message: "Session expired due to password change. Please log in again.",
                code: 'PASSWORD_CHANGED',
            });
        }

        req.employee = enrichEmployeeRoleFlags(employee);
        req.organizationId =
            employee.organizationId || decoded.organizationId || req.organizationId || null;

        if (decoded.role === 'admin' && req.user) {
            req.user = {
                ...req.user,
                employeeProfileId: employee._id,
            };
        }

        if (req.employee && !req.employee._id) {
            req.employee._id = employee._id;
        }

        return next();
    } catch (error) {
        logger.error("Auth Middleware Error", { error: error.message, stack: error.stack });
        return res.status(500).json({
            success: false,
            message: "Server authentication error",
            code: 'SERVER_ERROR',
        });
    }
};

export default isAuthenticated;
