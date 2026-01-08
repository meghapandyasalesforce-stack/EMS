import Employee from '../../models/employee.model.js';
import Organization from '../../models/organization.model.js';
import { generateToken, generateSecurePassword } from '../../helpers/utils.js';
import bcrypt from 'bcryptjs';
import mongoose from "mongoose";
import sendWelcomeEmail from '../../helpers/emailSender.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendValidationError, sendInternalError, sendNotFound, sendUnauthorized, sendForbidden } from '../../helpers/responseHelper.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import { normalizeEmail, isAccountLocked, handleFailedLogin, resetLoginAttempts, getLockoutMessage, clearAuthCookies } from '../../helpers/authHelpers.js';
import { getDashboardRouteForUser } from '../../helpers/dashboardRouteHelper.js';


// Generate token with employeeId instead of email
import Payroll from '../../models/payroll.model.js'; // Make sure this path is correct


// Register new employee

export const registerEmployee = async (req, res) => {
    try {
        const {
            name, lastName, email, password,
            position, department, manager,
            jobTitle, jobCategory, salary
        } = req.body;

        // Validate required fields (password is optional - will be generated if not provided)
        if (!name || !lastName || !email || !position ||
            !department || !manager || !jobTitle || !jobCategory || !salary) {
            return sendValidationError(res, 
                'All fields are required (password will be auto-generated if not provided)'
            );
        }
        
        // Generate secure password if not provided
        const employeePassword = password || generateSecurePassword(16);
        logger.info('Password generation', { 
            provided: !!password, 
            generated: !password,
            email: email.toLowerCase().trim()
        });

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendValidationError(res, { email: 'Invalid email format' });
        }

        // Validate position value
        const validPositions = ["Intern", "Junior", "Mid-Level", "Senior", "Lead", "Supervisor", "Manager", "Director", "VP", "CTO", "CFO", "CEO", "Developer"];
        if (!validPositions.includes(position)) {
            return sendValidationError(res, { position: `Invalid position. Must be one of: ${validPositions.join(', ')}` });
        }

        // Get organizationId from authenticated admin or request body
        const organizationId = req.user?.organizationId || req.employee?.organizationId || req.body.organizationId;
        
        if (!organizationId) {
            return sendError(res, 
                'Organization ID is required. Please ensure you are authenticated as an admin.',
                400,
                'MISSING_ORGANIZATION_ID'
            );
        }

        // Normalize email (lowercase and trim) for case-insensitive check
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check if employee already exists in this organization (use direct query for better performance)
        const existingEmployee = await Employee.findOne({ 
            email: normalizedEmail,
            organizationId
        });
        if (existingEmployee) {
            return sendError(res, 
                'An employee with this email already exists in this organization. Please use a different email address.',
                409,
                'DUPLICATE_EMAIL'
            );
        }

        // Password will be hashed automatically by the model's pre-save hook
        // No need to hash manually
        
        // Generate unique employee ID: EMP-{first3lettersOfName}-{joiningYear}-{random4Digits}
        const namePrefix = name.substring(0, 3).toUpperCase();
        const joiningYear = new Date().getFullYear();
        let employeeId;
        let isUnique = false;
        let attempts = 0;
        const maxAttempts = 10;
        
        // Ensure unique employee ID within organization
        while (!isUnique && attempts < maxAttempts) {
            const random = Math.floor(1000 + Math.random() * 9000);
            employeeId = `EMP-${namePrefix}-${joiningYear}-${random}`;
            const existing = await Employee.findOne({ employeeId, organizationId });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }
        
        if (!isUnique) {
            return sendInternalError(res, 'Failed to generate unique employee ID. Please try again.');
        }

        // Create the employee (normalize email to lowercase)
        const employee = new Employee({
            organizationId, // Add organizationId
            name,
            lastName,
            email: normalizedEmail, // Use normalized email
            password: employeePassword, // Will be hashed automatically by model's pre-save hook
            position,
            department,
            manager,
            jobTitle,
            jobCategory,
            salary,
            role: 'employee',
            mustResetPassword: true,
            employeeId: employeeId // Set the auto-generated ID
        });

        // Save employee - this will trigger password hashing
        try {
            await employee.save();
        } catch (saveError) {
            // Handle MongoDB duplicate key error (E11000)
            if (saveError.code === 11000) {
                const duplicateField = Object.keys(saveError.keyPattern || {})[0] || 'email';
                logger.error('Duplicate employee creation attempt', {
                    email: normalizedEmail,
                    duplicateField,
                    error: saveError.message
                });
                return sendError(res, 
                    `An employee with this ${duplicateField} already exists. Please use a different ${duplicateField}.`,
                    409,
                    'DUPLICATE_FIELD'
                );
            }
            // Re-throw other errors
            throw saveError;
        }
        
        // Send welcome email BEFORE creating payroll (so if email fails, we can still rollback)
        let emailSent = false;
        let emailErrorMessage = null;
        try {
            await sendWelcomeEmail(normalizedEmail, `${name} ${lastName}`, employeePassword);
            emailSent = true;
            logger.info('Welcome email sent successfully', { 
                email: normalizedEmail, 
                employeeId: employee._id,
                employeeName: `${name} ${lastName}` 
            });
        } catch (emailError) {
            logger.error('Failed to send welcome email', { 
                email: normalizedEmail, 
                employeeId: employee._id,
                employeeName: `${name} ${lastName}`,
                error: emailError.message,
                stack: emailError.stack,
                errorCode: emailError.code,
                errorResponse: emailError.response 
            });
            emailErrorMessage = emailError.message || 'Email service unavailable';
            // Don't fail registration - employee is already created
        }
        
        // Create associated default payroll (only if employee was created)
        try {
            const currentDate = new Date();
            const defaultPayroll = {
                organizationId, // Add organizationId
                employeeId: employee._id,
                month: currentDate.toLocaleString('default', { month: 'long' }),
                year: currentDate.getFullYear(),
                basicSalary: salary,
                earnings: {
                    basicWage: salary,
                    houseRentAllowance: 0,
                    overtime: 0,
                    gratuity: 0,
                    specialAllowance: 0,
                    pfEmployer: 0,
                    esiEmployer: 0
                },
                deductions: {
                    pfEmployee: 0,
                    esiEmployee: 0,
                    tax: 0,
                    otherDeductions: 0
                },
                ctc: 0,
                inHandSalary: 0,
                status: 'Pending'
            };

            await Payroll.create(defaultPayroll);
        } catch (payrollError) {
            // Log payroll creation error but don't fail - employee is already created
            logger.error('Failed to create default payroll', {
                employeeId: employee._id,
                error: payrollError.message,
                stack: payrollError.stack
            });
        }

        // SECURITY FIX: Do NOT generate tokens when admin creates employee
        // This prevents overwriting the admin's session cookies
        // Employee will get tokens when they log in themselves
        // Only generate tokens if this is self-registration (which shouldn't happen with admin auth)
        const isAdminCreating = !!req.user; // Check if admin is creating (has req.user from isAdminAuthenticated)
        
        let token = undefined;
        let refreshToken = undefined;
        let csrfToken = undefined;
        
        // Only generate tokens if NOT created by admin (self-registration scenario)
        // This should rarely happen since the route requires admin auth, but kept for safety
        if (!isAdminCreating) {
            const tokenResult = generateToken(employee._id, "employee", organizationId, res);
            token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
            refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
            csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;
        }
        
        const response = {
            emailSent,
            ...(emailErrorMessage && { 
                emailWarning: `Welcome email could not be sent: ${emailErrorMessage}`,
                emailError: emailErrorMessage 
            }),
            employee: {
                _id: employee._id,
                name: employee.name,
                lastName: employee.lastName,
                email: employee.email,
                position: employee.position,
                jobTitle: employee.jobTitle,
                employeeId: employee.employeeId
            }
        };
        
        // Only include tokens if they were generated (non-admin registration)
        if (token) {
            response.token = token;
        }
        if (refreshToken) {
            response.refreshToken = refreshToken;
        }
        if (csrfToken) {
            response.csrfToken = csrfToken;
        }
        
        return sendSuccess(res, response, 'Employee registered successfully', 201);
    } catch (error) {
        logger.error('Registration error', { 
            error: error.message, 
            stack: error.stack,
            errorCode: error.code,
            errorName: error.name
        });
        
        // Handle specific error types
        if (error.code === 11000) {
            return sendError(res, 
                'An employee with this email already exists. Please use a different email address.',
                409,
                'DUPLICATE_EMAIL'
            );
        }
        
        return sendInternalError(res, 'Registration failed', error);
    }
};

/**
 * Login employee
 * @route POST /api/v1/employee/auth/login
 * @access Public
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with token and employee data
 */
export const loginEmployee = asyncHandler(async (req, res) => {
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

    logger.debug('Employee login attempt', { requestId, email: normalizedEmail });
    
    // SECURITY FIX: Determine organization from email domain first for scoping
    const emailDomain = normalizedEmail.split('@')[1];
    
    // Find organization by domain (if exists)
    const organization = await Organization.findOne({
        domain: emailDomain,
        isActive: true
    }).select('_id');

    // Find employee with normalized email AND organization scoping
    // Use .select('+password') to include password field (normally excluded for security)
    let employee;
    if (organization) {
        // SECURITY: Only search for employees within the organization that owns the domain
        employee = await Employee.findOne({ 
            email: normalizedEmail,
            organizationId: organization._id
        }).select('+password');
        
        if (!employee) {
            logger.warn('Employee login failed: Employee not found in organization', { 
                requestId, 
                email: normalizedEmail,
                organizationId: organization._id,
                domain: emailDomain
            });
            // Don't reveal if employee exists - generic error for security
            return sendUnauthorized(res, 'Invalid email or password');
        }
    } else {
        // No organization domain found - search globally but log warning
        logger.warn('Employee login: No organization found for email domain', { 
            requestId, 
            email: normalizedEmail, 
            domain: emailDomain 
        });
        employee = await Employee.findOne({ 
            email: normalizedEmail
        }).select('+password');
        
        if (!employee) {
            logger.warn('Employee login failed: Employee not found', { requestId, email: normalizedEmail });
            // Don't reveal if employee exists - generic error for security
            return sendUnauthorized(res, 'Invalid email or password');
        }
    }
    
    // SECURITY: Additional verification - ensure employee's organization matches domain organization
    if (organization && employee.organizationId.toString() !== organization._id.toString()) {
        logger.warn('Employee login failed: Organization mismatch', { 
            requestId, 
            email: normalizedEmail,
            employeeOrganizationId: employee.organizationId,
            expectedOrganizationId: organization._id,
            domain: emailDomain
        });
        return sendUnauthorized(res, 'Invalid email or password');
    }

    logger.debug('Employee found', { requestId, email: normalizedEmail, employeeId: employee._id, active: employee.active });

    // Check if account is locked
    if (isAccountLocked(employee)) {
        const lockoutMessage = getLockoutMessage(employee);
        logger.warn('Employee login failed: Account locked', { 
            requestId, 
            email: normalizedEmail, 
            employeeId: employee._id,
            lockUntil: employee.lockUntil 
        });
        return sendForbidden(res, lockoutMessage);
    }

    if (!employee.active) {
        logger.warn('Employee login failed: Account inactive', { requestId, email: normalizedEmail, employeeId: employee._id });
        return sendForbidden(res, 'Your account is inactive. Please contact HR or Admin.');
    }

    // Use the model's comparePassword method for consistency
    logger.debug('Comparing password', { requestId, employeeId: employee._id });
    const isPasswordValid = await employee.comparePassword(password);
    
    if (!isPasswordValid) {
        // Handle failed login attempt (account lockout)
        await handleFailedLogin(employee);
        logger.warn('Employee login failed: Invalid password', { 
            requestId, 
            email: normalizedEmail, 
            employeeId: employee._id,
            attempts: employee.loginAttempts 
        });
        return sendUnauthorized(res, 'Invalid email or password');
    }
    
    // Reset login attempts on successful login
    await resetLoginAttempts(employee);
    
    logger.info('Employee login successful', { 
        requestId, 
        email: normalizedEmail, 
        employeeId: employee._id, 
        organizationId: employee.organizationId 
    });

    // Generate token with organizationId
    const tokenResult = generateToken(employee._id, "employee", employee.organizationId, res);
    const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
    const refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
    const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

    // Get dashboard route based on role, position, and department
    let dashboardRoute = '/dashboard/employee'; // Default fallback
    try {
        dashboardRoute = await getDashboardRouteForUser(
            employee._id,
            'employee',
            employee.organizationId,
            employee.email
        );
    } catch (dashboardError) {
        logger.warn('Failed to get dashboard route, using default', {
            employeeId: employee._id,
            error: dashboardError.message
        });
    }

    // CODE QUALITY FIX: Unified response structure across all login endpoints
    // Structure: { token, user/employee, dashboardRoute, refreshToken?, csrfToken? }
    const response = {
        token,
        dashboardRoute, // Add dashboard route for automatic redirection
        employee: {
            id: employee._id,
            name: employee.name,
            lastName: employee.lastName,
            email: employee.email,
            employeeId: employee.employeeId,
            position: employee.position,
            department: employee.department,
            jobTitle: employee.jobTitle,
            jobCategory: employee.jobCategory,
            birthDate: employee.birthDate,
            profilePhoto: employee.profilePhoto,
            mustResetPassword: employee.mustResetPassword
        }
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
 * Logout employee
 * @route POST /api/v1/employee/auth/logout
 * @access Private
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response
 */
export const logoutEmployee = asyncHandler(async (req, res) => {
    const requestId = req.id;
    
    // Clear all authentication cookies and CSRF tokens
    await clearAuthCookies(res, req);

    logger.info('Employee logout successful', { requestId, employeeId: req.employee?._id });
    
    return sendSuccess(res, null, 'Logout successful');
});

// Note: getAllEmployees and updateEmployeeStatus have been moved to 
// controllers/admin/employeeManagementController.js for better organization
export const resetEmployeePassword = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return sendValidationError(res, { password: 'Password must be at least 8 characters long' });
        }

        // Find the employee first
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        // Set the new password and mustResetPassword flag
        // The pre-save hook will automatically hash the password when we call save()
        employee.password = newPassword;
        employee.mustResetPassword = false;
        
        // Save the employee - this will trigger the pre-save hook to hash the password
        await employee.save();

        // Clear authentication cookies to force logout
        const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
        const cookieOptions = {
            httpOnly: true,
            sameSite: crossSite ? 'none' : 'lax',
            secure: crossSite || process.env.NODE_ENV === 'production',
            path: '/',
        };

        res.clearCookie('jwt', cookieOptions);
        res.clearCookie('refreshToken', cookieOptions);
        res.clearCookie('csrfToken', {
            httpOnly: false,
            sameSite: cookieOptions.sameSite,
            secure: cookieOptions.secure,
            path: '/',
        });

        return sendSuccess(res, { logout: true }, 'Password reset successful. Please login with your new password.');
    } catch (error) {
        logger.error('Reset employee password error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to reset password', error);
    }
};

// Note: deleteEmployee has been moved to 
// controllers/admin/employeeManagementController.js for better organization
