import User from "../../models/user.model.js";
import { generateToken } from "../../helpers/utils.js";
import logger from "../../helpers/logger.js";
import sendWelcomeEmail from "../../helpers/emailSender.js";
import asyncHandler from "../../helpers/asyncHandler.js";
import { sendSuccess, sendError, sendValidationError, sendInternalError, sendUnauthorized, sendForbidden } from "../../helpers/responseHelper.js";
import { PLATFORM_ROLES, isPlatformOperatorRoles } from "../../config/identity.constants.js";
import { normalizeEmail, isAccountLocked, handleFailedLogin, resetLoginAttempts, getLockoutMessage, clearAuthCookies } from "../../helpers/authHelpers.js";
import { getDashboardRouteForUser } from "../../helpers/dashboardRouteHelper.js";


/**
 * @swagger
 * /api/v1/admin/auth/register:
 *   post:
 *     summary: Register a new admin user
 *     description: Creates a new admin user account. In production, requires admin authentication. In development, open registration is allowed.
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
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
 *               - organizationId
 *             properties:
 *               name:
 *                 type: string
 *                 example: John Doe
 *                 description: Full name of the admin user
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *                 description: Email address (must be unique per organization)
 *               password:
 *                 type: string
 *                 format: password
 *                 minLength: 8
 *                 example: SecurePass123!
 *                 description: Password (min 8 characters, must contain uppercase, lowercase, number, and special character)
 *               organizationId:
 *                 type: string
 *                 format: objectId
 *                 example: 507f1f77bcf86cd799439011
 *                 description: Organization ID (required if not authenticated as admin)
 *     responses:
 *       201:
 *         description: Admin user registered successfully
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
 *                   example: Registration successful
 *                 user:
 *                   $ref: '#/components/schemas/User'
 *                 token:
 *                   type: string
 *                   description: JWT access token
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token (optional)
 *                 csrfToken:
 *                   type: string
 *                   description: CSRF token (optional)
 *                 emailSent:
 *                   type: boolean
 *                   example: true
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       409:
 *         description: Email already registered
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               example:
 *                 success: false
 *                 message: Email already registered in this organization
 *                 code: DUPLICATE_EMAIL
 */
export const registerUser = asyncHandler(async (req, res) => {
    const { name, email, password } = req.body;
    const requestId = req.id;

    // Basic validation
    if (!name || !email || !password) {
        return sendValidationError(res, {
            name: name ? undefined : 'Name is required',
            email: email ? undefined : 'Email is required',
            password: password ? undefined : 'Password is required'
        });
    }

        // Get organizationId from request (if admin is creating another admin) or from body
        const organizationId = req.user?.organizationId || req.body.organizationId;
        
        if (!organizationId) {
            return sendError(res, 'Organization ID is required. Please register an organization first.', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Normalize email
        const normalizedEmail = normalizeEmail(email);
        if (!normalizedEmail) {
            return sendValidationError(res, { email: 'Invalid email format' });
        }

        // Check if user already exists in this organization
        const existingUser = await User.findOne({ email: normalizedEmail, organizationId });
        if (existingUser) {
            return sendError(res, 'Email already registered in this organization', 409, 'DUPLICATE_EMAIL');
        }

        // Create new user (defaults to admin role as per model defaults/config)
        const newUser = new User({ 
            name, 
            email: normalizedEmail, 
            password,
            organizationId,
            role: 'admin',
            roles: [PLATFORM_ROLES.HR_ADMIN]
        });
        await newUser.save();
        
        logger.info('Admin user registered', { requestId, userId: newUser._id, email: normalizedEmail, organizationId });

        // Send welcome email with password reset link (secure approach)
        // In production, send password reset link instead of plain text password
        let emailSent = false;
        try {
            const { queueWelcomeEmail } = await import('../../helpers/emailQueue.js');
            
            if (process.env.NODE_ENV === 'production') {
                // In production, generate password reset token and send reset link
                const crypto = await import('crypto');
                const resetToken = crypto.randomBytes(32).toString('hex');
                newUser.resetPasswordToken = resetToken;
                newUser.resetPasswordExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours
                await newUser.save();
                
                // Queue password reset email with link
                const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;
                await queueWelcomeEmail(email, name, null, resetUrl);
                emailSent = true;
                logger.info('Password reset email queued for admin user', { email });
            } else {
                // In development, queue plain text password email
                await queueWelcomeEmail(email, name, password);
                emailSent = true;
                logger.info('Welcome email queued for admin user', { email });
            }
        } catch (emailError) {
            logger.error('Error queueing welcome email to admin', { 
                email, 
                error: emailError.message,
                stack: emailError.stack 
            });
            // Don't fail registration if email queue fails - try direct send as fallback
            try {
                if (process.env.NODE_ENV === 'production') {
                    const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${newUser.resetPasswordToken}`;
                    await sendWelcomeEmail(email, name, null, resetUrl);
                } else {
                    await sendWelcomeEmail(email, name, password);
                }
                emailSent = true;
            } catch (fallbackError) {
                logger.error('Fallback email send also failed', { error: fallbackError.message });
            }
        }

        // Generate JWT token with organizationId
        const passwordChangedAt = newUser.passwordChangedAt || null;
        const tokenResult = generateToken(newUser._id, newUser.role, newUser.organizationId, res, passwordChangedAt);
        const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
        const refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
        const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

        // Return success response with user data
        const response = {
            user: {
                id: newUser._id,
                name: newUser.name,
                email: newUser.email,
                role: newUser.role
            },
            emailSent,
            token
        };

        if (refreshToken) {
            response.refreshToken = refreshToken;
        }
        if (csrfToken) {
            response.csrfToken = csrfToken;
        }

        return sendSuccess(res, response, 'Registration successful', 201);
});

/**
 * @swagger
 * /api/v1/admin/auth/login:
 *   post:
 *     summary: Login as admin user
 *     description: Authenticates an admin user and returns JWT tokens. Account lockout applies after failed attempts.
 *     tags: [Admin Authentication]
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
 *                 description: Admin email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: AdminPass123!
 *                 description: Admin password
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
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token (optional)
 *                 csrfToken:
 *                   type: string
 *                   description: CSRF token (optional)
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       403:
 *         description: Account locked or inactive
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Error'
 *               example:
 *                 success: false
 *                 message: Account is locked. Please try again later.
 *                 code: ACCOUNT_LOCKED
 */
export const loginUser = asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const requestId = req.id;

    // CODE QUALITY FIX: Validation is handled by middleware (authValidations.login)
    // No need to duplicate validation here - middleware already validates email format and required fields
    
    // Normalize email for case-insensitive lookup
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) {
        // This should rarely happen as middleware validates, but keep as safety check
        return sendValidationError(res, { email: 'Invalid email format' });
    }

    logger.debug('Admin login attempt', { requestId, email: normalizedEmail });
    
    // SECURITY FIX: Only search User collection for admin login
    // Employees must use the employee login endpoint
    const user = await User.findOne({ 
        email: normalizedEmail
    }).select('+password');

    // Authentication checks
    if (!user) {
        logger.warn('Admin login failed: User not found', { requestId, email: normalizedEmail });
        // CODE QUALITY FIX: Standardized error message across all login endpoints
        return sendUnauthorized(res, 'Invalid email or password');
    }

    if (user.role === 'platform' || isPlatformOperatorRoles(user.roles)) {
        logger.warn('Admin login blocked for platform operator', { requestId, email: normalizedEmail });
        return sendUnauthorized(res, 'Invalid email or password');
    }

    // Check if account is locked
    if (isAccountLocked(user)) {
        const lockoutMessage = getLockoutMessage(user);
        logger.warn('Admin login failed: Account locked', { 
            requestId, 
            email: normalizedEmail, 
            userId: user._id,
            lockUntil: user.lockUntil 
        });
        return sendForbidden(res, lockoutMessage);
    }

    // Check if user is active
    if (!user.isActive) {
        logger.warn('Admin login failed: Account inactive', { requestId, email: normalizedEmail, userId: user._id });
        // CODE QUALITY FIX: Standardized error message across all login endpoints
        return sendForbidden(res, 'Your account is inactive. Please contact administrator.');
    }

    // Verify password
    logger.debug('Comparing password', { requestId, userId: user._id });
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
        // Handle failed login attempt (account lockout)
        await handleFailedLogin(user);
        logger.warn('Admin login failed: Invalid password', { 
            requestId, 
            email: normalizedEmail, 
            userId: user._id,
            attempts: user.loginAttempts 
        });
        // CODE QUALITY FIX: Standardized error message across all login endpoints
        return sendUnauthorized(res, 'Invalid email or password');
    }

    // Reset login attempts on successful login
    await resetLoginAttempts(user);
    
    const organizationId = user.organizationId;
    logger.info('Admin login successful', { 
        requestId, 
        email: normalizedEmail, 
        userId: user._id, 
        organizationId 
    });

    // Generate token with organizationId
    const passwordChangedAt = user.passwordChangedAt || null;
    const tokenResult = generateToken(user._id, 'admin', organizationId, res, passwordChangedAt);
    const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
    const refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
    const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;
    
    // Get dashboard route based on role, position, and department
    let dashboardRoute = '/dashboard-admin'; // Default fallback
    try {
        dashboardRoute = await getDashboardRouteForUser(
            user._id,
            'admin',
            organizationId,
            user.email
        );
    } catch (dashboardError) {
        logger.warn('Failed to get dashboard route, using default', {
            userId: user._id,
            error: dashboardError.message
        });
    }
    
    const userData = {
        id: user._id,
        name: user.name,
        email: user.email,
        role: 'admin'
    };

    let timezoneContext = null;
    try {
        const { getTimezoneContext } = await import('../../helpers/organizationTimezoneService.js');
        timezoneContext = await getTimezoneContext(organizationId);
    } catch (tzError) {
        logger.warn('Failed to load timezone on admin login', { error: tzError.message });
    }

    // CODE QUALITY FIX: Unified response structure across all login endpoints
    // Structure: { token, user/employee, dashboardRoute, refreshToken?, csrfToken? }
    const response = {
        token,
        dashboardRoute, // Add dashboard route for automatic redirection
        timezone: timezoneContext?.timezone || 'UTC',
        timezoneContext,
        user: userData
    };
    
    // Include refresh token and CSRF token in response for cross-site scenarios
    if (refreshToken) {
        response.refreshToken = refreshToken;
    }
    if (csrfToken) {
        response.csrfToken = csrfToken;
    }
    
    return sendSuccess(res, response, 'Login successful');
});

/**
 * @swagger
 * /api/v1/admin/auth/logout:
 *   post:
 *     summary: Logout admin user
 *     description: Logs out the current admin user and clears authentication cookies
 *     tags: [Admin Authentication]
 *     security:
 *       - bearerAuth: []
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Logout successful
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
 *                   example: Logout successful
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
export const logoutUser = asyncHandler(async (req, res) => {
    const requestId = req.id;
    
    // Clear all authentication cookies and CSRF tokens
    await clearAuthCookies(res, req);

    logger.info('Admin logout successful', { requestId, userId: req.user?._id });
    
    return sendSuccess(res, null, 'Logout successful');
});
