import nodemailer from 'nodemailer';
import logger from './logger.js';

/**
 * Validate email configuration by attempting to verify SMTP connection
 * @returns {Promise<{valid: boolean, message: string, details?: object}>}
 */
export const validateEmailConfig = async () => {
  try {
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
    const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);

    // Check if credentials are configured
    if (!emailUser || !emailPass) {
      return {
        valid: false,
        message: 'Email credentials not configured',
        details: {
          hasUser: !!emailUser,
          hasPass: !!emailPass,
          recommendation: 'Set EMAIL_USER/EMAIL_USERNAME and EMAIL_PASS/EMAIL_PASSWORD environment variables'
        }
      };
    }

    // Detect provider
    const isGmail = emailUser.includes('@gmail.com') || emailHost.includes('gmail');
    const isOutlook = emailHost.includes('office365.com') || emailHost.includes('outlook.com') || 
                      emailUser.includes('@outlook.com') || emailUser.includes('@hotmail.com');

    // Configure transporter
    let transporterConfig;
    if (isGmail) {
      transporterConfig = {
        service: 'gmail',
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      };
    } else if (isOutlook) {
      transporterConfig = {
        host: emailHost,
        port: emailPort,
        secure: false,
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
    } else {
      transporterConfig = {
        host: emailHost,
        port: emailPort,
        secure: emailPort === 465,
        auth: {
          user: emailUser,
          pass: emailPass,
        },
        tls: {
          rejectUnauthorized: process.env.NODE_ENV === 'production'
        }
      };
    }

    const transporter = nodemailer.createTransport(transporterConfig);

    // Verify connection (with timeout)
    const verifyPromise = transporter.verify();
    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email verification timed out after 10 seconds')), 10000)
    );

    await Promise.race([verifyPromise, timeoutPromise]);

    return {
      valid: true,
      message: 'Email configuration is valid',
      details: {
        provider: isGmail ? 'Gmail' : isOutlook ? 'Outlook/Office365' : 'Generic SMTP',
        emailUser: emailUser.replace(/@.*/, '@***'),
        emailHost: isGmail ? 'gmail (service)' : emailHost,
        emailPort: isGmail ? 'N/A' : emailPort
      }
    };
  } catch (error) {
    logger.error('Email configuration validation failed', {
      error: error.message,
      code: error.code,
      responseCode: error.responseCode
    });

    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
    const isGmail = emailUser?.includes('@gmail.com');
    
    let message = 'Email configuration validation failed';
    let recommendation = 'Check your email credentials and server configuration';

    if (error.code === 'EAUTH' || error.responseCode === 535) {
      message = 'Email authentication failed';
      if (isGmail) {
        recommendation = 'For Gmail, you must use an App Password. Generate one at: https://myaccount.google.com/apppasswords';
      } else {
        recommendation = 'Verify your email and password are correct';
      }
    } else if (error.code === 'ECONNECTION' || error.code === 'ETIMEDOUT') {
      message = 'Cannot connect to email server';
      recommendation = 'Check EMAIL_HOST, EMAIL_PORT, and ensure your firewall/network allows SMTP connections';
    } else if (error.message.includes('timed out')) {
      message = 'Email server connection timed out';
      recommendation = 'Check your network connection and firewall settings';
    }

    return {
      valid: false,
      message,
      recommendation,
      error: error.message,
      code: error.code
    };
  }
};

