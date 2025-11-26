import jwt from "jsonwebtoken";
import logger from "../helpers/logger.js";

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
    const userData = {
        _id: decoded.userId,
        role: decoded.role || 'employee',
        organizationId: decoded.organizationId || null
    };
    
    if (decoded.role === 'admin') {
        req.user = userData;
    } else {
        req.employee = userData;
    }
    
    // Also set organizationId on request for easy access
    req.organizationId = decoded.organizationId || null;
};

