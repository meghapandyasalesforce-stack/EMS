import Organization from '../../models/organization.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import { sendSuccess, sendError, sendValidationError, sendUnauthorized, sendForbidden, sendInternalError } from '../../helpers/responseHelper.js';
import { generateToken } from '../../helpers/utils.js';
import { sendOrganizationWelcomeEmail } from '../../helpers/organizationEmail.js';
import { generateVerificationTokenWithExpiry } from '../../helpers/emailVerification.js';
import logger from '../../helpers/logger.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import { normalizeEmail, isAccountLocked, handleFailedLogin, resetLoginAttempts, getLockoutMessage, clearAuthCookies } from '../../helpers/authHelpers.js';

/**
 * Register a new organization
 * Creates organization and admin user
 * @route POST /api/v1/organization/auth/register
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with organization, user, and token data
 */
export const registerOrganization = asyncHandler(async (req, res) => {
    const {
        name,
        email,
        password,
        phone,
        address,
        domain,
        subscriptionPlan = 'free',
        industry,
        companySize,
        adminName,
        adminEmail,
        adminPhone,
        adminTitle,
        adminPosition,
        referredBy,
        gdprConsent,
        termsAccepted,
        privacyPolicyAccepted,
        dataProcessingAgreement,
        registrationSource,
        campaignId,
        utmSource,
        utmMedium,
        utmCampaign
    } = req.body;

        // Basic validation
        if (!name || !email || !password) {
            return sendValidationError(res, {
                name: name ? undefined : 'Organization name is required',
                email: email ? undefined : 'Email is required',
                password: password ? undefined : 'Password is required'
            });
        }

        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return sendValidationError(res, { email: 'Invalid email format' });
        }
        const now = new Date();

        // Check if organization already exists
        const existingOrg = await Organization.findOne({
            $or: [
                { email: normalizedEmail },
                ...(domain ? [{ domain: domain.toLowerCase().trim() }] : [])
            ]
        });

        if (existingOrg) {
            return sendError(res, 'Organization with this email or domain already exists', 400, 'ORGANIZATION_EXISTS');
        }

        // Generate email verification token
        const { token: verificationToken, expires: verificationExpires } = generateVerificationTokenWithExpiry(24);

        // Create organization
        const organization = new Organization({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone?.trim(),
            address: address || {},
            domain: domain?.toLowerCase().trim(),
            subscriptionPlan,
            industry,
            companySize,
            emailVerified: false,
            emailVerificationToken: verificationToken,
            emailVerificationExpires: verificationExpires,
            referredBy,
            gdprConsent,
            gdprConsentDate: gdprConsent ? now : null,
            termsAccepted,
            termsAcceptedDate: termsAccepted ? now : null,
            privacyPolicyAccepted,
            privacyPolicyAcceptedDate: privacyPolicyAccepted ? now : null,
            dataProcessingAgreement: {
                accepted: dataProcessingAgreement,
                acceptedDate: dataProcessingAgreement ? now : null
            },
            registrationSource,
            registrationMetadata: {
                ipAddress: req.ip || req.connection.remoteAddress,
                userAgent: req.headers['user-agent'],
                campaignId,
                utmSource,
                utmMedium,
                utmCampaign
            },
            isActive: true,
            settings: {
                allowEmployeeRegistration: true,
                requireEmailVerification: true,
                allowSelfService: true
            }
        });

        await organization.save();
        logger.info('Organization created', { 
            organizationId: organization._id, 
            name: organization.name 
        });

        // Determine admin email
        const adminEmailToUse = adminEmail ? normalizeEmail(adminEmail) : normalizedEmail;
        if (!adminEmailToUse) {
            return sendValidationError(res, { adminEmail: 'Invalid admin email format' });
        }
        const adminNameToUse = (adminName && adminName.trim()) ? adminName.trim() : `${name} Admin`;

        // Check if admin email already exists
        const existingAdmin = await User.findOne({ 
            email: adminEmailToUse,
            organizationId: organization._id 
        });
        if (existingAdmin) {
            await Organization.findByIdAndDelete(organization._id);
            return sendError(res, 'Admin email already exists in this organization', 400, 'ADMIN_EMAIL_EXISTS');
        }

        // Generate admin email verification token
        const { token: adminVerificationToken, expires: adminVerificationExpires } = generateVerificationTokenWithExpiry(24);

        // Create admin user
        const adminUser = new User({
            name: adminNameToUse,
            email: adminEmailToUse,
            password: password,
            phone: adminPhone?.trim(),
            title: adminTitle?.trim(),
            position: adminPosition?.trim(),
            role: 'admin',
            organizationId: organization._id,
            isActive: true,
            emailVerified: false,
            emailVerificationToken: adminVerificationToken,
            emailVerificationExpires: adminVerificationExpires
        });

        await adminUser.save();
        logger.info('Admin user created', { 
            userId: adminUser._id, 
            organizationId: organization._id 
        });

        // Send welcome email
        try {
            const baseUrl = process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173';
            await sendOrganizationWelcomeEmail(
                normalizedEmail,
                organization.name,
                adminNameToUse,
                verificationToken,
                baseUrl
            );
            logger.info('Welcome email sent', { email: normalizedEmail });
        } catch (emailError) {
            logger.error('Failed to send welcome email', { 
                error: emailError.message,
                email: normalizedEmail
            });
        }

        // Generate tokens
        const tokens = generateToken(adminUser._id, adminUser.role, organization._id, res);

        return sendSuccess(res, {
            organization: {
                id: organization._id,
                name: organization.name,
                email: organization.email
            },
            user: {
                id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role
            },
            token: tokens.token || tokens.accessToken,
            refreshToken: tokens.refreshToken,
            csrfToken: tokens.csrfToken,
            message: 'Organization registered successfully. Please check your email to verify your account.'
        }, 'Registration successful', 201);
});

/**
 * Login organization admin
 * Authenticates admin user and returns organization context
 * @route POST /api/v1/organization/auth/login
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with token, user, and organization data
 */
export const loginOrganization = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const requestId = req.id;

    // CODE QUALITY FIX: Validation is handled by middleware (authValidations.login)
    // No need to duplicate validation here - middleware already validates email format and required fields
    
    // Normalize email
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        // This should rarely happen as middleware validates, but keep as safety check
        return sendValidationError(res, { email: 'Invalid email format' });
    }

    logger.debug('Organization login attempt', { requestId, email: normalizedEmail });

    // BUG FIX: Find user first, then get organization from user
    // This is more reliable than trying to find organization first
    // Organization login is for org admins, so we find the user and their organization
    const user = await User.findOne({ email: normalizedEmail }).select('+password');

    if (!user) {
        logger.warn('Organization login failed: User not found', { requestId, email: normalizedEmail });
        // CODE QUALITY FIX: Standardized error message across all login endpoints
        return sendUnauthorized(res, 'Invalid email or password');
    }

    // Get organization from user (this is the user's organization)
    // BUG FIX: Check isActive when fetching organization
    const organization = await Organization.findOne({
        _id: user.organizationId,
        isActive: true
    }).select('_id name email domain');

    if (!organization) {
        // Check if organization exists but is inactive
        const inactiveOrg = await Organization.findById(user.organizationId);
        if (inactiveOrg && !inactiveOrg.isActive) {
            logger.warn('Organization login failed: Organization inactive', { 
                requestId, 
                organizationId: user.organizationId,
                userId: user._id,
                email: normalizedEmail
            });
            return sendForbidden(res, 'Organization is inactive. Please contact support.');
        }
        logger.error('Organization not found for user', { 
            requestId, 
            userId: user._id, 
            organizationId: user.organizationId,
            email: normalizedEmail
        });
        return sendError(res, 'Organization not found', 404, 'ORGANIZATION_NOT_FOUND');
    }

    // Check if account is locked
    if (isAccountLocked(user)) {
        const lockoutMessage = getLockoutMessage(user);
        logger.warn('Organization login failed: Account locked', { 
            requestId, 
            email: normalizedEmail, 
            userId: user._id,
            lockUntil: user.lockUntil 
        });
        return sendForbidden(res, lockoutMessage);
    }

    // Verify password
    logger.debug('Comparing password', { requestId, userId: user._id });
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
        // Handle failed login attempt (account lockout)
        await handleFailedLogin(user);
        logger.warn('Organization login failed: Invalid password', { 
            requestId, 
            email: normalizedEmail, 
            userId: user._id,
            attempts: user.loginAttempts 
        });
        // CODE QUALITY FIX: Standardized error message across all login endpoints
        return sendUnauthorized(res, 'Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
        logger.warn('Organization login failed: Account inactive', { requestId, email: normalizedEmail, userId: user._id });
        // CODE QUALITY FIX: Standardized error message across all login endpoints
        return sendForbidden(res, 'Your account is inactive. Please contact administrator.');
    }

    // Organization is already fetched and verified as active above

    // Reset login attempts on successful login
    await resetLoginAttempts(user);

    // Generate tokens
    const tokens = generateToken(user._id, user.role, organization._id, res);

    logger.info('Organization admin logged in', { 
        requestId,
        userId: user._id, 
        organizationId: organization._id 
    });

    // CODE QUALITY FIX: Unified response structure across all login endpoints
    // Structure: { token, user/employee, organization? (for org login), refreshToken?, csrfToken? }
    const response = {
        token: tokens.token || tokens.accessToken,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        },
        organization: {
            id: organization._id,
            name: organization.name,
            email: organization.email
        }
    };
    
    // Include refresh token and CSRF token in response for cross-site scenarios
    if (tokens.refreshToken) {
        response.refreshToken = tokens.refreshToken;
    }
    if (tokens.csrfToken) {
        response.csrfToken = tokens.csrfToken;
    }
    
    return sendSuccess(res, response, 'Login successful');
});

/**
 * Check organization by email domain and determine login type
 * Smart login routing: Determines if email should go to organization login,
 * employee/admin login, or requires manual selection
 * @route GET /api/v1/organization/auth/check-email
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with login type and organization information
 */
export const checkOrganizationByEmail = asyncHandler(async (req, res) => {
    const { email } = req.query;
    const requestId = req.id;

    if (!email || !email.includes('@')) {
        return sendValidationError(res, { email: 'Valid email is required' });
    }

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        return sendValidationError(res, { email: 'Invalid email format' });
    }

    const emailDomain = normalizedEmail.split('@')[1];
    
    // Rule 1: Check if employee exists first (even for Gmail) - employees take priority
    const employee = await Employee.findOne({ 
        email: normalizedEmail 
    }).populate('organizationId', 'name email domain _id');

    if (employee && employee.organizationId) {
        // Employee exists - always use employee/admin login, even for Gmail
        logger.debug('Employee found - takes priority over Gmail rule', { requestId, email: normalizedEmail, organizationId: employee.organizationId._id });
        return sendSuccess(res, {
            found: true,
            loginType: 'employee_admin',
            reason: 'employee_exists',
            organization: {
                id: employee.organizationId._id,
                name: employee.organizationId.name,
                email: employee.organizationId.email,
                domain: employee.organizationId.domain
            },
            message: 'Employee account found. Please use Employee/Admin Login.'
        }, 'Employee found - use employee/admin login');
    }

    // Rule 1b: Gmail emails go to Organization login (only if no employee found)
    if (emailDomain === 'gmail.com') {
        logger.debug('Gmail email detected (no employee found)', { requestId, email: normalizedEmail });
        return sendSuccess(res, {
            found: true,
            loginType: 'organization',
            reason: 'gmail_domain',
            organization: null,
            message: 'Gmail email detected. Please use Organization Login.'
        }, 'Gmail email - use organization login');
    }
    
    // Rule 2: Check if organization exists with this email or domain
    const organization = await Organization.findOne({
        $or: [
            { email: normalizedEmail },
            { domain: emailDomain }
        ],
        isActive: true
    }).select('name email domain _id');

    if (organization) {
        // If organization email matches exactly, it's organization login
        if (organization.email === normalizedEmail) {
            logger.debug('Organization email match', { requestId, email: normalizedEmail, organizationId: organization._id });
            return sendSuccess(res, {
                found: true,
                loginType: 'organization',
                reason: 'organization_email_match',
                organization: {
                    id: organization._id,
                    name: organization.name,
                    email: organization.email,
                    domain: organization.domain
                },
                message: 'Organization email detected. Please use Organization Login.'
            }, 'Organization email found');
        }
        
        // If domain matches, it's employee/admin login
        if (organization.domain === emailDomain) {
            logger.debug('Organization domain match', { requestId, email: normalizedEmail, domain: emailDomain, organizationId: organization._id });
            return sendSuccess(res, {
                found: true,
                loginType: 'employee_admin',
                reason: 'organization_domain_match',
                organization: {
                    id: organization._id,
                    name: organization.name,
                    email: organization.email,
                    domain: organization.domain
                },
                message: 'Organization domain detected. Please use Employee/Admin Login.'
            }, 'Organization domain found');
        }
    }

    // Rule 3: Check if user exists with this email (to find organization)
    const user = await User.findOne({ 
        email: normalizedEmail 
    }).populate('organizationId', 'name email domain _id');

    if (user && user.organizationId) {
        // User exists - check if their email domain matches organization domain
        const userEmailDomain = normalizedEmail.split('@')[1];
        if (user.organizationId.domain === userEmailDomain) {
            logger.debug('User found with organization domain', { requestId, email: normalizedEmail, organizationId: user.organizationId._id });
            return sendSuccess(res, {
                found: true,
                loginType: 'employee_admin',
                reason: 'user_with_organization_domain',
                organization: {
                    id: user.organizationId._id,
                    name: user.organizationId.name,
                    email: user.organizationId.email,
                    domain: user.organizationId.domain
                },
                message: 'User found with organization domain. Please use Employee/Admin Login.'
            }, 'User found with organization domain');
        }
    }

    // Note: Employee check moved to Rule 1 (before Gmail check) for priority

    // Rule 5: No match found - return unknown
    logger.debug('No organization match found', { requestId, email: normalizedEmail, domain: emailDomain });
    return sendSuccess(res, {
        found: false,
        loginType: 'unknown',
        reason: 'no_match',
        organization: null,
        message: 'No organization found for this email. Please select login type manually.'
    }, 'No organization found - manual selection required');
});
