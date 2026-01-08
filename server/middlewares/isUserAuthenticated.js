import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest, verifyPasswordNotChanged } from "./authHelpers.js";
import User from "../models/user.model.js";
import Employee from "../models/employee.model.js";

const isUserAuthenticated = async (req, res, next) => {
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

        // Load full user/employee record to get organizationId if not in token
        try {
            if (decoded.role === 'admin') {
                const user = await User.findById(decoded.userId).select('organizationId isActive passwordChangedAt');
                if (user) {
                    // Update decoded with organizationId if missing
                    if (user.organizationId && !decoded.organizationId) {
                        decoded.organizationId = user.organizationId;
                    }
                    // Check if user is active
                    if (!user.isActive) {
                        return res.status(403).json({
                            success: false,
                            message: 'Your account is inactive. Please contact administrator.',
                            code: 'ACCOUNT_INACTIVE'
                        });
                    }
                    // SECURITY: Check if password was changed after token was issued
                    if (!verifyPasswordNotChanged(decoded, user.passwordChangedAt)) {
                        logger.warn('Token invalidated due to password change', { userId: decoded.userId });
                        return res.status(401).json({
                            success: false,
                            message: 'Session expired due to password change. Please log in again.',
                            code: 'PASSWORD_CHANGED'
                        });
                    }
                }
            } else {
                const employee = await Employee.findById(decoded.userId).select('organizationId status active passwordChangedAt');
                if (employee) {
                    // Update decoded with organizationId if missing
                    if (employee.organizationId && !decoded.organizationId) {
                        decoded.organizationId = employee.organizationId;
                    }
                    // Check if employee is active
                    if (employee.status !== 'active' && employee.active !== true) {
                        return res.status(403).json({
                            success: false,
                            message: 'Your account is inactive. Please contact administrator.',
                            code: 'ACCOUNT_INACTIVE'
                        });
                    }
                    // SECURITY: Check if password was changed after token was issued
                    if (!verifyPasswordNotChanged(decoded, employee.passwordChangedAt)) {
                        logger.warn('Token invalidated due to password change', { userId: decoded.userId });
                        return res.status(401).json({
                            success: false,
                            message: 'Session expired due to password change. Please log in again.',
                            code: 'PASSWORD_CHANGED'
                        });
                    }
                }
            }
        } catch (dbError) {
            logger.error('Error loading user/employee in isUserAuthenticated', {
                error: dbError.message,
                userId: decoded.userId,
                role: decoded.role
            });
            // Continue anyway - organizationId might be in token
        }

        // Allow both roles; attach whichever is present
        attachUserToRequest(req, decoded);

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

export default isUserAuthenticated;


