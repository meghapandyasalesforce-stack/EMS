import logger from './logger.js';
import { createEmailTransporter, getEmailFrom, detectEmailProvider, getEmailConfig } from '../config/email.config.js';

const LEAVE_EMAIL_SENDER_NAME = 'Paarsiv Technologies Private Limited';
const REGULARIZATION_EMAIL_SENDER = 'kunalpareekn@gmail.com';
const LOGO_URL_LIGHT = 'https://www.paarsiv.com/wp-content/uploads/2024/08/paarsiv-1.png';
const LOGO_URL_DARK = 'https://www.paarsiv.com/wp-content/uploads/2024/08/paarsiv-white-png-1.png';
const getLeaveEmailFrom = () => {
  const emailFrom = getEmailFrom();
  if (!emailFrom) return null;
  return `"${LEAVE_EMAIL_SENDER_NAME}" <${emailFrom}>`;
};

const getRegularizationEmailFrom = () => {
  return REGULARIZATION_EMAIL_SENDER;
};

const buildLeaveCcList = (ccEmails = [], ...excludeEmails) => {
  const exclude = new Set(excludeEmails.filter(Boolean));
  return [...new Set(ccEmails.filter(email => email && !exclude.has(email)))];
};
/**
 * Send welcome email to new user
 * @param {string} email - Recipient email address
 * @param {string} name - Recipient name
 * @param {string|null} password - Plain text password (for development only)
 * @param {string|null} resetUrl - Password reset URL (for production)
 * @returns {Promise<void>}
 */
export const sendWelcomeEmail = async (email, name, password = null, resetUrl = null) => {
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Paarsiv</title>
  <style>
      body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .password-box {
      background-color: #F8F9FA;
      padding: 20px;
      font-weight: bold;
      font-size: 18px;
      color: #5CC9A7;
      text-align: center;
      border-radius: 8px;
      margin: 20px 0;
      border: 1px solid #E5E7EB;
    }
    .button {
      background-color: #5CC9A7;
      color: #ffffff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      display: inline-block;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #4AB896;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
       <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Welcome to Paarsiv</h1>
    <p class="message">Dear ${name},</p>
    <p class="message">
      Your account has been successfully created by the Paarsiv Admin Team. You are now part of our employee network.
    </p>
    ${useResetLink ? `
    <p class="message">
      Click the button below to set your password and activate your account:
    </p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${resetUrl}" class="button">Set Your Password</a>
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
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">p</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
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
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Password Reset</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .button {
      background-color: #5CC9A7;
      color: #ffffff;
      padding: 14px 28px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: bold;
      display: inline-block;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #4AB896;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
       <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Password Reset Request</h1>
    <p class="message">Dear ${name},</p>
    <p class="message">You requested to reset your password. Click the button below to reset it:</p>
    <div style="text-align: center; margin: 20px 0;">
      <a href="${resetUrl}" class="button">Reset Password</a>
    </div>
    <p class="message"><strong>Note:</strong> This link will expire in 1 hour.</p>
    <div class="footer">
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">p</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
    </div>
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
    html: html || `
    <!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Notification</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Notification</h1>
    <p class="message">${message}</p>
    <div class="footer">
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">p</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>
    `
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

/**
 * Generate attendance regularization request email template
 * @param {Object} data - Regularization and employee data
 * @returns {string} HTML email content
 */
const generateRegularizationRequestEmailTemplate = (data) => {
  const attendanceDate = data.attendanceDate 
    ? new Date(data.attendanceDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) 
    : 'N/A';
  const submittedAt = data.createdAt 
    ? new Date(data.createdAt).toLocaleString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) 
    : 'N/A';
  
  const regularizationTypeMap = {
    'missing_clock_in': 'Missing Clock In',
    'missing_clock_out': 'Missing Clock Out',
    'both': 'Missing Clock In & Clock Out',
    'incorrect_time': 'Incorrect Time',
    'full_day': 'Full Day Regularization'
  };
  
  const regularizationTypeText = regularizationTypeMap[data.regularizationType] || data.regularizationType || 'N/A';
  
  const requestedTimeText = data.regularizationType === 'full_day' 
    ? 'Full day regularization (no specific times)'
    : `${data.requestedClockIn ? new Date(data.requestedClockIn).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'} - ${data.requestedClockOut ? new Date(data.requestedClockOut).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) : 'N/A'}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attendance Regularization Request</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #F8F9FA;
      border-radius: 8px;
      overflow: hidden;
    }
    .info-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-table tr:nth-child(even) {
      background-color: #F1F3F5;
    }
    .info-label {
      font-weight: bold;
      color: #1a1a1a;
      width: 40%;
    }
    .info-value {
      color: #4a4a4a;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 14px;
    }
    .status-pending {
      background-color: #FFF4D6;
      color: #B8860B;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
     <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Attendance Regularization Request</h1>
    <p class="message">Dear Manager,</p>
    <p class="message">${data.employeeName || 'An employee'} has applied for attendance regularization.</p>
    
    <table class="info-table">
      <tr>
        <td class="info-label">Employee Name</td>
        <td class="info-value">${data.employeeName || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Employee ID</td>
        <td class="info-value">${data.employeeId || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Department</td>
        <td class="info-value">${data.department || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Attendance Date</td>
        <td class="info-value">${attendanceDate}</td>
      </tr>
      <tr>
        <td class="info-label">Regularization Type</td>
        <td class="info-value">${regularizationTypeText}</td>
      </tr>
      <tr>
        <td class="info-label">Requested Time</td>
        <td class="info-value">${requestedTimeText}</td>
      </tr>
      <tr>
        <td class="info-label">Reason</td>
        <td class="info-value">${data.reason || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Status</td>
        <td class="info-value"><span class="status-badge status-pending">Pending</span></td>
      </tr>
      <tr>
        <td class="info-label">Submitted Date & Time</td>
        <td class="info-value">${submittedAt}</td>
      </tr>
    </table>
    
    <p class="message">Please review and approve or reject this request.</p>
    
    <div class="footer">
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">p</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Generate attendance regularization approval/rejection email template
 * @param {Object} data - Regularization and employee data
 * @param {string} status - 'approved' or 'rejected'
 * @returns {string} HTML email content
 */
const generateRegularizationEmailTemplate = (data, status) => {
  const attendanceDate = data.attendanceDate 
    ? new Date(data.attendanceDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) 
    : 'N/A';
  
  const regularizationTypeMap = {
    'missing_clock_in': 'Missing Clock In',
    'missing_clock_out': 'Missing Clock Out',
    'both': 'Missing Clock In & Clock Out',
    'incorrect_time': 'Incorrect Time',
    'full_day': 'Full Day Regularization'
  };
  
  const regularizationTypeText = regularizationTypeMap[data.regularizationType] || data.regularizationType || 'N/A';
  const isApproved = status === 'approved';
  const statusText = isApproved ? 'Approved' : 'Rejected';
  const actionDate = isApproved 
    ? (data.approvedAt ? new Date(data.approvedAt).toLocaleString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A')
    : (data.rejectedAt ? new Date(data.rejectedAt).toLocaleString('en-US', { 
        weekday: 'short', 
        year: 'numeric', 
        month: 'short', 
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }) : 'N/A');
  
  const actionBy = isApproved 
    ? (data.approvedByName || data.reviewedByName || 'Manager')
    : (data.rejectedByName || data.reviewedByName || 'Manager');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Attendance Regularization ${statusText}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #F8F9FA;
      border-radius: 8px;
      overflow: hidden;
    }
    .info-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-table tr:nth-child(even) {
      background-color: #F1F3F5;
    }
    .info-label {
      font-weight: bold;
      color: #1a1a1a;
      width: 40%;
    }
    .info-value {
      color: #4a4a4a;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 14px;
    }
    .status-approved {
      background-color: #E8F8EF;
      color: #2E7D32;
    }
    .status-rejected {
      background-color: #FDECEC;
      color: #C62828;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
       <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Attendance Regularization ${statusText}</h1>
    <p class="message">Dear ${data.employeeName || 'Employee'},</p>
    <p class="message">Your attendance regularization request has been <strong>${statusText}</strong>.</p>
    
    <table class="info-table">
      <tr>
        <td class="info-label">Employee Name</td>
        <td class="info-value">${data.employeeName || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Employee ID</td>
        <td class="info-value">${data.employeeId || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Attendance Date</td>
        <td class="info-value">${attendanceDate}</td>
      </tr>
      <tr>
        <td class="info-label">Regularization Type</td>
        <td class="info-value">${regularizationTypeText}</td>
      </tr>
      <tr>
        <td class="info-label">${isApproved ? 'Approved By' : 'Rejected By'}</td>
        <td class="info-value">${actionBy}</td>
      </tr>
      <tr>
        <td class="info-label">${isApproved ? 'Approval Date & Time' : 'Rejection Date & Time'}</td>
        <td class="info-value">${actionDate}</td>
      </tr>
      ${!isApproved ? `<tr>
        <td class="info-label">Rejection Reason</td>
        <td class="info-value">${data.rejectionReason || data.rejectionReason || 'N/A'}</td>
      </tr>` : ''}
      <tr>
        <td class="info-label">Status</td>
        <td class="info-value"><span class="status-badge status-${status}">${statusText}</span></td>
      </tr>
    </table>

    <p class="message">If you have any questions, please contact HR or your reporting manager.</p>

    <div class="footer">
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">p</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Generate leave request email template
 * @param {Object} data - Leave and employee data
 * @returns {string} HTML email content
 */
const generateLeaveRequestEmailTemplate = (data) => {
  const startDate = data.startDate ? new Date(data.startDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const endDate = data.endDate ? new Date(data.endDate).toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' }) : 'N/A';
  const numberOfDays = data.duration || data.totalDays || 'N/A';
  const managerName = data.managerName || 'Manager';
  
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leave Request</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #F8F9FA;
      border-radius: 8px;
      overflow: hidden;
    }
    .info-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-table tr:nth-child(even) {
      background-color: #F1F3F5;
    }
    .info-label {
      font-weight: bold;
      color: #1a1a1a;
      width: 40%;
    }
    .info-value {
      color: #4a4a4a;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 14px;
    }
    .status-pending {
      background-color: #FFF4D6;
      color: #B8860B;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
       <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Leave Request</h1>
    <p class="message">Dear ${managerName},</p>
    <p class="message">I hope you are doing well.</p>
    <p class="message">I would like to request leave from <strong>${startDate}</strong> to <strong>${endDate}</strong> (<strong>${numberOfDays} day(s)</strong>).</p>
    
    <table class="info-table">
      <tr>
        <td class="info-label">Employee Name</td>
        <td class="info-value">${data.employeeName || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Employee ID</td>
        <td class="info-value">${data.employeeId || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Department</td>
        <td class="info-value">${data.department || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Leave Dates</td>
        <td class="info-value">${startDate} to ${endDate}</td>
      </tr>
      <tr>
        <td class="info-label">Number of Days</td>
        <td class="info-value">${numberOfDays}</td>
      </tr>
      <tr>
        <td class="info-label">Reason</td>
        <td class="info-value">${data.reason || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Status</td>
        <td class="info-value"><span class="status-badge status-pending">Pending</span></td>
      </tr>
    </table>
    
    <p class="message">I kindly request you to review and approve my leave request. Please let me know if any additional information is required.</p>
    
    <p class="message">Thank you for your time and consideration.</p>
    
    <p class="message">Regards,</p>
    <p class="message"><strong>${data.employeeName || 'Employee'}</strong></p>
    
    <div class="footer">
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">p</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
};

/**
 * Send leave request email to approver
 * @param {Object} leaveData - Leave request data
 * @param {string} approverEmail - Approver email address
 * @param {Array} ccEmails - CC email addresses (HR, Admin)
 *@param {string} employeeEmail - Employee email address (used for reply-to)
 * @returns {Promise<void>}
 */
export const sendLeaveRequestEmail = async (leaveData, approverEmail, ccEmails = [], employeeEmail = null) => {
  const emailConfig = getEmailConfig();
  const transporter = createEmailTransporter();
  const emailFrom = getLeaveEmailFrom();

  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured');
  }

  const ccList = buildLeaveCcList(ccEmails, approverEmail);

  const mailOptions = {
    from: emailFrom,
    to: approverEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: `Leave Request - ${leaveData.employeeName || 'Employee'}`,
    html: generateLeaveRequestEmailTemplate(leaveData)
  };

  // // For transactional email services (SendGrid, Mailgun, SES, Brevo), set from to employee's email directly
  // // These services support custom sender addresses without exposing the system email
  // if (employeeEmail && provider.isTransactional) {
  //   mailOptions.from = `"${leaveData.employeeName || 'Employee'}" <${employeeEmail}>`;
  //   mailOptions.replyTo = employeeEmail;
  // } 
  // // For traditional SMTP (Gmail, Outlook), use sender field to minimize system email exposure
  // else if (employeeEmail) {
  //   mailOptions.from = `"${leaveData.employeeName || 'Employee'}" <${employeeEmail}>`;
  //   mailOptions.sender = emailFrom;
  //   mailOptions.replyTo = employeeEmail;
  // }

  // Always send from system SMTP account; allow manager to reply to the employee
  if (employeeEmail) {
    mailOptions.replyTo = employeeEmail;
  }
  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Leave request email sent', { 
      from: emailFrom,
      replyTo: employeeEmail,
      to: approverEmail, 
      cc: ccList,
      messageId: info.messageId 
    });
  } catch (error) {
    logger.error('Error sending leave request email', { 
      from: emailFrom,
      replyTo: employeeEmail,
      to: approverEmail, 
      error: error.message 
    });
    throw error;
  }
};

/**
 * Send leave approval email to employee
 * @param {Object} leaveData - Leave request data
 * @param {string} employeeEmail - Employee email address
 * @param {Array} ccEmails - CC email addresses (Manager, HR, Admin)
 * @returns {Promise<void>}
 */
 const generateLeaveEmailTemplate = (data, status) => {
  const startDate = data.startDate
    ? new Date(data.startDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'N/A';

  const endDate = data.endDate
    ? new Date(data.endDate).toLocaleDateString('en-US', {
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      })
    : 'N/A';

  const numberOfDays = data.duration || data.totalDays || 'N/A';
  const isApproved = status === 'approved';
  const remarks = data.rejectionReason || data.remarks || data.reason || 'N/A';
  const statusText = isApproved ? 'Approved' : 'Rejected';
  const remarksLabel = isApproved ? 'Remarks' : 'Rejection Reason';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leave Request ${statusText}</title>
  <style>
    body {
      font-family: Arial, Helvetica, sans-serif;
      background-color: #0d0d0d;
      margin: 0;
      padding: 0;
      color: #FFFFFF;
    }
    .container {
      max-width: 600px;
      margin: 40px auto;
      padding: 32px;
      background-color: #1a1a1a;
      border-radius: 8px;
    }
    .header {
      text-align: center;
      margin-bottom: 20px;
    }
    .logo-dark { display: block !important; }
    .logo-light { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    @media (prefers-color-scheme: light) {
      .logo-light { display: block !important; max-height: none; mso-hide: none; }
      .logo-dark { display: none !important; max-height: 0; overflow: hidden; mso-hide: all; }
    }
    .divider {
      border: none;
      border-top: 1px solid #444444;
      margin: 0 0 24px 0;
    }
    .company-name {
      font-size: 24px;
      font-weight: 700;
      color: #5CC9A7;
      margin: 10px 0;
    }
    .heading {
      font-size: 24px;
      font-weight: 700;
      color: #FFFFFF;
      margin: 20px 0 15px 0;
    }
    .message {
      font-size: 16px;
      color: #FFFFFF;
      line-height: 1.6;
      margin: 0 0 15px 0;
    }
    .info-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
      background-color: #F8F9FA;
      border-radius: 8px;
      overflow: hidden;
    }
    .info-table td {
      padding: 12px 15px;
      border-bottom: 1px solid #E5E7EB;
    }
    .info-table tr:last-child td {
      border-bottom: none;
    }
    .info-table tr:nth-child(even) {
      background-color: #F1F3F5;
    }
    .info-label {
      font-weight: bold;
      color: #1a1a1a;
      width: 40%;
    }
    .info-value {
      color: #4a4a4a;
    }
    .status-badge {
      display: inline-block;
      padding: 6px 12px;
      border-radius: 4px;
      font-weight: bold;
      font-size: 14px;
    }
    .status-approved {
      background-color: #E8F8EF;
      color: #2E7D32;
    }
    .status-rejected {
      background-color: #FDECEC;
      color: #C62828;
    }
    .footer {
      font-size: 14px;
      color: #CCCCCC;
      text-align: center;
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #E5E7EB;
    }
    .powered-by-footer {
      text-align: center;
      margin-top: 15px;
    }
    .footer-logo {
      max-width: 80px;
      height: auto;
    }
    .powered-by-footer span {
      font-size: 12px;
      color: #CCCCCC;
    }
    a {
      color: #5CC9A7;
      text-decoration: none;
    }
    a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
       <div class="header">
      <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="180" style="display:none;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="180" style="display:block;margin:0 auto 16px auto;max-width:180px;height:auto;" />
      <hr class="divider" />
      <div class="company-name"></div>
    </div>
    <h1 class="heading">Leave Request ${statusText}</h1>
    <p class="message">Dear ${data.employeeName || 'Employee'},</p>
    <p class="message">Your leave request has been <strong>${statusText}</strong>.</p>
    
    <table class="info-table">
      <tr>
        <td class="info-label">Employee Name</td>
        <td class="info-value">${data.employeeName || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Employee ID</td>
        <td class="info-value">${data.employeeId || 'N/A'}</td>
      </tr>
      <tr>
        <td class="info-label">Leave Dates</td>
        <td class="info-value">${startDate} to ${endDate}</td>
      </tr>
      <tr>
        <td class="info-label">Number of Days</td>
        <td class="info-value">${numberOfDays}</td>
      </tr>
      <tr>
        <td class="info-label">${remarksLabel}</td>
        <td class="info-value">${remarks}</td>
      </tr>
      <tr>
        <td class="info-label">Status</td>
        <td class="info-value"><span class="status-badge status-${status}">${statusText}</span></td>
      </tr>
    </table>

    <p class="message">If you have any questions, please contact HR or your reporting manager.</p>

    <div class="footer">
      <p>Regards,</p>
      <p><strong>Paarsiv Technologies Private Limited</strong></p>
      <div class="powered-by-footer" style="text-align: center; margin-top: 15px;">
        <img class="logo-light" src="${LOGO_URL_LIGHT}" alt="Paarsiv Logo" width="40" style="display:none;vertical-align:middle;margin-right:8px;" />
        <img class="logo-dark" src="${LOGO_URL_DARK}" alt="Paarsiv Logo" width="40" style="display:inline-block;vertical-align:middle;margin-right:8px;" />
        <span style="vertical-align:middle;color: #FFFFFF;">Powered by <span style="color: #5CC9A7;">P</span><span style="color: #CCCCCC;">aar</span><span style="color: #5CC9A7;">s</span><span style="color: #CCCCCC;">iv</span></span>
      </div>
      <p style="font-size: 12px; color: #CCCCCC; margin-top: 15px;">&copy; 2026 Paarsiv Technologies Private Limited</p>
      <p style="font-size: 12px; color: #CCCCCC;">This is an automated email. Please do not reply to this email.</p>
    </div>
  </div>
</body>
</html>`;
};
export const sendLeaveApprovalEmail = async (leaveData, employeeEmail, ccEmails = []) => {
  const transporter = createEmailTransporter();
  const emailFrom = getLeaveEmailFrom();
  
  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured');
  }

  const ccList = buildLeaveCcList(ccEmails, employeeEmail);

  const mailOptions = {
    from: emailFrom,
    to: employeeEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: `Leave Request Approved - ${leaveData.employeeName || 'Employee'}`,
    html: generateLeaveEmailTemplate(leaveData, 'approved', 'employee')
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Leave approval email sent', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      messageId: info.messageId 
    });
  } catch (error) {
    logger.error('Error sending leave approval email', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      error: error.message 
    });
    throw error;
  }
};

/**
 * Send leave rejection email to employee
 * @param {Object} leaveData - Leave request data
 * @param {string} employeeEmail - Employee email address
 * @param {Array} ccEmails - CC email addresses (Manager, HR, Admin)
 * @returns {Promise<void>}
 */
export const sendLeaveRejectionEmail = async (leaveData, employeeEmail, ccEmails = []) => {
  const transporter = createEmailTransporter();
  const emailFrom = getLeaveEmailFrom();
  
  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured');
  }

  const ccList = buildLeaveCcList(ccEmails, employeeEmail);

  const mailOptions = {
    from: emailFrom,
    to: employeeEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: `Leave Request Rejected - ${leaveData.employeeName || 'Employee'}`,
    html: generateLeaveEmailTemplate(leaveData, 'rejected', 'employee')
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Leave rejection email sent', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      messageId: info.messageId 
    });
  } catch (error) {
    logger.error('Error sending leave rejection email', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      error: error.message 
    });
    throw error;
  }
};

/**
 * Send attendance regularization request email to approver
 * @param {Object} regularizationData - Regularization request data
 * @param {string} approverEmail - Approver email address
 * @param {Array} ccEmails - CC email addresses (HR, Admin)
 * @returns {Promise<void>}
 */
export const sendRegularizationRequestEmail = async (regularizationData, approverEmail, ccEmails = []) => {
  const emailConfig = getEmailConfig();
  const transporter = createEmailTransporter();
  const emailFrom = getRegularizationEmailFrom();

  if (!emailFrom) {
    throw new Error('Regularization email sender not configured');
  }

  const ccList = buildLeaveCcList(ccEmails, approverEmail);

  const mailOptions = {
    from: emailFrom,
    to: approverEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: `Attendance Regularization Request - ${regularizationData.employeeName || 'Employee'}`,
    html: generateRegularizationRequestEmailTemplate(regularizationData)
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Attendance regularization request email sent', { 
      from: emailFrom,
      to: approverEmail, 
      cc: ccList,
      messageId: info.messageId 
    });
  } catch (error) {
    logger.error('Error sending attendance regularization request email', { 
      from: emailFrom,
      to: approverEmail, 
      error: error.message 
    });
    throw error;
  }
};

/**
 * Send attendance regularization approval email to employee
 * @param {Object} regularizationData - Regularization request data
 * @param {string} employeeEmail - Employee email address
 * @param {Array} ccEmails - CC email addresses (Manager, HR, Admin)
 * @returns {Promise<void>}
 */
export const sendRegularizationApprovalEmail = async (regularizationData, employeeEmail, ccEmails = []) => {
  const transporter = createEmailTransporter();
  const emailFrom = getRegularizationEmailFrom();
  
  if (!emailFrom) {
    throw new Error('Regularization email sender not configured');
  }

  const ccList = buildLeaveCcList(ccEmails, employeeEmail);

  const mailOptions = {
    from: emailFrom,
    to: employeeEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: 'Attendance Regularization Approved',
    html: generateRegularizationEmailTemplate(regularizationData, 'approved')
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Attendance regularization approval email sent', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      messageId: info.messageId 
    });
  } catch (error) {
    logger.error('Error sending attendance regularization approval email', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      error: error.message 
    });
    throw error;
  }
};

/**
 * Send attendance regularization rejection email to employee
 * @param {Object} regularizationData - Regularization request data
 * @param {string} employeeEmail - Employee email address
 * @param {Array} ccEmails - CC email addresses (Manager, HR, Admin)
 * @returns {Promise<void>}
 */
export const sendRegularizationRejectionEmail = async (regularizationData, employeeEmail, ccEmails = []) => {
  const transporter = createEmailTransporter();
  const emailFrom = getRegularizationEmailFrom();
  
  if (!emailFrom) {
    throw new Error('Regularization email sender not configured');
  }

  const ccList = buildLeaveCcList(ccEmails, employeeEmail);

  const mailOptions = {
    from: emailFrom,
    to: employeeEmail,
    cc: ccList.length > 0 ? ccList : undefined,
    subject: 'Attendance Regularization Rejected',
    html: generateRegularizationEmailTemplate(regularizationData, 'rejected')
  };

  try {
    await transporter.verify();
    const info = await transporter.sendMail(mailOptions);
    logger.info('Attendance regularization rejection email sent', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      messageId: info.messageId 
    });
  } catch (error) {
    logger.error('Error sending attendance regularization rejection email', { 
      from: emailFrom,
      to: employeeEmail,
      cc: ccList,
      error: error.message 
    });
    throw error;
  }
};

export default {
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendNotificationEmail,
  sendLeaveRequestEmail,
  sendLeaveApprovalEmail,
  sendLeaveRejectionEmail
};