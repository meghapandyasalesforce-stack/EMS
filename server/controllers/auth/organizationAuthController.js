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
import { getDashboardRouteForUser } from '../../helpers/dashboardRouteHelper.js';
import { PLATFORM_ROLES } from '../../config/identity.constants.js';

/**
 * @swagger
 * /api/v1/organization/auth/register:
 *   post:
 *     summary: Register a new organization
 *     description: Creates a new organization with an admin user account. This is the entry point for multi-tenant setup.
 *     tags: [Organization Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - email
 *               - password
 *               - termsAccepted
 *               - privacyPolicyAccepted
 *             properties:
 *               name:
 *                 type: string
 *                 example: Acme Corporation
 *               email:
 *                 type: string
 *                 format: email
 *                 example: contact@acme.com
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *               domain:
 *                 type: string
 *                 example: acme.com
 *               subscriptionPlan:
 *                 type: string
 *                 enum: [free, basic, premium, enterprise]
 *                 default: free
 *               termsAccepted:
 *                 type: boolean
 *                 example: true
 *               privacyPolicyAccepted:
 *                 type: boolean
 *                 example: true
 *     responses:
 *       201:
 *         description: Organization registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       409:
 *         description: Organization or email already exists
 */
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
            roles: [PLATFORM_ROLES.ORG_OWNER, PLATFORM_ROLES.HR_ADMIN],
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

        // Create linked Admin Employee as org-chart root (managerId: null). Idempotent; no second User.
        let adminEmployeeProfile = null;
        try {
            const { ensureOrgOwnerEmployeeRoot } = await import('../../helpers/identityService.js');
            const ensureResult = await ensureOrgOwnerEmployeeRoot(adminUser, organization._id, {
                jobTitle: adminTitle?.trim() || undefined,
                position: adminPosition?.trim() || undefined,
            });
            if (ensureResult.ok) {
                adminEmployeeProfile = ensureResult.employee;
                logger.info('Admin employee root ensured at registration', {
                    organizationId: organization._id,
                    employeeId: adminEmployeeProfile?._id,
                    created: ensureResult.created,
                });
            } else {
                logger.warn('Admin employee root ensure failed at registration', {
                    organizationId: organization._id,
                    code: ensureResult.code,
                    message: ensureResult.message,
                });
            }
        } catch (ensureError) {
            logger.error('Admin employee root ensure threw at registration', {
                organizationId: organization._id,
                error: ensureError.message,
            });
        }

        // Enable enterprise lifecycle for the new org (org-level, not employee-dependent)
        try {
            const { bootstrapEnterpriseLifecycle } = await import('../../services/lifecycleEnterpriseBootstrap.js');
            const { seedDefaultLifecycleForms } = await import('../../services/lifecycleDefaultFormsService.js');
            await seedDefaultLifecycleForms(organization._id, { actor: adminUser }).catch(() => {});
            await bootstrapEnterpriseLifecycle(organization._id, { actor: adminUser, req });
            organization.lifecycleEnterpriseEnabled = true;
            organization.lifecycleEnterpriseBootstrappedAt = new Date();
            await organization.save();
            logger.info('Enterprise lifecycle bootstrapped for new organization', {
                organizationId: organization._id,
            });
        } catch (bootstrapError) {
            logger.warn('Enterprise lifecycle bootstrap deferred after registration', {
                organizationId: organization._id,
                error: bootstrapError.message,
            });
        }

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

        // Generate tokens — employeeProfileId is Me only (separate from permanent CEO root)
        const passwordChangedAt = adminUser.passwordChangedAt || adminUser.createdAt;
        const tokens = generateToken(
            adminUser._id,
            adminUser.role,
            organization._id,
            res,
            passwordChangedAt,
            adminUser.employeeProfileId
                ? { employeeProfileId: adminUser.employeeProfileId }
                : null
        );

        return sendSuccess(res, {
            organization: {
                id: organization._id,
                name: organization.name,
                email: organization.email,
                lifecycleEnterpriseEnabled: Boolean(organization.lifecycleEnterpriseEnabled),
            },
            user: {
                id: adminUser._id,
                name: adminUser.name,
                email: adminUser.email,
                role: adminUser.role,
                employeeProfileId: adminUser.employeeProfileId || null,
            },
            employee: adminEmployeeProfile
                ? {
                    id: adminEmployeeProfile._id,
                    employeeId: adminEmployeeProfile.employeeId,
                    managerId: adminEmployeeProfile.managerId ?? null,
                    isOrgOwnerRoot: true,
                }
                : null,
            token: tokens.token || tokens.accessToken,
            refreshToken: tokens.refreshToken,
            csrfToken: tokens.csrfToken,
            message: 'Organization registered successfully. Please check your email to verify your account.'
        }, 'Registration successful', 201);
});

/**
 * @swagger
 * /api/v1/organization/auth/login:
 *   post:
 *     summary: Login as organization admin
 *     description: Authenticates an organization admin user and returns JWT tokens with organization context. Account lockout applies after failed attempts.
 *     tags: [Organization Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - password
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *                 example: admin@example.com
 *                 description: Organization admin email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: AdminPass123!
 *                 description: Organization admin password
 *     responses:
 *       200:
 *         description: Login successful
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Login successful
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 organization:
 *                   $ref: '#/components/schemas/Organization'
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token (optional)
 *                 csrfToken:
 *                   type: string
 *                   description: CSRF token (optional)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Account locked, inactive, or organization inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 */
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

    // One-time idempotent ensure: permanent Admin/CEO root if missing (does not set Me)
    let employeeProfileId = user.employeeProfileId || null;
    try {
        const { ensureOrgOwnerEmployeeRoot, isOrgOwnerUser, findOrgOwnerEmployeeProfile } = await import('../../helpers/identityService.js');
        if (isOrgOwnerUser(user)) {
            const ensureResult = await ensureOrgOwnerEmployeeRoot(user, organization._id);
            if (ensureResult.ok && ensureResult.created) {
                logger.info('Created org-owner employee root on login', {
                    requestId,
                    userId: user._id,
                    employeeId: ensureResult.employee?._id,
                    organizationId: organization._id,
                });
            }
            // JWT Me claim = linked Me Employee only (never the CEO root)
            const meProfile = await findOrgOwnerEmployeeProfile(user, organization._id);
            employeeProfileId = meProfile?._id || user.employeeProfileId || null;
        }
    } catch (ensureError) {
        logger.warn('Org-owner employee root ensure failed on login', {
            requestId,
            userId: user._id,
            error: ensureError.message,
        });
    }

    // Generate tokens
    const passwordChangedAt = user.passwordChangedAt || user.createdAt;
    const tokens = generateToken(
        user._id,
        user.role,
        organization._id,
        res,
        passwordChangedAt,
        employeeProfileId ? { employeeProfileId } : null
    );

    // Get dashboard route based on role, position, and department
    let dashboardRoute = '/organization/dashboard'; // Default for organization login
    try {
        dashboardRoute = await getDashboardRouteForUser(
            user._id,
            'admin',
            organization._id,
            user.email
        );
    } catch (dashboardError) {
        logger.warn('Failed to get dashboard route, using default', {
            userId: user._id,
            error: dashboardError.message
        });
    }

    logger.info('Organization admin logged in', { 
        requestId,
        userId: user._id, 
        organizationId: organization._id 
    });

    // CODE QUALITY FIX: Unified response structure across all login endpoints
    // Structure: { token, user/employee, dashboardRoute, organization? (for org login), refreshToken?, csrfToken? }
    const response = {
        token: tokens.token || tokens.accessToken,
        dashboardRoute, // Add dashboard route for automatic redirection
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

    // Extract email domain safely
    const emailParts = normalizedEmail.split('@');
    if (emailParts.length !== 2 || !emailParts[1]) {
        return sendValidationError(res, { email: 'Invalid email format - missing domain' });
    }
    const emailDomain = emailParts[1].toLowerCase().trim();
    
    // Rule 1: Check if employee exists first (even for Gmail) - employees take priority
    try {
        const employee = await Employee.findOne({ 
            email: normalizedEmail 
        }).populate('organizationId', 'name email domain _id');

        if (employee && employee.organizationId && employee.organizationId._id) {
            // Employee exists - always use employee/admin login, even for Gmail
            logger.debug('Employee found - takes priority over Gmail rule', { 
                requestId, 
                email: normalizedEmail, 
                organizationId: employee.organizationId._id 
            });
            return sendSuccess(res, {
                found: true,
                loginType: 'employee_admin',
                reason: 'employee_exists',
                organization: {
                    id: employee.organizationId._id,
                    name: employee.organizationId.name || null,
                    email: employee.organizationId.email || null,
                    domain: employee.organizationId.domain || null
                },
                message: 'Employee account found. Please use Employee/Admin Login.'
            }, 'Employee found - use employee/admin login');
        }
    } catch (employeeError) {
        // Log error but continue to check other rules
        logger.error('Error checking employee for email', { 
            requestId, 
            email: normalizedEmail, 
            error: employeeError.message 
        });
        // Continue to next rule instead of failing
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
    try {
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
    } catch (orgError) {
        // Log error but continue to next rule
        logger.error('Error checking organization for email', { 
            requestId, 
            email: normalizedEmail, 
            domain: emailDomain,
            error: orgError.message 
        });
        // Continue to next rule instead of failing
    }

    // Rule 3: Check if user exists with this email (to find organization)
    try {
        const user = await User.findOne({ 
            email: normalizedEmail 
        }).populate('organizationId', 'name email domain _id');

        if (user && user.organizationId && user.organizationId._id) {
            // User exists - check if their email domain matches organization domain
            const userEmailDomain = normalizedEmail.split('@')[1];
            if (user.organizationId.domain === userEmailDomain) {
                logger.debug('User found with organization domain', { 
                    requestId, 
                    email: normalizedEmail, 
                    organizationId: user.organizationId._id 
                });
                return sendSuccess(res, {
                    found: true,
                    loginType: 'employee_admin',
                    reason: 'user_with_organization_domain',
                    organization: {
                        id: user.organizationId._id,
                        name: user.organizationId.name || null,
                        email: user.organizationId.email || null,
                        domain: user.organizationId.domain || null
                    },
                    message: 'User found with organization domain. Please use Employee/Admin Login.'
                }, 'User found with organization domain');
            }
        }
    } catch (userError) {
        // Log error but continue to next rule
        logger.error('Error checking user for email', { 
            requestId, 
            email: normalizedEmail, 
            error: userError.message 
        });
        // Continue to next rule instead of failing
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
