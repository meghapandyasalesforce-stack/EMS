import logger from './logger.js';
import { createEmailTransporter, getEmailFrom } from '../config/email.config.js';

/**
 * Send organization welcome email with verification link
 * @param {string} email - Recipient email
 * @param {string} organizationName - Organization name
 * @param {string} adminName - Admin name
 * @param {string} verificationToken - Email verification token
 * @param {string} baseUrl - Base URL for verification link
 * @returns {Promise<void>}
 */
export const sendOrganizationWelcomeEmail = async (email, organizationName, adminName, verificationToken, baseUrl) => {
    try {
        const transporter = createEmailTransporter();
        const emailFrom = getEmailFrom();
        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
        
        const mailOptions = {
            from: emailFrom,
            to: email,
            subject: `Welcome to ${process.env.APP_NAME || 'EMS-Paarsiv'}! Verify Your Email`,
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Welcome to ${process.env.APP_NAME || 'EMS-Paarsiv'}</title>
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
                        background-color: #f5f5f5;
                        margin: 0;
                        padding: 0;
                        color: #333333;
                    }
                    .container {
                        max-width: 600px;
                        margin: 40px auto;
                        background-color: #ffffff;
                        padding: 40px;
                        border-radius: 8px;
                        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 30px;
                    }
                    .logo {
                        font-size: 32px;
                        font-weight: bold;
                        color: #3B82F6;
                        margin-bottom: 10px;
                    }
                    .title {
                        font-size: 24px;
                        font-weight: 600;
                        color: #1F2937;
                        margin-bottom: 10px;
                    }
                    .subtitle {
                        font-size: 16px;
                        color: #6B7280;
                    }
                    .content {
                        font-size: 16px;
                        line-height: 1.6;
                        color: #374151;
                        margin-bottom: 30px;
                    }
                    .button {
                        display: inline-block;
                        padding: 14px 28px;
                        background-color: #3B82F6;
                        color: #ffffff;
                        text-decoration: none;
                        border-radius: 6px;
                        font-weight: 600;
                        text-align: center;
                        margin: 20px 0;
                    }
                    .button:hover {
                        background-color: #2563EB;
                    }
                    .verification-link {
                        word-break: break-all;
                        color: #3B82F6;
                        text-decoration: none;
                    }
                    .footer {
                        margin-top: 40px;
                        padding-top: 20px;
                        border-top: 1px solid #E5E7EB;
                        font-size: 14px;
                        color: #6B7280;
                        text-align: center;
                    }
                    .security-notice {
                        background-color: #FEF3C7;
                        border-left: 4px solid #F59E0B;
                        padding: 12px;
                        margin: 20px 0;
                        border-radius: 4px;
                        font-size: 14px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <div class="logo">${process.env.APP_NAME || 'EMS-Paarsiv'}</div>
                        <h1 class="title">Welcome, ${adminName}!</h1>
                        <p class="subtitle">Your organization "${organizationName}" has been successfully registered</p>
                    </div>
                    
                    <div class="content">
                        <p>Hello ${adminName},</p>
                        <p>Congratulations! Your organization <strong>${organizationName}</strong> has been successfully registered with ${process.env.APP_NAME || 'EMS-Paarsiv'}.</p>
                        <p>To get started, please verify your email address by clicking the button below:</p>
                        
                        <div style="text-align: center;">
                            <a href="${verificationUrl}" class="button">Verify Email Address</a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p><a href="${verificationUrl}" class="verification-link">${verificationUrl}</a></p>
                        
                        <div class="security-notice">
                            <strong>Security Notice:</strong> This verification link will expire in 24 hours. Please verify your email as soon as possible to activate your account.
                        </div>
                        
                        <p>Once verified, you'll be able to:</p>
                        <ul>
                            <li>Access your organization dashboard</li>
                            <li>Invite team members</li>
                            <li>Configure your organization settings</li>
                            <li>Start managing your employees</li>
                        </ul>
                        
                        <p>If you have any questions, feel free to reach out to our support team.</p>
                    </div>
                    
                    <div class="footer">
                        <p>Best regards,<br>The ${process.env.APP_NAME || 'EMS-Paarsiv'} Team</p>
                        <p style="margin-top: 20px; font-size: 12px; color: #9CA3AF;">
                            This email was sent to ${email}. If you didn't create an account, please ignore this email.
                        </p>
                    </div>
                </div>
            </body>
            </html>
            `
        };
        
        await transporter.verify();
        const info = await transporter.sendMail(mailOptions);
        logger.info('Organization welcome email sent', { 
            email, 
            messageId: info.messageId 
        });
    } catch (error) {
        logger.error('Error sending organization welcome email', { 
            error: error.message,
            email 
        });
        throw error;
    }
};

/**
 * Send email verification reminder
 * @param {string} email - Recipient email
 * @param {string} organizationName - Organization name
 * @param {string} verificationToken - Email verification token
 * @param {string} baseUrl - Base URL for verification link
 * @returns {Promise<void>}
 */
export const sendVerificationReminder = async (email, organizationName, verificationToken, baseUrl) => {
    try {
        const transporter = createEmailTransporter();
        const emailFrom = getEmailFrom();
        const verificationUrl = `${baseUrl}/verify-email?token=${verificationToken}`;
        
        const mailOptions = {
            from: emailFrom,
            to: email,
            subject: `Verify Your Email - ${organizationName}`,
            html: `
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <title>Verify Your Email</title>
            </head>
            <body style="font-family: Arial, sans-serif; background-color: #f5f5f5; padding: 20px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 8px;">
                    <h2 style="color: #333;">Email Verification Reminder</h2>
                    <p>Hello,</p>
                    <p>Please verify your email address for <strong>${organizationName}</strong> by clicking the link below:</p>
                    <p><a href="${verificationUrl}" style="background-color: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">Verify Email</a></p>
                    <p>Or copy this link: ${verificationUrl}</p>
                    <p style="color: #666; font-size: 14px;">This link will expire in 24 hours.</p>
                </div>
            </body>
            </html>
            `
        };
        
        await transporter.sendMail(mailOptions);
        logger.info('Verification reminder email sent', { email });
    } catch (error) {
        logger.error('Error sending verification reminder', { error: error.message, email });
        throw error;
    }
};

