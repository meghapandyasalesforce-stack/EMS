import logger from './logger.js';
import { createEmailTransporter, getEmailFrom, detectEmailProvider, getEmailConfig } from '../config/email.config.js';

/**
 * Send welcome email to new user
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string|null} password - Plain text password (for development only)
 * @param {string|null} resetUrl - Password reset URL (for production)
 * @returns {Promise<void>}
 */
const sendWelcomeEmail = async (email, name, password = null, resetUrl = null) => {
  // Get email configuration and create transporter
  const emailConfig = getEmailConfig();
  const transporter = createEmailTransporter();
  const provider = detectEmailProvider(emailConfig);

  // Email options
  // SECURITY: In production, use password reset link instead of plain text password
  const displayPassword = password;
  const useResetLink = !password && resetUrl;
  
  const emailFrom = getEmailFrom();
  
  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured. Please set EMAIL_FROM environment variable.');
  }

  // Store provider info for error handling
  const providerInfo = {
    isGmail: provider.isGmail,
    isOutlook: provider.isOutlook,
    emailHost: provider.isGmail ? 'gmail (service)' : emailConfig.host,
    emailPort: provider.isGmail ? 'N/A (service)' : emailConfig.port
  };

  const mailOptions = {
    from: emailFrom,
    to: email,
    subject: 'Welcome to Paarsiv HR System!',
    html: `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Welcome to Paarsiv</title>
  <style>
    body {
      font-family: Arial, sans-serif;
      background-color: #1e1e2f;
      margin: 0;
      padding: 0;
      color: #e0e0e0;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      background-color: #2b2b3c;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.4);
    }
    .header {
      text-align: center;
      color: #7c9eff;
    }
    .message {
      font-size: 16px;
      color: #dddddd;
      line-height: 1.6;
    }
    .password-box {
      background-color: #383850;
      padding: 14px;
      font-weight: bold;
      font-size: 18px;
      color: #ff6e91;
      text-align: center;
      border-radius: 6px;
      margin: 20px 0;
    }
    .footer {
      font-size: 14px;
      color: #888888;
      text-align: center;
      margin-top: 30px;
    }
    a {
      color: #9dc1ff;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <h2 class="header">Welcome to Paarsiv!</h2>
    <p class="message">
      Hello, ${name}!
    </p>
    <p class="message">
      Your account has been successfully created by the Paarsiv Admin Team. You are now part of our employee network.
    </p>
    ${useResetLink ? `
    <p class="message">
      Click the link below to set your password and activate your account:
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${resetUrl}" style="background-color: #7c9eff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; font-weight: bold;">Set Your Password</a>
    </div>
    <p class="message">
      <strong>Security Notice:</strong> This link will expire in 24 hours. Please set your password immediately.
    </p>
    ` : `
    <p class="message">
      Use the default password below to log in for the first time:
    </p>
    <div class="password-box">${displayPassword}</div>
    <p class="message">
      <strong>Security Notice:</strong> Please reset your password immediately after your first login to ensure account safety.
    </p>
    `}
    <p class="message">
      Need help? Contact your administrator or reach out to <a href="mailto:support@paarsiv.com">support@paarsiv.com</a>.
    </p>
    <div class="footer">
      &copy; 2025 Paarsiv. All rights reserved.
    </div>
  </div>
</body>
</html>


    `,
  };

  // Send email
  try {
    // Verify transporter configuration before sending
    logger.info('Verifying email transporter configuration...', { 
      provider: providerInfo.isGmail ? 'Gmail' : providerInfo.isOutlook ? 'Outlook' : 'Generic SMTP',
      emailHost: providerInfo.emailHost,
      emailPort: providerInfo.emailPort
    });
    
    await transporter.verify();
    logger.info('Email transporter verified successfully');
    
    // Send the email
    logger.info('Sending welcome email...', { to: email });
    const info = await transporter.sendMail(mailOptions);
    logger.info('Welcome email sent successfully', { 
      email, 
      messageId: info.messageId,
      response: info.response 
    });
  } catch (error) {                              
    // Log detailed error information for debugging
    logger.error('Error sending welcome email', { 
      email, 
      emailHost: providerInfo.emailHost,
      emailPort: providerInfo.emailPort,
      provider: providerInfo.isGmail ? 'Gmail' : providerInfo.isOutlook ? 'Outlook' : 'Generic SMTP',
      error: error.message,
      errorCode: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      syscall: error.syscall,
      address: error.address,
      port: error.port,
      stack: error.stack 
    });
    
    // Provide more user-friendly error messages with specific guidance
    let errorMessage = 'Failed to send welcome email';
    let troubleshooting = '';
    
    if (error.code === 'EAUTH' || error.responseCode === 535) {
      // Check for specific Outlook SMTP AUTH disabled error
      if (error.message && error.message.includes('SmtpClientAuthentication is disabled')) {
        errorMessage = 'SMTP authentication is disabled for your Office 365 tenant.';
        troubleshooting = ' You need to enable SMTP AUTH in your Office 365 admin center. See OUTLOOK_SMTP_FIX.md for detailed instructions. Quick fix: Go to https://admin.microsoft.com → Exchange Admin Center → Settings → Enable "Authenticated SMTP"';
      } else if (providerInfo.isGmail) {
        errorMessage = 'Email authentication failed. Please check email credentials.';
        troubleshooting = ' For Gmail, you must use an App Password, not your regular password. Generate one at: https://myaccount.google.com/apppasswords';
      } else {
        errorMessage = 'Email authentication failed. Please check email credentials.';
        troubleshooting = ' Please verify your email and password are correct. If using Outlook/Office 365, ensure SMTP AUTH is enabled for your account.';
      }
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Email server connection failed. Please check email server configuration.';
      troubleshooting = ` Could not connect to ${providerInfo.emailHost}${providerInfo.emailPort !== 'N/A (service)' ? ':' + providerInfo.emailPort : ''}. Check if the host and port are correct, and ensure your firewall/network allows SMTP connections.`;
    } else if (error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection timed out.';
      troubleshooting = ` Connection to ${providerInfo.emailHost}${providerInfo.emailPort !== 'N/A (service)' ? ':' + providerInfo.emailPort : ''} timed out. Check your network connection and firewall settings.`;
    } else if (error.code === 'ENOTFOUND') {
      errorMessage = 'Email server host not found.';
      troubleshooting = ` Could not resolve hostname: ${emailHost}. Please check EMAIL_HOST environment variable.`;
    } else if (error.message) {
      errorMessage = `Email sending failed: ${error.message}`;
      troubleshooting = ' Check server logs for more details.';
    }
    
    // Re-throw error with improved message
    const enhancedError = new Error(errorMessage + troubleshooting);
    enhancedError.originalError = error;
    enhancedError.code = error.code;
    enhancedError.responseCode = error.responseCode;
    throw enhancedError;
  }
};

/**
 * Send password reset email
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string} resetUrl - Password reset URL
 * @returns {Promise<void>}
 */
export const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const emailConfig = getEmailConfig();
  const transporter = createEmailTransporter();
  const emailFrom = getEmailFrom();
  
  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured');
  }

  const mailOptions = {
    from: emailFrom,
    to: email,
    subject: 'Password Reset Request - Paarsiv HR System',
    html: `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Password Reset</title>
      <style>
        body { font-family: Arial, sans-serif; background-color: #1e1e2f; margin: 0; padding: 0; color: #e0e0e0; }
        .container { max-width: 600px; margin: 40px auto; background-color: #2b2b3c; padding: 30px; border-radius: 10px; }
        .header { text-align: center; color: #7c9eff; }
        .message { font-size: 16px; color: #dddddd; line-height: 1.6; }
        .button { background-color: #7c9eff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; }
        .footer { font-size: 14px; color: #888888; text-align: center; margin-top: 30px; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2 class="header">Password Reset Request</h2>
        <p class="message">Hello ${name},</p>
        <p class="message">You requested to reset your password. Click the button below to reset it:</p>
        <div style="text-align: center; margin: 20px 0;">
          <a href="${resetUrl}" class="button">Reset Password</a>
        </div>
        <p class="message"><strong>Note:</strong> This link will expire in 1 hour.</p>
        <div class="footer">&copy; 2025 Paarsiv. All rights reserved.</div>
      </div>
    </body>
    </html>
    `
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Password reset email sent', { email, messageId: info.messageId });
  } catch (error) {
    logger.error('Error sending password reset email', { email, error: error.message });
    throw error;
  }
};

/**
 * Send notification email
 * @param {string} email - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} message - Email message
 * @param {string} html - HTML content
 * @returns {Promise<void>}
 */
export const sendNotificationEmail = async (email, subject, message, html) => {
  const emailConfig = getEmailConfig();
  const transporter = createEmailTransporter();
  const emailFrom = getEmailFrom();
  
  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured');
  }

  const mailOptions = {
    from: emailFrom,
    to: email,
    subject: subject || 'Notification from Paarsiv HR System',
    text: message,
    html: html || `<p>${message}</p>`
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Notification email sent', { email, messageId: info.messageId });
  } catch (error) {
    logger.error('Error sending notification email', { email, error: error.message });
    throw error;
  }
};

export default sendWelcomeEmail;