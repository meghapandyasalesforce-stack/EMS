/**
 * Email Configuration Checker Script
 * Run this script to validate your email configuration before starting the server
 * 
 * Usage: node server/scripts/check-email-config.js
 */

import dotenv from 'dotenv';
import { validateEmailConfig } from '../helpers/emailValidator.js';

// Load environment variables
dotenv.config();

console.log('🔍 Checking Email Configuration...\n');

const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
const emailPort = process.env.EMAIL_PORT || 587;

console.log('Configuration:');
console.log(`  EMAIL_USER: ${emailUser ? emailUser.replace(/@.*/, '@***') : '❌ Not set'}`);
console.log(`  EMAIL_PASS: ${emailPass ? '✓ Set' : '❌ Not set'}`);
console.log(`  EMAIL_HOST: ${emailHost}`);
console.log(`  EMAIL_PORT: ${emailPort}`);
console.log('');

if (!emailUser || !emailPass) {
  console.error('❌ Email credentials are not configured!');
  console.error('   Please set EMAIL_USER/EMAIL_USERNAME and EMAIL_PASS/EMAIL_PASSWORD in your .env file');
  process.exit(1);
}

// Detect provider
const isGmail = emailUser.includes('@gmail.com') || emailHost.includes('gmail');
if (isGmail) {
  const cleanPass = emailPass.replace(/\s/g, '');
  if (cleanPass.length !== 16) {
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

