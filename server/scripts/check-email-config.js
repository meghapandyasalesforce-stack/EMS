/**
 * Email Configuration Checker Script
 * Run this script to validate your email configuration before starting the server
 * 
 * Usage: node server/scripts/check-email-config.js
 */

import dotenv from 'dotenv';
import { validateEmailConfig } from '../helpers/emailValidator.js';
import { getEmailConfig, detectEmailProvider, validateEmailConfiguration } from '../config/email.config.js';
import logger from '../helpers/logger.js';

// Load environment variables
dotenv.config();

logger.info('🔍 Checking Email Configuration...\n');

const emailConfig = getEmailConfig();
const provider = detectEmailProvider(emailConfig);
const validation = validateEmailConfiguration();

// Check FRONTEND_URL for email links
const frontendUrl = process.env.FRONTEND_URL;
const nodeEnv = process.env.NODE_ENV || 'development';

logger.info('Configuration:');
logger.info(`  EMAIL_USER: ${emailConfig.user ? emailConfig.user.replace(/@.*/, '@***') : '❌ Not set'}`);
logger.info(`  EMAIL_PASS: ${emailConfig.password ? '✓ Set' : '❌ Not set'}`);
logger.info(`  EMAIL_HOST: ${emailConfig.host}`);
logger.info(`  EMAIL_PORT: ${emailConfig.port}`);
logger.info(`  Provider: ${provider.type}`);
logger.info(`  FRONTEND_URL: ${frontendUrl || '❌ Not set'}`);
logger.info(`  NODE_ENV: ${nodeEnv}`);
logger.info('');

// Validate FRONTEND_URL
if (!frontendUrl) {
  logger.warn('⚠️  WARNING: FRONTEND_URL is not set!');
  logger.warn('   Email links (password reset, welcome emails) will not work correctly.');
  logger.warn('   Set FRONTEND_URL in your .env file (e.g., FRONTEND_URL=https://yourdomain.com)\n');
} else if (frontendUrl.includes('localhost') && nodeEnv === 'production') {
  logger.warn('⚠️  WARNING: FRONTEND_URL points to localhost in production!');
  logger.warn(`   Current: ${frontendUrl}`);
  logger.warn('   Update FRONTEND_URL to your production domain (e.g., https://yourdomain.com)\n');
} else if (!frontendUrl.startsWith('http')) {
  logger.warn('⚠️  WARNING: FRONTEND_URL should start with http:// or https://');
  logger.warn(`   Current: ${frontendUrl}\n`);
} else {
  logger.info(`✅ FRONTEND_URL is configured: ${frontendUrl}\n`);
}

if (!validation.valid) {
  logger.error('❌ Email credentials are not configured!');
  validation.errors.forEach(error => {
    logger.error(`   ${error}`);
  });
  process.exit(1);
}

// Gmail-specific validation
if (provider.isGmail) {
  const cleanPass = emailConfig.password?.replace(/\s/g, '');
  if (cleanPass && cleanPass.length !== 16) {
    logger.warn('⚠️  WARNING: Gmail requires an App Password (16 characters)');
    logger.warn('   Your password may not be an App Password.');
    logger.warn('   Generate one at: https://myaccount.google.com/apppasswords\n');
  }
}

logger.info('Testing email connection...\n');

try {
  const validation = await validateEmailConfig();
  
  if (validation.valid) {
    logger.info('✅ Email configuration is valid!');
    logger.info(`   Provider: ${validation.details.provider}`);
    logger.info(`   Host: ${validation.details.emailHost}`);
    logger.info(`   Port: ${validation.details.emailPort}`);
    logger.info(`   User: ${validation.details.emailUser}`);
    logger.info('\n✓ Welcome emails should work correctly.');
    process.exit(0);
  } else {
    logger.error('❌ Email configuration validation failed!');
    logger.error(`   Error: ${validation.message}`);
    if (validation.recommendation) {
      logger.error(`   Recommendation: ${validation.recommendation}`);
    }
    logger.error('\n✗ Welcome emails will not be sent until this is fixed.');
    logger.error('   See EMAIL_TROUBLESHOOTING.md for help.');
    process.exit(1);
  }
} catch (error) {
  logger.error('❌ Error validating email configuration:');
  logger.error(`   ${error.message}`);
  process.exit(1);
}

