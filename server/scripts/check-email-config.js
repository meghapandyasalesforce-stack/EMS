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

console.log('Configuration:');
console.log(`  EMAIL_USER: ${emailConfig.user ? emailConfig.user.replace(/@.*/, '@***') : '❌ Not set'}`);
console.log(`  EMAIL_PASS: ${emailConfig.password ? '✓ Set' : '❌ Not set'}`);
console.log(`  EMAIL_HOST: ${emailConfig.host}`);
console.log(`  EMAIL_PORT: ${emailConfig.port}`);
console.log(`  Provider: ${provider.type}`);
console.log('');

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

