import express from 'express';
import sendWelcomeEmail from '../../helpers/emailSender.js';
import { validateEmailConfig } from '../../helpers/emailValidator.js';
import logger from '../../helpers/logger.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

/**
 * Test email configuration endpoint
 * POST /api/v1/both/email/test
 * Requires admin authentication
 */
router.post('/test', isAdminAuthenticated, async (req, res) => {
  try {
    const { testEmail } = req.body;
    
    if (!testEmail) {
      return res.status(400).json({
        success: false,
        message: 'Test email address is required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmail)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid email format'
      });
    }

    logger.info('Email test requested', { testEmail });

    // Send test email
    await sendWelcomeEmail(
      testEmail,
      'Test User',
      'TestPassword123!'
    );

    res.json({
      success: true,
      message: 'Test email sent successfully. Please check your inbox.',
      testEmail
    });
  } catch (error) {
    logger.error('Email test failed', {
      error: error.message,
      code: error.code,
      stack: error.stack
    });

    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send test email',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined,
      code: error.code,
      troubleshooting: error.message.includes('Gmail') ? 
        'For Gmail, use an App Password instead of your regular password. Generate one at: https://myaccount.google.com/apppasswords' :
        'Check your EMAIL_HOST, EMAIL_PORT, EMAIL_USER, and EMAIL_PASS environment variables.'
    });
  }
});

/**
 * Get email configuration status (without exposing credentials)
 * GET /api/v1/both/email/status
 * Requires admin authentication
 */
router.get('/status', isAdminAuthenticated, async (req, res) => {
  try {
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
    const emailPort = process.env.EMAIL_PORT || 587;
    const emailFrom = process.env.EMAIL_FROM || emailUser;

    const isConfigured = !!(emailUser && emailPass);
    const isGmail = emailUser?.includes('@gmail.com') || emailHost.includes('gmail');
    const isOutlook = emailHost.includes('office365.com') || emailHost.includes('outlook.com');

    // Validate email configuration
    let validation = null;
    if (isConfigured) {
      try {
        validation = await validateEmailConfig();
      } catch (validationError) {
        logger.warn('Email validation failed', { error: validationError.message });
      }
    }

    res.json({
      success: true,
      configured: isConfigured,
      validated: validation?.valid || false,
      provider: isGmail ? 'Gmail' : isOutlook ? 'Outlook/Office365' : 'Generic SMTP',
      emailHost: isGmail ? 'gmail (service)' : emailHost,
      emailPort: isGmail ? 'N/A (service)' : emailPort,
      emailFrom: emailFrom ? emailFrom.replace(/@.*/, '@***') : 'Not set',
      emailUser: emailUser ? emailUser.replace(/@.*/, '@***') : 'Not set',
      hasPassword: !!emailPass,
      validationMessage: validation?.message,
      validationRecommendation: validation?.recommendation,
      recommendations: isGmail ? [
        'Use an App Password instead of your regular Gmail password',
        'Generate App Password at: https://myaccount.google.com/apppasswords',
        'Enable 2-Step Verification first if not already enabled'
      ] : isOutlook ? [
        'Ensure your account has SMTP access enabled',
        'Check if your organization allows SMTP connections',
        'Verify credentials are correct'
      ] : [
        'Verify EMAIL_HOST and EMAIL_PORT are correct for your SMTP server',
        'Check firewall/network allows SMTP connections',
        'Ensure credentials are correct'
      ]
    });
  } catch (error) {
    logger.error('Error getting email status', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to get email configuration status'
    });
  }
});

/**
 * Validate email configuration endpoint
 * POST /api/v1/both/email/validate
 * Requires admin authentication
 */
router.post('/validate', isAdminAuthenticated, async (req, res) => {
  try {
    const validation = await validateEmailConfig();
    
    if (validation.valid) {
      res.json({
        success: true,
        message: validation.message,
        details: validation.details
      });
    } else {
      res.status(400).json({
        success: false,
        message: validation.message,
        recommendation: validation.recommendation,
        error: validation.error,
        code: validation.code
      });
    }
  } catch (error) {
    logger.error('Email validation error', { error: error.message });
    res.status(500).json({
      success: false,
      message: 'Failed to validate email configuration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

export default router;

