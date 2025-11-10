import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest } from "./authHelpers.js";

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

        // Attach employee to request
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

export default isAuthenticated;