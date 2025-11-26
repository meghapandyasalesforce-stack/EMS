import { extractToken, verifyToken, handleAuthError, attachUserToRequest } from './authHelpers.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import logger from '../helpers/logger.js';

/**
 * Unified authentication middleware that works for both admin and employee
 */
const unifiedAuth = async (req, res, next) => {
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

        // Determine if user is admin or employee based on role in token
        const role = decoded.role;
        
        if (role === 'admin') {
            // Load admin user
            const user = await User.findById(decoded.userId);
            if (!user || !user.isActive) {
                return res.status(401).json({
                    success: false,
                    message: 'User not found or inactive'
                });
            }
            req.user = {
                _id: user._id,
                role: 'admin',
                organizationId: user.organizationId || decoded.organizationId
            };
            req.organizationId = user.organizationId || decoded.organizationId;
        } else if (role === 'employee') {
            // Load employee
            const employee = await Employee.findById(decoded.userId);
            if (!employee || employee.status !== 'active') {
                return res.status(401).json({
                    success: false,
                    message: 'Employee not found or inactive'
                });
            }
            req.employee = {
                _id: employee._id,
                role: 'employee',
                organizationId: employee.organizationId || decoded.organizationId
            };
            req.organizationId = employee.organizationId || decoded.organizationId;
        } else {
            return res.status(403).json({
                success: false,
                message: 'Invalid user role'
            });
        }

        next();
    } catch (error) {
        logger.error("Unified Auth Middleware Error", { error: error.message, stack: error.stack });
        return res.status(500).json({ 
            success: false,
            message: "Server authentication error",
            code: 'SERVER_ERROR'
        });
    }
};

export default unifiedAuth;

