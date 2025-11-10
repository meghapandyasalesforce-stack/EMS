/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

import logger from './logger.js';

const validateEnvironment = () => {
  const errors = [];
  const warnings = [];

  // Required in all environments
  const required = {
    MONGO_URI: process.env.MONGO_URI,
    JWT_SECRET: process.env.JWT_SECRET,
  };

  // Required in production
  const requiredInProduction = {
    FRONTEND_URL: process.env.FRONTEND_URL,
    EMAIL_USER: process.env.EMAIL_USER || process.env.EMAIL_USERNAME,
    EMAIL_PASS: process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD,
  };

  // Check required variables
  Object.entries(required).forEach(([key, value]) => {
    if (!value) {
      errors.push(`Missing required environment variable: ${key}`);
    } else if (key === 'JWT_SECRET' && value.length < 32) {
      errors.push(`JWT_SECRET must be at least 32 characters long. Current length: ${value.length}`);
    }
  });

  // Check production-specific requirements
  if (process.env.NODE_ENV === 'production') {
    Object.entries(requiredInProduction).forEach(([key, value]) => {
      if (!value) {
        errors.push(`Missing required environment variable for production: ${key}`);
      }
    });

    // Additional production validations
    if (process.env.JWT_SECRET && process.env.JWT_SECRET === 'change_this_to_a_strong_random_secret_min_32_characters') {
      errors.push('JWT_SECRET must be changed from default value in production');
    }

    // DEFAULT_EMPLOYEE_PASSWORD has been removed for security - passwords are now auto-generated
  }

  // Check email configuration
  const hasEmailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
  const hasEmailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
  if ((hasEmailUser && !hasEmailPass) || (hasEmailPass && !hasEmailUser)) {
    warnings.push('Email configuration is incomplete. Both EMAIL_USER and EMAIL_PASS must be set for email functionality.');
  }

  // Check CORS configuration
  if (process.env.NODE_ENV === 'production' && !process.env.FRONTEND_URL && !process.env.ALLOWED_ORIGINS) {
    warnings.push('CORS configuration may be incomplete. Set FRONTEND_URL or ALLOWED_ORIGINS in production.');
  }

  // Display errors and warnings
  if (errors.length > 0) {
    logger.error('Environment Validation Errors:');
    errors.forEach((error) => logger.error(`  - ${error}`));
    logger.error('Please fix these errors before starting the server.');
    return false;
  }

  if (warnings.length > 0) {
    warnings.forEach((warning) => logger.warn(`  - ${warning}`));
  }

  if (errors.length === 0 && warnings.length === 0) {
    logger.info('Environment variables validated successfully');
  }

  return true;
};

export default validateEnvironment;

