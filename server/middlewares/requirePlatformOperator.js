/**
 * Auth gate for SaaS platform control-panel APIs.
 * Requires JWT role `platform` and a SaaS operator role.
 */

import {
    extractToken,
    verifyToken,
    handleAuthError,
    verifyPasswordNotChanged,
} from './authHelpers.js';
import User from '../models/user.model.js';
import {
    SAAS_OPERATOR_ROLES,
    isPlatformOperatorRoles,
    resolveOperatorPermissions,
    operatorHasPermission,
} from '../config/identity.constants.js';
import logger from '../helpers/logger.js';

export const requirePlatformOperator = async (req, res, next) => {
    try {
        const token = extractToken(req);
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'User not authenticated',
                code: 'NO_TOKEN',
            });
        }

        let decoded;
        try {
            decoded = verifyToken(token);
        } catch (error) {
            return handleAuthError(error, res);
        }

        if (decoded.role !== 'platform') {
            return res.status(403).json({
                success: false,
                message: 'Platform operator access required',
                code: 'PLATFORM_OPERATOR_REQUIRED',
            });
        }

        const user = await User.findById(decoded.userId)
            .select('name email roles role isActive passwordChangedAt organizationId')
            .lean();

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found',
                code: 'USER_NOT_FOUND',
            });
        }

        if (!user.isActive) {
            return res.status(403).json({
                success: false,
                message: 'User account is inactive',
                code: 'USER_INACTIVE',
            });
        }

        if (!isPlatformOperatorRoles(user.roles) && user.role !== 'platform') {
            return res.status(403).json({
                success: false,
                message: 'Platform operator access required',
                code: 'PLATFORM_OPERATOR_REQUIRED',
            });
        }

        if (!verifyPasswordNotChanged(decoded, user.passwordChangedAt)) {
            return res.status(401).json({
                success: false,
                message: 'Session expired, please log in again',
                code: 'PASSWORD_CHANGED',
            });
        }

        const roles =
            Array.isArray(user.roles) && user.roles.length
                ? user.roles
                : [SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR];
        const permissions = resolveOperatorPermissions(roles);

        req.decoded = decoded;
        req.platformOperator = {
            _id: user._id,
            name: user.name,
            email: user.email,
            roles,
            permissions,
            role: 'platform',
        };
        req.user = {
            _id: user._id,
            role: 'platform',
            organizationId: null,
            platformRoles: roles,
        };
        req.organizationId = undefined;

        return next();
    } catch (error) {
        logger.error('requirePlatformOperator failed', { error: error.message });
        return res.status(500).json({
            success: false,
            message: 'Authentication failed',
            code: 'AUTH_ERROR',
        });
    }
};

/**
 * Require a specific platform permission after requirePlatformOperator.
 */
export const requirePlatformPermission = (permission) => (req, res, next) => {
    const roles = req.platformOperator?.roles || [];
    if (!operatorHasPermission(roles, permission)) {
        return res.status(403).json({
            success: false,
            message: 'Insufficient platform permission',
            code: 'PLATFORM_PERMISSION_DENIED',
            required: permission,
        });
    }
    return next();
};

export default requirePlatformOperator;
