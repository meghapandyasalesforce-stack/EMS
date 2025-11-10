import nodemailer from 'nodemailer';
import logger from './logger.js';

const sendWelcomeEmail = async (email, name, password) => {
  // Create a transporter - support both Gmail and Outlook/Office 365
  const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
  const emailPort = process.env.EMAIL_PORT || 587;
  const isOutlook = emailHost.includes('office365.com') || emailHost.includes('outlook.com');
  
  // Validate email credentials are configured
  const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
  const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  
  if (!emailUser || !emailPass) {
    throw new Error('Email credentials not configured. Please set EMAIL_USER/EMAIL_USERNAME and EMAIL_PASS/EMAIL_PASSWORD environment variables.');
  }

  const transporter = nodemailer.createTransport({
    host: isOutlook ? emailHost : undefined,
    port: isOutlook ? emailPort : undefined,
    secure: false, // true for 465, false for other ports (587 uses STARTTLS)
    requireTLS: isOutlook ? true : false, // Outlook requires STARTTLS
    service: isOutlook ? undefined : (process.env.EMAIL_HOST || 'Gmail'),
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
    await transporter.verify();
    logger.info('Email transporter verified successfully', { emailHost, emailPort });
    
    // Send the email
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
      emailHost,
      emailPort,
      error: error.message,
      errorCode: error.code,
      command: error.command,
      response: error.response,
      responseCode: error.responseCode,
      stack: error.stack 
    });
    
    // Provide more user-friendly error messages
    let errorMessage = 'Failed to send welcome email';
    if (error.code === 'EAUTH') {
      errorMessage = 'Email authentication failed. Please check email credentials.';
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      errorMessage = 'Email server connection failed. Please check email server configuration.';
    } else if (error.responseCode === 535) {
      errorMessage = 'Email authentication failed. Invalid email credentials.';
    } else if (error.message) {
      errorMessage = `Email sending failed: ${error.message}`;
    }
    
    // Re-throw error with improved message
    const enhancedError = new Error(errorMessage);
    enhancedError.originalError = error;
    throw enhancedError;
  }
};

export default sendWelcomeEmail;