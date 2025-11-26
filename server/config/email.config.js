import nodemailer from 'nodemailer';
import logger from '../helpers/logger.js';

/**
 * Email Configuration
 * Centralized email settings and transporter configuration
 */

/**
 * Get email configuration from environment variables
 * @returns {Object} Email configuration object
 */
export const getEmailConfig = () => {
    const emailUser = process.env.EMAIL_USER || process.env.EMAIL_USERNAME;
    const emailPass = process.env.EMAIL_PASS || process.env.EMAIL_PASSWORD;
    const emailHost = process.env.EMAIL_HOST || 'smtp.office365.com';
    const emailPort = parseInt(process.env.EMAIL_PORT || '587', 10);
    const emailFrom = process.env.EMAIL_FROM || emailUser;
    const emailService = process.env.EMAIL_SERVICE; // Optional: force service (gmail, outlook, etc.)

    return {
        user: emailUser,
        password: emailPass,
        host: emailHost,
        port: emailPort,
        from: emailFrom,
        service: emailService
    };
};

/**
 * Detect email provider from configuration
 * @param {Object} config - Email configuration
 * @returns {Object} Provider information
 */
export const detectEmailProvider = (config) => {
    const { user, host, service } = config;
    
    // If service is explicitly set, use it
    if (service) {
        return {
            type: service.toLowerCase(),
            isGmail: service.toLowerCase() === 'gmail',
            isOutlook: ['outlook', 'office365'].includes(service.toLowerCase())
        };
    }
    
    // Auto-detect from email or host
    const isGmail = user?.includes('@gmail.com') || host?.includes('gmail');
    const isOutlook = host?.includes('office365.com') || 
                      host?.includes('outlook.com') || 
                      user?.includes('@outlook.com') || 
                      user?.includes('@hotmail.com');
    
    let providerType = 'smtp'; // Default to generic SMTP
    if (isGmail) providerType = 'gmail';
    else if (isOutlook) providerType = 'outlook';
    
    return {
        type: providerType,
        isGmail,
        isOutlook
    };
};

/**
 * Create nodemailer transporter based on configuration
 * @param {Object} [config] - Optional email configuration (uses env vars if not provided)
 * @returns {Object} Nodemailer transporter
 */
export const createEmailTransporter = (config = null) => {
    const emailConfig = config || getEmailConfig();
    const provider = detectEmailProvider(emailConfig);
    
    // Validate credentials
    if (!emailConfig.user || !emailConfig.password) {
        throw new Error('Email credentials not configured. Please set EMAIL_USER/EMAIL_USERNAME and EMAIL_PASS/EMAIL_PASSWORD environment variables.');
    }
    
    let transporterConfig;
    
    if (provider.isGmail) {
        // Gmail configuration - use service instead of host
        transporterConfig = {
            service: 'gmail',
            auth: {
                user: emailConfig.user,
                pass: emailConfig.password, // Must be an App Password, not regular password
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        };
        logger.info('Using Gmail service configuration', { 
            emailUser: emailConfig.user.replace(/@.*/, '@***') 
        });
    } else if (provider.isOutlook) {
        // Outlook/Office 365 configuration
        transporterConfig = {
            host: emailConfig.host,
            port: emailConfig.port,
            secure: false, // Use STARTTLS
            requireTLS: true,
            auth: {
                user: emailConfig.user,
                pass: emailConfig.password,
            },
            tls: {
                ciphers: 'SSLv3',
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        };
        logger.info('Using Outlook/Office365 configuration', { 
            emailHost: emailConfig.host, 
            emailPort: emailConfig.port,
            emailUser: emailConfig.user.replace(/@.*/, '@***') 
        });
    } else {
        // Generic SMTP configuration
        transporterConfig = {
            host: emailConfig.host,
            port: emailConfig.port,
            secure: emailConfig.port === 465, // true for 465, false for other ports
            auth: {
                user: emailConfig.user,
                pass: emailConfig.password,
            },
            tls: {
                rejectUnauthorized: process.env.NODE_ENV === 'production'
            }
        };
        logger.info('Using generic SMTP configuration', { 
            emailHost: emailConfig.host, 
            emailPort: emailConfig.port,
            emailUser: emailConfig.user.replace(/@.*/, '@***') 
        });
    }
    
    return nodemailer.createTransport(transporterConfig);
};

/**
 * Get default "from" email address
 * @returns {string} From email address
 */
export const getEmailFrom = () => {
    const config = getEmailConfig();
    return config.from || config.user;
};

/**
 * Validate email configuration
 * @returns {Object} Validation result
 */
export const validateEmailConfiguration = () => {
    const config = getEmailConfig();
    
    const validation = {
        valid: true,
        errors: [],
        warnings: [],
        config: {
            hasUser: !!config.user,
            hasPassword: !!config.password,
            hasHost: !!config.host,
            hasPort: !!config.port,
            provider: detectEmailProvider(config).type
        }
    };
    
    if (!config.user) {
        validation.valid = false;
        validation.errors.push('EMAIL_USER or EMAIL_USERNAME is not set');
    }
    
    if (!config.password) {
        validation.valid = false;
        validation.errors.push('EMAIL_PASS or EMAIL_PASSWORD is not set');
    }
    
    if (!config.host && !detectEmailProvider(config).isGmail) {
        validation.valid = false;
        validation.errors.push('EMAIL_HOST is required for non-Gmail providers');
    }
    
    // Gmail-specific validation
    if (detectEmailProvider(config).isGmail) {
        const cleanPass = config.password?.replace(/\s/g, '');
        if (cleanPass && cleanPass.length !== 16) {
            validation.warnings.push('Gmail requires an App Password (16 characters). Generate one at: https://myaccount.google.com/apppasswords');
        }
    }
    
    return validation;
};

/**
 * Email configuration constants
 */
export const EMAIL_CONFIG = {
    // Default values
    DEFAULT_HOST: 'smtp.office365.com',
    DEFAULT_PORT: 587,
    
    // Provider-specific ports
    PORTS: {
        GMAIL: 587,
        OUTLOOK: 587,
        SMTP_SSL: 465,
        SMTP_TLS: 587
    },
    
    // Provider hosts
    HOSTS: {
        GMAIL: 'smtp.gmail.com',
        OUTLOOK: 'smtp.office365.com',
        HOTMAIL: 'smtp-mail.outlook.com'
    },
    
    // Email templates
    TEMPLATES: {
        WELCOME: 'welcome',
        PASSWORD_RESET: 'password_reset',
        VERIFICATION: 'verification',
        NOTIFICATION: 'notification'
    }
};

/**
 * Get email configuration status (for API endpoints)
 * @returns {Object} Configuration status
 */
export const getEmailConfigStatus = () => {
    const config = getEmailConfig();
    const provider = detectEmailProvider(config);
    const validation = validateEmailConfiguration();
    
    return {
        configured: validation.valid,
        provider: provider.type,
        emailHost: provider.isGmail ? 'gmail (service)' : config.host,
        emailPort: provider.isGmail ? 'N/A (service)' : config.port,
        emailFrom: config.from ? config.from.replace(/@.*/, '@***') : 'Not set',
        emailUser: config.user ? config.user.replace(/@.*/, '@***') : 'Not set',
        hasPassword: !!config.password,
        validation: {
            valid: validation.valid,
            errors: validation.errors,
            warnings: validation.warnings
        }
    };
};

export default {
    getEmailConfig,
    detectEmailProvider,
    createEmailTransporter,
    getEmailFrom,
    validateEmailConfiguration,
    getEmailConfigStatus,
    EMAIL_CONFIG
};

