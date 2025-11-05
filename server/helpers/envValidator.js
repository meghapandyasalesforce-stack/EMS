/**
 * Environment Variable Validation
 * Validates required environment variables at startup
 */

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

    if (process.env.DEFAULT_EMPLOYEE_PASSWORD && process.env.DEFAULT_EMPLOYEE_PASSWORD === 'ChangeThisInProduction!123') {
      warnings.push('DEFAULT_EMPLOYEE_PASSWORD should be changed from default value in production');
    }
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
    console.error('\n❌ Environment Validation Errors:');
    errors.forEach((error) => console.error(`  - ${error}`));
    console.error('\nPlease fix these errors before starting the server.\n');
    return false;
  }

  if (warnings.length > 0) {
    console.warn('\n⚠️  Environment Validation Warnings:');
    warnings.forEach((warning) => console.warn(`  - ${warning}`));
    console.warn('');
  }

  if (errors.length === 0 && warnings.length === 0) {
    console.log('✅ Environment variables validated successfully\n');
  }

  return true;
};

export default validateEnvironment;

