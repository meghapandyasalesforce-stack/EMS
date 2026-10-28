/**
 * SaaS platform operator authentication (control panel).
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
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
import { createEmailTransporter, getEmailFrom } from '../../config/email.config.js';
import { queueSentMailboxCopy } from '../../helpers/emailSentMailboxHelper.js';
import logger from '../../helpers/logger.js';

const GENERIC_RESET_MESSAGE =
    'If a platform operator account exists for this email, you will receive a password reset link shortly. Check your inbox and spam folder.';
const EMAIL_SENT_MESSAGE =
    'Password reset link sent. Check your inbox and spam folder. The link expires in 15 minutes.';

const maskEmail = (email = '') => {
    const normalized = String(email || '').trim().toLowerCase();
    const [local = '', domain = ''] = normalized.split('@');
    if (!local || !domain) return 'invalid-email';
    const visible = local.slice(0, 2);
    return `${visible}${'*'.repeat(Math.max(0, local.length - 2))}@${domain}`;
};

const generateResetToken = async () => {
    const resetToken = crypto.randomBytes(20).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const hashedToken = await bcrypt.hash(resetToken, salt);
    return { resetToken, hashedToken };
};

const isPlatformOperatorUser = (user) =>
    Boolean(user && user.role === 'platform' && isPlatformOperatorRoles(user.roles));

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

/**
 * POST /api/v1/platform/auth/forgot-password
 * Sends a reset link only for SaaS platform operators (never HRMS users).
 */
export const platformForgotPassword = asyncHandler(async (req, res) => {
    const requestId = req.id;
    const normalizedEmail = normalizeEmail(req.body?.email);
    const maskedEmail = maskEmail(normalizedEmail);

    if (!normalizedEmail) {
        return sendValidationError(res, { email: 'Please provide a valid email address.' });
    }

    logger.info('Platform forgot password request', { requestId, maskedEmail, ip: req.ip });

    const user = await User.findOne({ email: normalizedEmail });

    if (!isPlatformOperatorUser(user) || !user.isActive) {
        logger.info('Platform forgot password: generic success (no eligible operator)', {
            requestId,
            maskedEmail,
            ip: req.ip,
        });
        return sendSuccess(res, { emailSent: false }, GENERIC_RESET_MESSAGE);
    }

    const { resetToken, hashedToken } = await generateResetToken();
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 1000 * 60 * 15;
    await user.save();

    let transporter;
    let emailFrom;
    try {
        transporter = createEmailTransporter();
        emailFrom = getEmailFrom();
        if (!emailFrom) {
            return res.status(500).json({
                success: false,
                message: 'Email service not configured. Please contact administrator.',
            });
        }
    } catch (emailConfigError) {
        logger.error('Platform forgot password email config error', {
            requestId,
            error: emailConfigError.message,
        });
        return res.status(500).json({
            success: false,
            message: 'Email service not configured. Please contact administrator.',
        });
    }

    const resetUrl = `${process.env.FRONTEND_URL}/platform/reset-password/${resetToken}`;
    const resetMailOptions = {
        from: emailFrom,
        to: user.email,
        subject: 'Password Reset — Paarsiv Platform Control Panel',
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head><meta charset="UTF-8"><title>Platform Password Reset</title></head>
        <body style="font-family:Arial,sans-serif;background:#f5faf9;margin:0;padding:24px;color:#0F2D26;">
          <div style="max-width:560px;margin:0 auto;background:#ffffff;padding:28px;border-radius:16px;border:1px solid #D1DCD8;">
            <h2 style="margin:0 0 12px;color:#2A6B52;">Operator password reset</h2>
            <p style="line-height:1.6;color:#5A7A70;">Hello <strong>${user.name || 'Operator'}</strong>,</p>
            <p style="line-height:1.6;color:#5A7A70;">
              You requested a password reset for your Paarsiv Platform Control Panel account.
              Click the button below to set a new password:
            </p>
            <p style="text-align:center;margin:28px 0;">
              <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#2A6B52;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">
                Reset Password
              </a>
            </p>
            <p style="font-size:12px;word-break:break-all;color:#788882;background:#ECF0EE;padding:12px;border-radius:8px;">${resetUrl}</p>
            <p style="line-height:1.6;color:#5A7A70;font-size:14px;">
              This link expires in <strong>15 minutes</strong>. If you did not request this, you can ignore this email.
            </p>
          </div>
        </body>
        </html>
      `,
    };

    await transporter.sendMail(resetMailOptions);
    queueSentMailboxCopy(resetMailOptions);

    logger.info('Platform forgot password email sent', { requestId, maskedEmail, ip: req.ip });
    return sendSuccess(res, { emailSent: true }, EMAIL_SENT_MESSAGE);
});

/**
 * POST /api/v1/platform/auth/reset-password/:token
 */
export const platformResetPassword = asyncHandler(async (req, res) => {
    const requestId = req.id;
    const resetToken = req.params.token;
    const password = req.body?.password;

    if (!resetToken) {
        return sendValidationError(res, { token: 'Reset token is required' });
    }
    if (!password || String(password).length < 8) {
        return sendValidationError(res, { password: 'Password must be at least 8 characters long.' });
    }

    const candidates = await User.find({
        role: 'platform',
        resetPasswordToken: { $exists: true, $ne: null },
        resetPasswordExpire: { $gt: Date.now() },
    });

    let user = null;
    for (const candidate of candidates) {
        if (!isPlatformOperatorUser(candidate)) continue;
        if (await bcrypt.compare(resetToken, candidate.resetPasswordToken)) {
            user = candidate;
            break;
        }
    }

    if (!user) {
        logger.warn('Platform reset password: invalid or expired token', {
            requestId,
            tokenPrefix: String(resetToken).slice(0, 8),
            ip: req.ip,
        });
        return res.status(400).json({
            success: false,
            message: 'Invalid or expired token. Please request a new password reset.',
        });
    }

    // Model pre-save hook hashes password — do not hash here.
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    await clearAuthCookies(res, req);

    logger.info('Platform password reset completed', {
        requestId,
        userId: user._id,
        email: maskEmail(user.email),
        ip: req.ip,
    });

    return sendSuccess(
        res,
        null,
        'Password reset successful. You can now sign in to the Platform Control Panel.'
    );
});
