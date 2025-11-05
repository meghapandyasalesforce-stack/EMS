import nodemailer from 'nodemailer';
import crypto from 'crypto';
import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import bcrypt from 'bcryptjs';
import logger from '../../helpers/logger.js';

// Helper function to generate reset token
const generateResetToken = () => {
  const resetToken = crypto.randomBytes(20).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, hashedToken };
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Case-insensitive email search - check both Employee and User (Admin) collections
    let user = await Employee.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });
    
    let userType = 'employee';
    
    // If not found in Employee, check User (Admin) collection
    if (!user) {
      user = await User.findOne({ 
        email: { $regex: new RegExp(`^${email}$`, 'i') }
      });
      userType = 'admin';
    }

    // Always return same message to prevent email enumeration
    // Don't reveal whether email exists or not
    if (!user) {
      // Return success to prevent email enumeration attacks
      // Still return 200 but don't send email
      return res.status(200).json({ 
        message: 'If the email exists, a password reset link has been sent.' 
      });
    }

    // Check if there's already a valid reset token (prevent spam)
    if (user.resetPasswordToken && user.resetPasswordExpire > Date.now()) {
      // Don't create new token if one already exists and is valid
      // Return success to prevent information leakage
      return res.status(200).json({ 
        message: 'If the email exists, a password reset link has been sent.' 
      });
    }

    const { resetToken, hashedToken } = generateResetToken();
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpire = Date.now() + 1000 * 60 * 15; // 15 mins
    await user.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Email configuration - support both Gmail and Outlook/Office 365
    const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
    const emailPort = process.env.EMAIL_PORT || 587;
    const isOutlook = emailHost.includes('office365.com') || emailHost.includes('outlook.com');
    
    // Validate email credentials are configured
    const emailUser = process.env.EMAIL_USERNAME || process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS;
    
    if (!emailUser || !emailPass) {
      return res.status(500).json({ 
        message: 'Email service not configured. Please contact administrator.' 
      });
    }
    
    const transporter = nodemailer.createTransport({
      host: isOutlook ? emailHost : undefined,
      port: isOutlook ? emailPort : undefined,
      secure: false, // true for 465, false for other ports (587 uses STARTTLS)
      requireTLS: isOutlook ? true : false, // Outlook requires STARTTLS
      service: isOutlook ? undefined : (process.env.EMAIL_SERVICE || 'Gmail'),
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: isOutlook ? {
        // Only disable certificate validation in development
        // In production, always validate certificates to prevent MITM attacks
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      } : undefined
    });

    const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || process.env.EMAIL_USER;
    
    if (!emailFrom) {
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

    res.status(200).json({ message: 'Reset link sent to your email' });
  } catch (error) {
    logger.error('Forgot password error', { error: error.message, stack: error.stack });
    res.status(500).json({ message: 'Error processing request', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    // Check both Employee and User (Admin) collections for the reset token
    let user = await Employee.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });
    
    let userType = 'employee';
    
    // If not found in Employee, check User (Admin) collection
    if (!user) {
      user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() },
      });
      userType = 'admin';
    }

    if (!user) {
      return res.status(400).json({ 
        message: 'Invalid or expired token. Please request a new password reset.' 
      });
    }

    // Hash new password before saving
    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(req.body.password, salt);
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