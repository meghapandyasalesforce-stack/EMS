import Organization from "../../models/organization.model.js";
import User from "../../models/user.model.js";
import { sendSuccess, sendError } from "../../helpers/responseHelper.js";
import { isTokenValid } from "../../helpers/emailVerification.js";
import { sendVerificationReminder } from "../../helpers/organizationEmail.js";
import logger from "../../helpers/logger.js";

/**
 * Verify organization email
 * @route GET /api/v1/organization/auth/verify-email
 * @access Public
 */
export const verifyOrganizationEmail = async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return sendError(res, 'Verification token is required', 400, 'MISSING_TOKEN');
        }

        // Find organization with this token
        const organization = await Organization.findOne({ 
            emailVerificationToken: token 
        });

        if (!organization) {
            return sendError(res, 'Invalid or expired verification token', 400, 'INVALID_TOKEN');
        }

        // Check if token is expired
        if (!isTokenValid(organization.emailVerificationExpires)) {
            return sendError(res, 'Verification token has expired. Please request a new one.', 400, 'TOKEN_EXPIRED');
        }

        // Check if already verified
        if (organization.emailVerified) {
            return sendSuccess(res, {
                message: 'Email is already verified',
                organization: {
                    id: organization._id,
                    name: organization.name,
                    emailVerified: true
                }
            });
        }

        // Verify email
        organization.emailVerified = true;
        organization.emailVerificationToken = undefined;
        organization.emailVerificationExpires = undefined;
        await organization.save();

        // Also verify admin user email if it matches
        const adminUser = await User.findOne({ 
            email: organization.email,
            organizationId: organization._id,
            role: 'admin'
        });

        if (adminUser && !adminUser.emailVerified) {
            adminUser.emailVerified = true;
            adminUser.emailVerificationToken = undefined;
            adminUser.emailVerificationExpires = undefined;
            await adminUser.save();
        }

        logger.info('Organization email verified', { 
            organizationId: organization._id,
            email: organization.email
        });

        return sendSuccess(res, {
            message: 'Email verified successfully',
            organization: {
                id: organization._id,
                name: organization.name,
                emailVerified: true
            }
        });

    } catch (error) {
        logger.error('Email verification error', { 
            error: error.message,
            stack: error.stack
        });
        return sendError(res, error.message || 'Failed to verify email', 500);
    }
};

/**
 * Resend verification email
 * @route POST /api/v1/organization/auth/resend-verification
 * @access Public
 */
export const resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        if (!email) {
            return sendError(res, 'Email is required', 400, 'MISSING_EMAIL');
        }

        const organization = await Organization.findOne({ 
            email: email.toLowerCase().trim() 
        });

        if (!organization) {
            // Don't reveal if email exists for security
            return sendSuccess(res, {
                message: 'If the email exists, a verification link has been sent'
            });
        }

        // Check if already verified
        if (organization.emailVerified) {
            return sendSuccess(res, {
                message: 'Email is already verified'
            });
        }

        // Generate new verification token
        const { generateVerificationTokenWithExpiry } = await import('../../helpers/emailVerification.js');
        const tokenData = generateVerificationTokenWithExpiry(24);
        const verificationToken = tokenData.token;
        const verificationExpires = tokenData.expires;

        organization.emailVerificationToken = verificationToken;
        organization.emailVerificationExpires = verificationExpires;
        await organization.save();

        // Send verification email
        try {
            const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
            await sendVerificationReminder(
                organization.email,
                organization.name,
                verificationToken,
                baseUrl
            );
            logger.info('Verification email resent', { email: organization.email });
        } catch (emailError) {
            logger.error('Failed to send verification email', { 
                error: emailError.message,
                email: organization.email
            });
            return sendError(res, 'Failed to send verification email', 500);
        }

        return sendSuccess(res, {
            message: 'Verification email sent successfully'
        });

    } catch (error) {
        logger.error('Resend verification error', { 
            error: error.message,
            stack: error.stack
        });
        return sendError(res, error.message || 'Failed to resend verification email', 500);
    }
};

