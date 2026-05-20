import crypto from 'crypto';
import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import bcrypt from 'bcryptjs';
import logger from '../../helpers/logger.js';
import { normalizeEmail } from '../../helpers/authHelpers.js';
import { createEmailTransporter, getEmailFrom } from '../../config/email.config.js';

const GENERIC_RESET_MESSAGE =
  'If an account exists for this email, you will receive a password reset link shortly. Check your inbox and spam folder.';
const EMAIL_SENT_MESSAGE =
  'Password reset link sent. Check your inbox and spam folder. The link expires in 15 minutes.';

const maskEmail = (email = '') => {
  const normalized = String(email || '').trim().toLowerCase();
  const [local = '', domain = ''] = normalized.split('@');
  if (!local || !domain) return 'invalid-email';
  const visible = local.slice(0, 2);
  return `${visible}${'*'.repeat(Math.max(0, local.length - 2))}@${domain}`;
};

// Helper function to generate reset token
// SECURITY: Use bcrypt to hash tokens instead of SHA-256 to prevent brute force attacks
const generateResetToken = async () => {
  const resetToken = crypto.randomBytes(20).toString('hex');
  // Use bcrypt to hash the token (slower, more secure against brute force)
  const salt = await bcrypt.genSalt(10);
  const hashedToken = await bcrypt.hash(resetToken, salt);
  return { resetToken, hashedToken };
};

export const forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const maskedEmail = maskEmail(normalizedEmail);
    logger.info('Forgot password request received', {
      maskedEmail,
      ip: req.ip
    });

    if (!normalizedEmail) {
      logger.warn('Forgot password rejected: invalid email format', {
        maskedEmail,
        ip: req.ip
      });
      return res.status(400).json({
        message: 'Please provide a valid email address.',
        emailSent: false,
      });
    }

    // Employees store email lowercase; admins use the same convention
    let user = await Employee.findOne({ email: normalizedEmail });
    let userType = 'employee';

    if (!user) {
      user = await User.findOne({ email: normalizedEmail });
      userType = 'admin';
    }

    if (!user) {
      logger.info('Forgot password handled with generic success (user not found)', {
        maskedEmail,
        ip: req.ip
      });
      return res.status(200).json({
        message: GENERIC_RESET_MESSAGE,
        emailSent: false,
      });
    }

    const { resetToken, hashedToken } = await generateResetToken();
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 1000 * 60 * 15; // 15 mins
    await user.save();
    logger.info('Forgot password token created', {
      maskedEmail,
      userType,
      expiresAt: new Date(user.resetPasswordExpire).toISOString(),
      ip: req.ip
    });

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Create email transporter using centralized config
    let transporter;
    let emailFrom;
    try {
      transporter = createEmailTransporter();
      emailFrom = getEmailFrom();
      
      if (!emailFrom) {
        return res.status(500).json({ 
          message: 'Email service not configured. Please contact administrator.' 
        });
      }
    } catch (emailConfigError) {
      logger.error('Email configuration error in password reset', { error: emailConfigError.message });
      return res.status(500).json({ 
        message: 'Email service not configured. Please contact administrator.' 
      });
    }

    await transporter.sendMail({
      from: emailFrom,
      to: user.email,
      subject: 'Password Reset Request - Paarsiv HR System',
      html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <title>Password Reset Request</title>
          <style>
            body {
              font-family: Arial, sans-serif;
              background-color: #f4f4f4;
              margin: 0;
              padding: 0;
              color: #333333;
            }
            .container {
              max-width: 600px;
              margin: 40px auto;
              background-color: #ffffff;
              padding: 30px;
              border-radius: 10px;
              box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }
            .header {
              text-align: center;
              color: #7c9eff;
              margin-bottom: 20px;
            }
            .message {
              font-size: 16px;
              color: #555555;
              line-height: 1.6;
              margin-bottom: 20px;
            }
            .button-container {
              text-align: center;
              margin: 30px 0;
            }
            .reset-button {
              display: inline-block;
              padding: 14px 30px;
              background-color: #7c9eff;
              color: #ffffff;
              text-decoration: none;
              border-radius: 6px;
              font-weight: bold;
              font-size: 16px;
            }
            .reset-button:hover {
              background-color: #6b8eef;
            }
            .url-box {
              background-color: #f8f9fa;
              padding: 14px;
              font-size: 12px;
              color: #666666;
              text-align: center;
              border-radius: 6px;
              margin: 20px 0;
              word-break: break-all;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 12px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .footer {
              font-size: 14px;
              color: #888888;
              text-align: center;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #eeeeee;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h2 class="header">Password Reset Request</h2>
            <p class="message">
              Hello <strong>${user.name}</strong>,
            </p>
            <p class="message">
              You requested a password reset for your Paarsiv HR System account. Click the button below to reset your password:
            </p>
            <div class="button-container">
              <a href="${resetUrl}" class="reset-button">Reset Password</a>
            </div>
            <p class="message">
              Or copy and paste this URL into your browser:
            </p>
            <div class="url-box">${resetUrl}</div>
            <div class="warning">
              <strong>⚠️ Important:</strong> This link will expire in <strong>15 minutes</strong>. If you didn't request this password reset, please ignore this email and your password will remain unchanged.
            </div>
            <p class="message">
              For security reasons, if you continue to receive password reset emails you didn't request, please contact your administrator immediately.
            </p>
            <div class="footer">
              <p>&copy; 2025 Paarsiv. All rights reserved.</p>
              <p>This is an automated message. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
      `,
    });
    logger.info('Forgot password email sent', {
      maskedEmail,
      userType,
      ip: req.ip
    });

    res.status(200).json({
      message: EMAIL_SENT_MESSAGE,
      emailSent: true,
    });
  } catch (error) {
    logger.error('Forgot password error', {
      error: error.message,
      stack: error.stack,
      maskedEmail: maskEmail(req.body?.email),
      ip: req.ip
    });
    res.status(500).json({ message: 'Error processing request', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const resetToken = req.params.token;
    logger.info('Reset password request received', {
      tokenPrefix: String(resetToken || '').slice(0, 8),
      ip: req.ip
    });

    // SECURITY: Find users with valid (non-expired) reset tokens
    // We need to check all users and compare tokens using bcrypt.compare
    // This is necessary because we're using bcrypt hashing (not SHA-256)
    
    // First, find all employees with non-expired reset tokens
    const employees = await Employee.find({
      resetPasswordToken: { $exists: true, $ne: null },
      resetPasswordExpire: { $gt: Date.now() },
    });
    
    // Then, find all admins with non-expired reset tokens
    const admins = await User.find({
      resetPasswordToken: { $exists: true, $ne: null },
      resetPasswordExpire: { $gt: Date.now() },
    });
    
    // Try to find matching user by comparing tokens
    let user = null;
    let userType = null;
    
    // Check employees first
    for (const employee of employees) {
      if (await bcrypt.compare(resetToken, employee.resetPasswordToken)) {
        user = employee;
        userType = 'employee';
        break;
      }
    }
    
    // If not found, check admins
    if (!user) {
      for (const admin of admins) {
        if (await bcrypt.compare(resetToken, admin.resetPasswordToken)) {
          user = admin;
          userType = 'admin';
          break;
        }
      }
    }

    if (!user) {
      logger.warn('Reset password rejected: invalid or expired token', {
        tokenPrefix: String(resetToken || '').slice(0, 8),
        ip: req.ip
      });
      return res.status(400).json({ 
        message: 'Invalid or expired token. Please request a new password reset.' 
      });
    }

    // Validate password strength
    if (!req.body.password || req.body.password.length < 8) {
      logger.warn('Reset password rejected: weak password', {
        userType,
        userEmail: user?.email,
        ip: req.ip
      });
      return res.status(400).json({ 
        message: 'Password must be at least 8 characters long.' 
      });
    }

    // IMPORTANT: Do NOT bcrypt-hash here.
    // Employee/User models already hash `password` in their `pre('save')` hooks.
    // If we hash again here, the stored password becomes double-hashed and login will fail.
    user.password = req.body.password;
    // Invalidate reset token immediately after use (prevents reuse)
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    // Only set mustResetPassword for employees (User model doesn't have this field)
    if (userType === 'employee' && user.mustResetPassword !== undefined) {
      user.mustResetPassword = false; // Reset the forced password change flag
    }
    
    // Save the updated user
    await user.save();
    
    // Additional security: Log password reset event (for audit trail)
    logger.info('Password reset completed', { 
      userEmail: user.email, 
      userType,
      timestamp: new Date().toISOString() 
    });

    // Clear authentication cookies to force logout (in case user is logged in)
    const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
    const cookieOptions = {
        httpOnly: true,
        sameSite: crossSite ? 'none' : 'lax',
        secure: crossSite || process.env.NODE_ENV === 'production',
        path: '/',
    };

    res.clearCookie('jwt', cookieOptions);
    res.clearCookie('csrfToken', {
        httpOnly: false,
        sameSite: cookieOptions.sameSite,
        secure: cookieOptions.secure,
        path: '/',
    });

    res.status(200).json({ 
        message: 'Password has been reset successfully. Please login with your new password.',
        logout: true 
    });
  } catch (error) {
    logger.error('Reset password error', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error resetting password', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};