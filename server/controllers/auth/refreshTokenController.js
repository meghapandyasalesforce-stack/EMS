import jwt from "jsonwebtoken";
import Employee from "../../models/employee.model.js";
import User from "../../models/user.model.js";
import { generateToken } from "../../helpers/utils.js";
import { sendSuccess, sendError, sendUnauthorized } from "../../helpers/responseHelper.js";
import logger from "../../helpers/logger.js";

/**
 * Refresh access token using refresh token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
export const refreshToken = async (req, res) => {
    try {
        // Get refresh token from cookie or Authorization header
        let refreshToken = req.cookies?.refreshToken;
        
        if (!refreshToken && req.headers.authorization) {
            const authHeader = req.headers.authorization;
            if (authHeader.startsWith('Bearer ')) {
                refreshToken = authHeader.substring(7);
            }
        }

        if (!refreshToken) {
            return sendUnauthorized(res, 'Refresh token is required');
        }

        // Verify refresh token
        let decoded;
        try {
            decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
            
            // Ensure this is a refresh token
            if (decoded.type !== 'refresh') {
                return sendUnauthorized(res, 'Invalid token type');
            }
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return sendUnauthorized(res, 'Refresh token has expired. Please login again.');
            }
            if (error.name === 'JsonWebTokenError') {
                return sendUnauthorized(res, 'Invalid refresh token');
            }
            throw error;
        }

        // Find user (check both Employee and User collections)
        let user = await Employee.findById(decoded.userId);
        let userType = 'employee';
        
        if (!user) {
            user = await User.findById(decoded.userId);
            userType = 'admin';
        }

        if (!user) {
            return sendUnauthorized(res, 'User not found');
        }

        // Check if user is active
        const isActive = user.active !== undefined ? user.active : user.isActive;
        if (!isActive) {
            return sendError(res, 'Account is inactive', 403, 'ACCOUNT_INACTIVE');
        }

        // Generate new access token
        const role = decoded.role || userType;
        const tokenResult = generateToken(user._id, role, res);
        const accessToken = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
        const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

        const response = {
            success: true,
            message: 'Token refreshed successfully',
            token: accessToken
        };

        if (csrfToken) {
            response.csrfToken = csrfToken;
        }

        return sendSuccess(res, response, 'Token refreshed successfully');
    } catch (error) {
        logger.error('Refresh token error', { error: error.message, stack: error.stack });
        return sendError(res, 'Failed to refresh token', 500, 'REFRESH_ERROR');
    }
};

