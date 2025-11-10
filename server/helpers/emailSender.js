import nodemailer from 'nodemailer';
import logger from './logger.js';

const sendWelcomeEmail = async (email, name, password) => {
  // Validate email credentials are configured
  const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
  const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  
  if (!emailUser || !emailPass) {
    throw new Error('Email credentials not configured. Please set EMAIL_USER/EMAIL_USERNAME and EMAIL_PASS/EMAIL_PASSWORD environment variables.');
  }

  // Determine email provider and configure transporter accordingly
  const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
  const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
  
  // Detect email provider
  const isGmail = emailUser.includes('@gmail.com') || emailHost.includes('gmail');
  const isOutlook = emailHost.includes('office365.com') || emailHost.includes('outlook.com') || emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com');
  
  // Configure transporter based on provider
  let transporterConfig;
  
  if (isGmail) {
    // Gmail configuration - use service instead of host
    transporterConfig = {
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPass, // Must be an App Password, not regular password
      },
      // Gmail specific settings
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };
    logger.info('Using Gmail service configuration', { emailUser: emailUser.replace(/@.*/, '@***') });
  } else if (isOutlook) {
    // Outlook/Office 365 configuration
    transporterConfig = {
      host: emailHost,
      port: emailPort,
      secure: false, // Use STARTTLS
      requireTLS: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };
    logger.info('Using Outlook/Office365 configuration', { emailHost, emailPort, emailUser: emailUser.replace(/@.*/, '@***') });
  } else {
    // Generic SMTP configuration
    transporterConfig = {
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465, // true for 465, false for other ports
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      tls: {
        rejectUnauthorized: process.env.NODE_ENV === 'production'
      }
    };
    logger.info('Using generic SMTP configuration', { emailHost, emailPort, emailUser: emailUser.replace(/@.*/, '@***') });
  }

  const transporter = nodemailer.createTransport(transporterConfig);

  // Email options
  // SECURITY: Never use default passwords. Password must be provided or generated securely.
  if (!password) {
    throw new Error('Password is required for welcome email. Employee password must be generated securely during account creation.');
  }
  const displayPassword = password;
  
  const emailFrom = process.env.EMAIL_FROM || process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
  
  if (!emailFrom) {
    throw new Error('EMAIL_FROM not configured. Please set EMAIL_FROM environment variable.');
  }

  // Store provider info for error handling
  const providerInfo = {
    isGmail,
    isOutlook,
    emailHost: isGmail ? 'gmail (service)' : emailHost,
    emailPort: isGmail ? 'N/A (service)' : emailPort
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
    <p class="message">
      Use the default password below to log in for the first time:
    </p>
    <div class="password-box">${displayPassword}</div>
    <p class="message">
      <strong>Security Notice:</strong> Please reset your password immediately after your first login to ensure account safety.
    </p>
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

export default sendWelcomeEmail;