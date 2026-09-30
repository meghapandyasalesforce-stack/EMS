/**
 * SaaS platform operator authentication (control panel).
 */

import asyncHandler from '../../helpers/asyncHandler.js';
import User from '../../models/user.model.js';
import { generateToken } from '../../helpers/utils.js';
import { sendSuccess, sendUnauthorized, sendForbidden, sendValidationError } from '../../helpers/responseHelper.js';
import {
    normalizeEmail,
    isAccountLocked,
    handleFailedLogin,
    resetLoginAttempts,
    getLockoutMessage,
    clearAuthCookies,
} from '../../helpers/authHelpers.js';
import {
    SAAS_OPERATOR_ROLES,
    isPlatformOperatorRoles,
    resolveOperatorPermissions,
} from '../../config/identity.constants.js';
import logger from '../../helpers/logger.js';

/**
 * POST /api/v1/platform/auth/login
 */
export const platformLogin = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const requestId = req.id;

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return sendValidationError(res, { email: 'Invalid email format' });
    }
    if (!password) {
        return sendValidationError(res, { password: 'Password is required' });
    }

    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user || !isPlatformOperatorRoles(user.roles) || user.role !== 'platform') {
        logger.warn('Platform login failed: not an operator', { requestId, email: normalizedEmail });
        return sendUnauthorized(res, 'Invalid email or password');
    }

    if (isAccountLocked(user)) {
        return sendForbidden(res, getLockoutMessage(user));
    }

    if (!user.isActive) {
        return sendForbidden(res, 'Your account is inactive. Please contact administrator.');
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        await handleFailedLogin(user);
        return sendUnauthorized(res, 'Invalid email or password');
    }

    await resetLoginAttempts(user);

    const passwordChangedAt = user.passwordChangedAt || null;
    const tokenResult = generateToken(
        user._id,
        'platform',
        null,
        res,
        passwordChangedAt,
        { platformRoles: [SAAS_OPERATOR_ROLES.PLATFORM_OPERATOR] }
    );
    const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
    const refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
    const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

    logger.info('Platform login successful', { requestId, userId: user._id, email: normalizedEmail });

    return sendSuccess(res, {
        token,
        refreshToken,
        csrfToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: 'platform',
            roles: user.roles,
            permissions: resolveOperatorPermissions(user.roles || []),
        },
        dashboardRoute: '/platform',
    }, 'Login successful');
});

/**
 * GET /api/v1/platform/auth/me
 */
export const platformMe = asyncHandler(async (req, res) => {
    const op = req.platformOperator;
    return sendSuccess(res, {
        user: {
            id: op._id,
            name: op.name,
            email: op.email,
            role: 'platform',
            roles: op.roles,
            permissions: op.permissions || resolveOperatorPermissions(op.roles || []),
        },
    });
});

/**
 * POST /api/v1/platform/auth/logout
 */
export const platformLogout = asyncHandler(async (req, res) => {
    await clearAuthCookies(res, req);
    return sendSuccess(res, null, 'Logout successful');
});
