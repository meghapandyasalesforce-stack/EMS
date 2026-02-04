/**
 * Email Configuration Checker Script
 * Run this script to validate your email configuration before starting the server
 * 
 * Usage: node server/scripts/check-email-config.js
 */

import dotenv from 'dotenv';
import { validateEmailConfig } from '../helpers/emailValidator.js';
import { getEmailConfig, detectEmailProvider, validateEmailConfiguration } from '../config/email.config.js';

// Load environment variables
dotenv.config();

console.log('🔍 Checking Email Configuration...\n');

const emailConfig = getEmailConfig();
const provider = detectEmailProvider(emailConfig);
const validation = validateEmailConfiguration();

// Check FRONTEND_URL for email links
const frontendUrl = process.env.FRONTEND_URL;
const nodeEnv = process.env.NODE_ENV || 'development';

console.log('Configuration:');
console.log(`  EMAIL_USER: ${emailConfig.user ? emailConfig.user.replace(/@.*/, '@***') : '❌ Not set'}`);
console.log(`  EMAIL_PASS: ${emailConfig.password ? '✓ Set' : '❌ Not set'}`);
console.log(`  EMAIL_HOST: ${emailConfig.host}`);
console.log(`  EMAIL_PORT: ${emailConfig.port}`);
console.log(`  Provider: ${provider.type}`);
console.log(`  FRONTEND_URL: ${frontendUrl || '❌ Not set'}`);
console.log(`  NODE_ENV: ${nodeEnv}`);
console.log('');

// Validate FRONTEND_URL
if (!frontendUrl) {
  console.warn('⚠️  WARNING: FRONTEND_URL is not set!');
  console.warn('   Email links (password reset, welcome emails) will not work correctly.');
  console.warn('   Set FRONTEND_URL in your .env file (e.g., FRONTEND_URL=https://yourdomain.com)\n');
} else if (frontendUrl.includes('localhost') && nodeEnv === 'production') {
  console.warn('⚠️  WARNING: FRONTEND_URL points to localhost in production!');
  console.warn(`   Current: ${frontendUrl}`);
  console.warn('   Update FRONTEND_URL to your production domain (e.g., https://yourdomain.com)\n');
} else if (!frontendUrl.startsWith('http')) {
  console.warn('⚠️  WARNING: FRONTEND_URL should start with http:// or https://');
  console.warn(`   Current: ${frontendUrl}\n`);
} else {
  console.log(`✅ FRONTEND_URL is configured: ${frontendUrl}\n`);
}

if (!validation.valid) {
  console.error('❌ Email credentials are not configured!');
  validation.errors.forEach(error => {
    console.error(`   ${error}`);
  });
  process.exit(1);
}

// Gmail-specific validation
if (provider.isGmail) {
  const cleanPass = emailConfig.password?.replace(/\s/g, '');
  if (cleanPass && cleanPass.length !== 16) {
    console.warn('⚠️  WARNING: Gmail requires an App Password (16 characters)');
    console.warn('   Your password may not be an App Password.');
    console.warn('   Generate one at: https://myaccount.google.com/apppasswords\n');
  }
}

console.log('Testing email connection...\n');

try {
  const validation = await validateEmailConfig();
  
  if (validation.valid) {
    console.log('✅ Email configuration is valid!');
    console.log(`   Provider: ${validation.details.provider}`);
    console.log(`   Host: ${validation.details.emailHost}`);
    console.log(`   Port: ${validation.details.emailPort}`);
    console.log(`   User: ${validation.details.emailUser}`);
    console.log('\n✓ Welcome emails should work correctly.');
    process.exit(0);
  } else {
    console.error('❌ Email configuration validation failed!');
    console.error(`   Error: ${validation.message}`);
    if (validation.recommendation) {
      console.error(`   Recommendation: ${validation.recommendation}`);
    }
    console.error('\n✗ Welcome emails will not be sent until this is fixed.');
    console.error('   See EMAIL_TROUBLESHOOTING.md for help.');
    process.exit(1);
  }
} catch (error) {
  console.error('❌ Error validating email configuration:');
  console.error(`   ${error.message}`);
  process.exit(1);
}

