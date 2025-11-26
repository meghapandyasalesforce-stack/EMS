import logger from './logger.js';
import { createEmailTransporter, detectEmailProvider, getEmailConfig, validateEmailConfiguration } from '../config/email.config.js';

/**
 * Validate email configuration by attempting to verify SMTP connection
 * @returns {Promise<{valid: boolean, message: string, details?: object}>}
 */
export const validateEmailConfig = async () => {
  try {
    const emailConfig = getEmailConfig();
    const provider = detectEmailProvider(emailConfig);
    
    // Check if credentials are configured
    const validation = validateEmailConfiguration();
    if (!validation.valid) {
      return {
        valid: false,
        message: validation.errors.join(', '),
        details: {
          hasUser: validation.config.hasUser,
          hasPass: validation.config.hasPassword,
          recommendation: validation.errors[0] || 'Set EMAIL_USER/EMAIL_USERNAME and EMAIL_PASS/EMAIL_PASSWORD environment variables'
        }
      };
    }

    const transporter = createEmailTransporter();

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
        provider: provider.type === 'gmail' ? 'Gmail' : provider.type === 'outlook' ? 'Outlook/Office365' : 'Generic SMTP',
        emailUser: emailConfig.user.replace(/@.*/, '@***'),
        emailHost: provider.isGmail ? 'gmail (service)' : emailConfig.host,
        emailPort: provider.isGmail ? 'N/A' : emailConfig.port
      }
    };
  } catch (error) {
    logger.error('Email configuration validation failed', {
      error: error.message,
      code: error.code,
      responseCode: error.responseCode
    });

    const emailConfig = getEmailConfig();
    const provider = detectEmailProvider(emailConfig);
    
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

