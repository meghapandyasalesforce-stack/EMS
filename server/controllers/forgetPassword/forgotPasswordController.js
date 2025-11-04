import nodemailer from 'nodemailer';
import crypto from 'crypto';
import Employee from '../../models/employee.model.js';
import bcrypt from 'bcryptjs';

// Helper function to generate reset token
const generateResetToken = () => {
  const resetToken = crypto.randomBytes(20).toString('hex');
  const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
  return { resetToken, hashedToken };
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    
    // Case-insensitive email search
    const employee = await Employee.findOne({ 
      email: { $regex: new RegExp(`^${email}$`, 'i') }
    });

    if (!employee) {
      return res.status(404).json({ message: 'Employee not found' });
    }

    const { resetToken, hashedToken } = generateResetToken();
    
    employee.resetPasswordToken = hashedToken;
    employee.resetPasswordExpire = Date.now() + 1000 * 60 * 15; // 15 mins
    await employee.save();

    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Email configuration - support both Gmail and Outlook/Office 365
    const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
    const emailPort = process.env.EMAIL_PORT || 587;
    const isOutlook = emailHost.includes('office365.com') || emailHost.includes('outlook.com');
    
    const transporter = nodemailer.createTransport({
      host: isOutlook ? emailHost : undefined,
      port: isOutlook ? emailPort : undefined,
      secure: false, // true for 465, false for other ports (587 uses STARTTLS)
      requireTLS: isOutlook ? true : false, // Outlook requires STARTTLS
      service: isOutlook ? undefined : (process.env.EMAIL_SERVICE || 'Gmail'),
      auth: {
        user: process.env.EMAIL_USERNAME || process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD || process.env.EMAIL_PASS,
      },
      tls: isOutlook ? {
        rejectUnauthorized: false // Allow self-signed certificates if needed
      } : undefined
    });

    await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.EMAIL_USERNAME || process.env.EMAIL_USER || 'kunal.pareek@Paarsiv.com',
      to: employee.email,
      subject: 'Password Reset Request',
      html: `
        <p>Hello ${employee.name},</p>
        <p>You requested a password reset. Click the link below to proceed:</p>
        <a href="${resetUrl}">Reset Password</a>
        <p>This link will expire in 15 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    res.status(200).json({ message: 'Reset link sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'Error processing request', error: error.message });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const hashedToken = crypto.createHash('sha256')
      .update(req.params.token)
      .digest('hex');

    const employee = await Employee.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!employee) {
      return res.status(400).json({ 
        message: 'Invalid or expired token. Please request a new password reset.' 
      });
    }

    // Hash new password before saving
    const salt = await bcrypt.genSalt(10);
    employee.password = await bcrypt.hash(req.body.password, salt);
    employee.resetPasswordToken = undefined;
    employee.resetPasswordExpire = undefined;
    employee.mustResetPassword = false; // Reset the forced password change flag
    await employee.save();

    res.status(200).json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'Error resetting password', error: error.message });
  }
};