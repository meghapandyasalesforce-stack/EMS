import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest } from "./authHelpers.js";
import Employee from "../models/employee.model.js";

/**
 * Middleware that allows only CEO to access resources
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next function
 */
const isCEOAuthenticated = async (req, res, next) => {
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

        // For employees, check if they are CEO
        if (decoded.role === "employee") {
            try {
                const employee = await Employee.findById(decoded.userId)
                    .select('department position jobTitle organizationId status active')
                    .lean();

                if (!employee) {
                    logger.warn('Employee not found for CEO access check', { userId: decoded.userId });
                    return res.status(403).json({ 
                        success: false,
                        message: "Access restricted to CEO only",
                        code: 'INSUFFICIENT_PERMISSIONS'
                    });
                }

                // Check if employee is active
                if (employee.status !== 'active' && employee.active !== true) {
                    return res.status(403).json({
                        success: false,
                        message: 'Your account is inactive. Please contact administrator.',
                        code: 'ACCOUNT_INACTIVE'
                    });
                }

                // Check if employee is CEO
                const position = (employee.position || '').toLowerCase().trim();
                const isCEO = 
                    position === 'ceo' || 
                    position.includes('chief executive');

                if (isCEO) {
                    // Ensure organizationId is in decoded token before attaching
                    if (employee.organizationId && !decoded.organizationId) {
                        decoded.organizationId = employee.organizationId;
                    }
                    // Attach employee to request
                    attachUserToRequest(req, decoded);
                    // Also attach full employee data for easy access
                    req.employee = employee;
                    // Ensure organizationId is set on request (double-check)
                    if (employee.organizationId) {
                        req.organizationId = employee.organizationId;
                    }
                    return next();
                }

                logger.warn('CEO access denied - not a CEO position', { 
                    userId: decoded.userId, 
                    position: employee.position 
                });
                return res.status(403).json({ 
                    success: false,
                    message: "Access restricted to CEO only",
                    code: 'INSUFFICIENT_PERMISSIONS',
                    debug: process.env.NODE_ENV === 'development' ? { 
                        role: decoded.role, 
                        position: employee.position 
                    } : undefined
                });
            } catch (error) {
                logger.error('Error checking CEO access status', { error: error.message, userId: decoded.userId });
                return res.status(500).json({ 
                    success: false,
                    message: "Server authentication error",
                    code: 'SERVER_ERROR'
                });
            }
        }

        // Admin users are not allowed (only CEO employee can access)
        logger.warn('CEO access denied - admin users not allowed for this endpoint', { role: decoded.role, userId: decoded.userId });
        return res.status(403).json({ 
            success: false,
            message: "Access restricted to CEO only",
            code: 'INSUFFICIENT_PERMISSIONS',
            debug: process.env.NODE_ENV === 'development' ? { role: decoded.role } : undefined
        });
    } catch (error) {
        logger.error("CEO Auth Middleware Error", { error: error.message, stack: error.stack });
        return res.status(500).json({ 
            success: false,
            message: "Server authentication error",
            code: 'SERVER_ERROR'
        });
    }
};

export default isCEOAuthenticated;

