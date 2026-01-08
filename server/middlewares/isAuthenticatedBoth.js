import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest } from "./authHelpers.js";

/**
 * Middleware that allows both admin users and employees to access resources
 * This is for "both" routes that should be accessible by all authenticated users
 */
const isAuthenticatedBoth = async (req, res, next) => {
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

        // Allow both admin and employee roles
        if (decoded.role === "admin" || decoded.role === "employee") {
            attachUserToRequest(req, decoded);
            return next();
        }

        return res.status(403).json({ 
            success: false,
            message: "Access denied",
            code: 'INSUFFICIENT_PERMISSIONS'
        });
    } catch (error) {
        logger.error("Auth Middleware Error", { error: error.message, stack: error.stack });
        return res.status(500).json({ 
            success: false,
            message: "Server authentication error",
            code: 'SERVER_ERROR'
        });
    }
};

export { isAuthenticatedBoth };
export default isAuthenticatedBoth;

