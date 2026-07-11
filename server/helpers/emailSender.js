import logger from './logger.js';
import { createEmailTransporter, getEmailFrom, detectEmailProvider, getEmailConfig } from '../config/email.config.js';

const LEAVE_EMAIL_SENDER_NAME = 'Paarsiv Technologies Private Limited';
const REGULARIZATION_EMAIL_SENDER = 'kunalpareekn@gmail.com';

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
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #333333;
      line-height: 1.6;
    }
    p {
      margin: 0 0 15px 0;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h2>Attendance Regularization Request</h2>
  
  <p>Dear Manager,</p>
  
  <p>${data.employeeName || 'An employee'} has applied for attendance regularization.</p>
  
  <p><strong>Employee Name:</strong> ${data.employeeName || 'N/A'}</p>
  <p><strong>Employee ID:</strong> ${data.employeeId || 'N/A'}</p>
  <p><strong>Department:</strong> ${data.department || 'N/A'}</p>
  <p><strong>Attendance Date:</strong> ${attendanceDate}</p>
  <p><strong>Regularization Type:</strong> ${regularizationTypeText}</p>
  <p><strong>Requested Time:</strong> ${requestedTimeText}</p>
  <p><strong>Reason:</strong></p>
  <p>${data.reason || 'N/A'}</p>
  <p><strong>Request Status:</strong> Pending</p>
  <p><strong>Submitted Date & Time:</strong> ${submittedAt}</p>
  
  <p>Please review and approve or reject this request.</p>
  
  <p>Regards,</p>
  <p><strong>Paarsiv Technologies Private Limited</strong></p>
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
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #333333;
      line-height: 1.6;
    }
    p {
      margin: 0 0 15px 0;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h2>Attendance Regularization ${statusText}</h2>
  
  <p>Dear ${data.employeeName || 'Employee'},</p>
  
  <p>Your attendance regularization request has been <strong>${statusText}</strong>.</p>
  
  <p><strong>Attendance Date:</strong> ${attendanceDate}</p>
  <p><strong>Regularization Type:</strong> ${regularizationTypeText}</p>
  <p><strong>${isApproved ? 'Approved By' : 'Rejected By'}:</strong> ${actionBy}</p>
  <p><strong>${isApproved ? 'Approval Date & Time' : 'Rejection Date & Time'}:</strong> ${actionDate}</p>
  ${!isApproved ? `<p><strong>Rejection Reason:</strong></p><p>${data.rejectionReason || data.rejectionReason || 'N/A'}</p>` : ''}
  <p><strong>Status:</strong> ${statusText}</p>
  
  <p>If you have any questions, please contact HR or your reporting manager.</p>
  
  <p>Regards,</p>
  <p><strong>Paarsiv Technologies Private Limited</strong></p>
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
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #333333;
      line-height: 1.6;
    }
    p {
      margin: 0 0 15px 0;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <p>Dear ${managerName},</p>
  
  <p>I hope you are doing well.</p>
  
  <p>I would like to request leave from <strong>${startDate}</strong> to <strong>${endDate}</strong> (<strong>${numberOfDays} day(s)</strong>).</p>
  
  <p><strong>Reason for Leave:</strong></p>
  <p>${data.reason || 'N/A'}</p>
  
  <p>I kindly request you to review and approve my leave request. Please let me know if any additional information is required.</p>
  
  <p>Thank you for your time and consideration.</p>
  
  <p>Regards,</p>
  <p><strong>${data.employeeName || 'Employee'}</strong></p>
  <p>${data.employeeId || 'N/A'}</p>
  <p>${data.department || 'N/A'}</p>
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
  const statusText = isApproved ? 'approved' : 'rejected';
  const remarksLabel = isApproved ? 'Remarks' : 'Rejection Reason';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Leave Request ${isApproved ? 'Approved' : 'Rejected'}</title>
  <style>
    body {
      margin: 0;
      padding: 20px;
      font-family: Arial, sans-serif;
      font-size: 14px;
      color: #333333;
      line-height: 1.6;
    }
    p {
      margin: 0 0 15px 0;
    }
    strong {
      font-weight: bold;
    }
  </style>
</head>
<body>
  <h2>Paarsiv Technologies Private Limited</h2>
  <p>Dear ${data.employeeName || 'Employee'},</p>

  <p>Your leave request has been <strong>${statusText}</strong>.</p>

  <p><strong>Leave Dates:</strong> ${startDate} to ${endDate}</p>
  <p><strong>Number of Days:</strong> ${numberOfDays}</p>
  <p><strong>${remarksLabel}:</strong></p>
  <p>${remarks}</p>

  <p>If you have any questions, please contact HR or your reporting manager.</p>

  <p>Regards,</p>
  <p><strong>Paarsiv Technologies Private Limited</strong></p>
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