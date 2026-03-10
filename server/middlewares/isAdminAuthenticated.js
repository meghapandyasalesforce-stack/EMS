import logger from "../helpers/logger.js";
import { extractToken, verifyToken, handleAuthError, attachUserToRequest } from "./authHelpers.js";
import User from "../models/user.model.js";

const isAdminAuthenticated = async (req, res, next) => {
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

        // Restrict access to admins only
        if (decoded.role !== "admin") {
            logger.warn('Admin access denied', { role: decoded.role, userId: decoded.userId });
            return res.status(403).json({ 
                success: false,
                message: "Access restricted to admins only",
                code: 'ADMIN_ONLY',
                debug: process.env.NODE_ENV === 'development' ? { role: decoded.role } : undefined
            });
        }

        // Ensure organizationId is available (e.g. for delete employee / multi-tenant queries)
        if (!decoded.organizationId) {
            try {
                const user = await User.findById(decoded.userId).select('organizationId').lean();
                if (user?.organizationId) {
                    decoded.organizationId = user.organizationId;
                }
            } catch (err) {
                logger.warn('Failed to load admin organizationId', { error: err.message });
            }
        }

        // Attach user to request
        attachUserToRequest(req, decoded);

        next();
    } catch (error) {
        logger.error("Admin Auth Middleware Error", { error: error.message, stack: error.stack });
        return res.status(500).json({ 
            success: false,
            message: "Server authentication error",
            code: 'SERVER_ERROR'
        });
    }
};

export default isAdminAuthenticated;
