import Employee from '../../models/employee.model.js';
import User from '../../models/user.model.js';
import Organization from '../../models/organization.model.js';
import {
    findOrgUserForEmployeeEmail,
    findOrgOwnerEmployeeProfile,
    linkOrgOwnerMeProfile,
    resolveOrgOwnerUser,
    linkUserToEmployeeProfile,
    unifiedAuthPlaceholderPassword,
    verifyEmployeeLoginPassword,
    getEmployeeLoginAuthRecord,
    getEmployeeTokenPasswordChangedAt,
} from '../../helpers/identityService.js';
import { generateToken, generateSecurePassword } from '../../helpers/utils.js';
import bcrypt from 'bcryptjs';
import mongoose from "mongoose";
import { queueWelcomeEmail } from '../../helpers/emailQueue.js';
import { runInBackground } from '../../helpers/backgroundTasks.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendValidationError, sendInternalError, sendNotFound, sendUnauthorized, sendForbidden } from '../../helpers/responseHelper.js';
import asyncHandler from '../../helpers/asyncHandler.js';
import { normalizeEmail, isAccountLocked, handleFailedLogin, resetLoginAttempts, getLockoutMessage, clearAuthCookies } from '../../helpers/authHelpers.js';
import { getDashboardRouteForUser } from '../../helpers/dashboardRouteHelper.js';
import { autoGenerateIdCard } from '../admin/idCardController.js';
import { invalidateEmployeesCache } from '../../helpers/cacheHelper.js';
import { ALL_SYSTEM_ROLE_IDS } from '../../config/systemRole.constants.js';
import {
    applySystemRoleToEmployee,
    syncLinkedUserForSystemRole,
} from '../../helpers/systemRoleService.js';
import { inferSystemRoleFromWorkInfo } from '../../helpers/inferSystemRoleFromWorkInfo.js';

// Generate token with employeeId instead of email

/**
 * @swagger
 * /api/v1/employee/auth/register:
 *   post:
 *     summary: Register a new employee
 *     description: Creates a new employee account. Requires admin or HR authentication. Password is optional and will be auto-generated if not provided.
 *     tags: [Employee Authentication]
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
 *               - lastName
 *               - email
 *               - position
 *               - department
 *               - manager
 *               - jobTitle
 *               - jobCategory
 *               - salary
 *             properties:
 *               name:
 *                 type: string
 *                 example: John
 *                 description: Employee first name
 *               lastName:
 *                 type: string
 *                 example: Doe
 *                 description: Employee last name
 *               email:
 *                 type: string
 *                 format: email
 *                 example: john.doe@example.com
 *                 description: Employee email address (must be unique)
 *               password:
 *                 type: string
 *                 format: password
 *                 example: SecurePass123!
 *                 description: Password (optional - will be auto-generated if not provided)
 *               position:
 *                 type: string
 *                 enum: [Intern, Junior, Mid-Level, Senior, Lead, Supervisor, Manager, Director, Executive, VP, CTO, CFO, CEO, Developer]
 *                 example: Senior
 *                 description: Employee position
 *               department:
 *                 type: string
 *                 enum: [Engineering, HR, Finance, Sales, Marketing, IT Support, Operations, Customer Support, Legal, Product, Research & Development, Design, Administration]
 *                 example: Engineering
 *                 description: Employee department
 *               manager:
 *                 type: string
 *                 example: Jane Smith
 *                 description: Manager name or ID
 *               jobTitle:
 *                 type: string
 *                 enum: [Software Engineer, Frontend Developer, Backend Developer, DevOps Engineer, HR Manager, HR Executive, Financial Analyst, Marketing Executive, Sales Representative, Product Manager, QA Tester, Customer Support Specialist, UX/UI Designer, Project Manager, Legal Advisor, Operations Coordinator, Full Stack Developer]
 *                 example: Software Engineer
 *                 description: Job title
 *               jobCategory:
 *                 type: string
 *                 enum: [Information Technology, Human Resources, Finance, Marketing, Sales, Operations, Customer Service, Research and Development, Engineering, Legal, Administration, Management, Design, Product Management]
 *                 example: Information Technology
 *                 description: Job category
 *               salary:
 *                 type: number
 *                 minimum: 0
 *                 example: 50000
 *                 description: Employee salary
 *     responses:
 *       201:
 *         description: Employee registered successfully
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
 *                   example: Employee registered successfully
 *                 employee:
 *                   $ref: '#/components/schemas/Employee'
 *                 emailSent:
 *                   type: boolean
 *                   example: true
 *                 emailWarning:
 *                   type: string
 *                   example: Welcome email could not be sent
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
 */
// Register new employee

export const registerEmployee = async (req, res) => {
    try {
        if (!req.authContext?.isOrgOwner && !req.authContext?.isHrManager && !req.authContext?.isHrExecutive) {
            return sendError(
                res,
                'Only organization owners and HR staff can create employees',
                403,
                'ORG_OWNER_ONLY'
            );
        }

        const {
            name, lastName, email, password,
            position, department, manager,
            jobTitle, jobCategory, salary,
            systemRole: systemRoleInput,
            confirmReplace = false,
            linkAsOrgOwnerMe = false,
        } = req.body;

        let systemRole = systemRoleInput;
        if (!systemRole || !ALL_SYSTEM_ROLE_IDS.includes(systemRole)) {
            systemRole = inferSystemRoleFromWorkInfo({ department, jobTitle, position }).systemRoleId;
        }
        if (!ALL_SYSTEM_ROLE_IDS.includes(systemRole)) {
            return sendValidationError(res, {
                systemRole: `Invalid system role. Allowed: ${ALL_SYSTEM_ROLE_IDS.join(', ')}`,
            });
        }

        // Validate required fields (password and manager optional - manager defaults to 'CEO' for first employee only)
        if (!name || !lastName || !email || !position ||
            !department || !jobTitle || !jobCategory || !salary) {
            return sendValidationError(res, 
                'All fields are required (password will be auto-generated if not provided)'
            );
        }

        // Get organizationId early so we can enforce "manager required after first employee"
        const organizationId = req.user?.organizationId || req.employee?.organizationId || req.body.organizationId;
        if (!organizationId) {
            return sendError(res, 
                'Organization ID is required. Please ensure you are authenticated as an admin.',
                400,
                'MISSING_ORGANIZATION_ID'
            );
        }

        const orgHasEmployees = await Employee.exists({ organizationId });
        const managerTrimmed = manager && String(manager).trim();
        // First employee (none yet) can have no manager / CEO; every employee after must have a manager selected
        if (orgHasEmployees) {
            if (!managerTrimmed || managerTrimmed === 'CEO') {
                return sendError(res, 
                    'Manager is required. Please select a manager from the list. Only the first employee can be added without a manager (CEO/Manager).',
                    400,
                    'MANAGER_REQUIRED'
                );
            }
        }
        let managerValue = managerTrimmed || 'CEO';
        let managerId = null;
        if (orgHasEmployees) {
            const managerInput = managerTrimmed;
            const managerBaseQuery = { organizationId, status: 'active' };
            let managerEmployee = null;

            if (mongoose.Types.ObjectId.isValid(managerInput)) {
                managerEmployee = await Employee.findOne({ ...managerBaseQuery, _id: managerInput })
                    .select('_id name lastName employeeId')
                    .lean();
            }
            if (!managerEmployee) {
                managerEmployee = await Employee.findOne({ ...managerBaseQuery, employeeId: managerInput })
                    .select('_id name lastName employeeId')
                    .lean();
            }
            if (!managerEmployee) {
                const escaped = managerInput.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
                managerEmployee = await Employee.findOne({
                    ...managerBaseQuery,
                    $or: [
                        { name: { $regex: new RegExp(`^${escaped}$`, 'i') } },
                        { $expr: { $regexMatch: { input: { $concat: ['$name', ' ', '$lastName'] }, regex: `^${escaped}$`, options: 'i' } } }
                    ]
                }).select('_id name lastName employeeId').lean();
            }
            if (!managerEmployee) {
                return sendError(res, 'Selected manager not found in this organization.', 400, 'MANAGER_NOT_FOUND');
            }

            managerId = managerEmployee._id;
            managerValue = `${managerEmployee.name || ''} ${managerEmployee.lastName || ''}`.trim() || managerInput;
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return sendValidationError(res, { email: 'Invalid email format' });
        }

        // Validate position value
        const validPositions = ["Intern", "Junior", "Mid-Level", "Senior", "Lead", "Supervisor", "Manager", "Director", "Executive", "VP", "CTO", "CFO", "CEO", "Developer"];
        if (!validPositions.includes(position)) {
            return sendValidationError(res, { position: `Invalid position. Must be one of: ${validPositions.join(', ')}` });
        }

        // Normalize email (lowercase and trim) for case-insensitive check
        const normalizedEmail = email.toLowerCase().trim();
        
        const [existingEmployeeByEmail, orgUserByEmail, orgOwnerUser] = await Promise.all([
            Employee.findOne({ email: normalizedEmail, organizationId }),
            findOrgUserForEmployeeEmail(normalizedEmail, organizationId),
            resolveOrgOwnerUser(organizationId),
        ]);

        const orgOwnerEmail = orgOwnerUser
            ? String(orgOwnerUser.email || '').toLowerCase().trim()
            : null;
        const isOrgOwnerEmail = Boolean(orgOwnerEmail && orgOwnerEmail === normalizedEmail);
        const linkedOrgUser = isOrgOwnerEmail ? orgOwnerUser : null;
        const wantLinkAsMe =
            linkAsOrgOwnerMe === true ||
            linkAsOrgOwnerMe === 'true' ||
            linkAsOrgOwnerMe === 1;

        if (wantLinkAsMe && orgOwnerUser && !linkedOrgUser) {
            const existingMe = await findOrgOwnerEmployeeProfile(
                orgOwnerUser,
                organizationId,
                orgOwnerEmail
            );
            if (existingMe) {
                const shouldReplace =
                    confirmReplace === true ||
                    confirmReplace === 'true' ||
                    confirmReplace === 1;
                if (!shouldReplace) {
                    return sendError(
                        res,
                        'You already have a Me profile linked. Replace it with this employee?',
                        409,
                        'PROFILE_EXISTS_REQUIRES_CONFIRMATION',
                        {
                            existingProfile: {
                                _id: existingMe._id,
                                name: existingMe.name,
                                lastName: existingMe.lastName,
                                email: existingMe.email,
                                employeeId: existingMe.employeeId,
                            },
                        }
                    );
                }
            }
        }

        // Only the org owner's email may share login with one employee profile
        if (orgUserByEmail && !isOrgOwnerEmail) {
            return sendError(
                res,
                'This email is already registered to another user account. Only the organization admin email can be reused for an employee profile.',
                409,
                'EMAIL_REGISTERED_TO_USER'
            );
        }

        let profileToUpdate = null;
        if (linkedOrgUser) {
            profileToUpdate = await findOrgOwnerEmployeeProfile(
                linkedOrgUser,
                organizationId,
                normalizedEmail
            );
        }

        if (!linkedOrgUser && existingEmployeeByEmail) {
            return sendError(
                res,
                'An employee with this email already exists in this organization. Please use a different email address.',
                409,
                'DUPLICATE_EMAIL'
            );
        }

        // Org admin email: exactly one employee profile linked to the same login
        if (linkedOrgUser && profileToUpdate) {
            const shouldReplace =
                confirmReplace === true ||
                confirmReplace === 'true' ||
                confirmReplace === 1;

            if (!shouldReplace) {
                return sendError(
                    res,
                    'A profile already exists for this employee. Do you want to replace the existing profile with the new one?',
                    409,
                    'PROFILE_EXISTS_REQUIRES_CONFIRMATION',
                    {
                        existingProfile: {
                            _id: profileToUpdate._id,
                            name: profileToUpdate.name,
                            lastName: profileToUpdate.lastName,
                            email: profileToUpdate.email,
                            employeeId: profileToUpdate.employeeId,
                        },
                    }
                );
            }

            profileToUpdate.name = name;
            profileToUpdate.lastName = lastName;
            profileToUpdate.position = position;
            profileToUpdate.department = department;
            profileToUpdate.manager = managerValue;
            profileToUpdate.managerId = managerId;
            profileToUpdate.jobTitle = jobTitle;
            profileToUpdate.jobCategory = jobCategory;
            profileToUpdate.salary = salary;
            profileToUpdate.status = profileToUpdate.status || 'active';
            profileToUpdate.active = profileToUpdate.active !== false;
            if (!profileToUpdate.userId) {
                profileToUpdate.userId = linkedOrgUser._id;
            }

            applySystemRoleToEmployee(profileToUpdate, systemRole);
            await profileToUpdate.save();
            await linkUserToEmployeeProfile(linkedOrgUser, profileToUpdate);
            await syncLinkedUserForSystemRole({
                employee: profileToUpdate,
                systemRoleId: systemRole,
                organizationId,
                existingUser: linkedOrgUser,
            });

            runInBackground('register-employee-cache-invalidate', async () => {
                await invalidateEmployeesCache(organizationId);
            });

            logger.info('Updated existing employee profile linked to org User', {
                email: normalizedEmail,
                userId: linkedOrgUser._id,
                employeeId: profileToUpdate._id,
                organizationId,
            });

            return sendSuccess(
                res,
                {
                    linkedToExistingUser: true,
                    updatedExistingProfile: true,
                    employee: {
                        _id: profileToUpdate._id,
                        name: profileToUpdate.name,
                        lastName: profileToUpdate.lastName,
                        email: profileToUpdate.email,
                        position: profileToUpdate.position,
                        jobTitle: profileToUpdate.jobTitle,
                        employeeId: profileToUpdate.employeeId,
                        unifiedAuth: true,
                        systemRole,
                        functionalRoles: profileToUpdate.functionalRoles,
                    },
                    message:
                        'Employee profile updated and linked to your existing admin login. Use the same email and password to sign in.',
                },
                'Employee profile updated successfully',
                200
            );
        }

        // Unified auth: link first (and only) employee profile to org owner User
        let linkedToExistingUser = false;
        if (linkedOrgUser) {
            linkedToExistingUser = true;
            logger.info('Linking new employee profile to org owner account', {
                email: normalizedEmail,
                userId: linkedOrgUser._id,
                organizationId,
            });
        } else if (wantLinkAsMe && orgOwnerUser) {
            linkedToExistingUser = true;
            logger.info('Linking new employee as org owner Me profile', {
                email: normalizedEmail,
                userId: orgOwnerUser._id,
                organizationId,
            });
        }

        // Generate secure password if not provided (skipped when linking to existing User)
        let employeePassword = password || generateSecurePassword(16);
        let mustResetPassword = !password;
        if (linkedToExistingUser) {
            employeePassword = unifiedAuthPlaceholderPassword();
            mustResetPassword = false;
        }
        logger.info('Password generation', {
            provided: !!password,
            generated: !password && !linkedToExistingUser,
            linkedToExistingUser,
            email: normalizedEmail
        });

        // Password will be hashed automatically by the model's pre-save hook
        // No need to hash manually
        
        // Generate organization-specific employee ID (if configured), otherwise fallback to legacy format
        let employeeId;
        const orgSettings = await Organization.findById(organizationId)
            .select('settings.employeeIdPrefix settings.employeeIdNextNumber settings.employeeIdMinDigits')
            .lean();

        if (orgSettings?.settings?.employeeIdPrefix) {
            const prefix = orgSettings.settings.employeeIdPrefix.toUpperCase();
            const minDigits = orgSettings.settings.employeeIdMinDigits || 3;
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                const updatedOrg = await Organization.findOneAndUpdate(
                    { _id: organizationId },
                    { $inc: { 'settings.employeeIdNextNumber': 1 } },
                    { new: true, projection: { 'settings.employeeIdNextNumber': 1 } }
                );

                const seq = updatedOrg?.settings?.employeeIdNextNumber || 1;
                const candidate = `${prefix}${String(seq).padStart(minDigits, '0')}`;
                const existing = await Employee.findOne({ employeeId: candidate, organizationId });

                if (!existing) {
                    employeeId = candidate;
                    break;
                }
                attempts++;
            }

            if (!employeeId) {
                return sendInternalError(res, 'Failed to generate unique employee ID. Please try again.');
            }
        } else {
            // Legacy format: EMP-{first3lettersOfName}-{joiningYear}-{random4Digits}
            const namePrefix = name.substring(0, 3).toUpperCase();
            const joiningYear = new Date().getFullYear();
            let isUnique = false;
            let attempts = 0;
            const maxAttempts = 10;

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
        }

        // Create the employee (normalize email to lowercase)
        const employee = new Employee({
            organizationId, // Add organizationId
            ...(linkedToExistingUser && linkedOrgUser
                ? { userId: linkedOrgUser._id }
                : wantLinkAsMe && orgOwnerUser
                  ? { userId: orgOwnerUser._id }
                  : {}),
            name,
            lastName,
            email: normalizedEmail, // Use normalized email
            password: employeePassword, // Will be hashed automatically by model's pre-save hook
            position,
            department,
            manager: managerValue,
            managerId,
            jobTitle,
            jobCategory,
            salary,
            role: 'employee',
            mustResetPassword: mustResetPassword,
            employeeId: employeeId, // Set the auto-generated ID
            status: 'active', // ✅ Explicitly set status to active
            active: true // ✅ Explicitly set active to true for new employees
        });

        applySystemRoleToEmployee(employee, systemRole);

        // Save employee - this will trigger password hashing
        try {
            await employee.save();
            if (linkedToExistingUser && linkedOrgUser) {
                await linkUserToEmployeeProfile(linkedOrgUser, employee);
                await syncLinkedUserForSystemRole({
                    employee,
                    systemRoleId: systemRole,
                    organizationId,
                    existingUser: linkedOrgUser,
                });
            } else if (wantLinkAsMe && orgOwnerUser) {
                await linkOrgOwnerMeProfile(orgOwnerUser, employee._id, organizationId);
                await syncLinkedUserForSystemRole({
                    employee,
                    systemRoleId: systemRole,
                    organizationId,
                    existingUser: orgOwnerUser,
                });
            } else {
                const plaintextForUser = password || employeePassword;
                await syncLinkedUserForSystemRole({
                    employee,
                    systemRoleId: systemRole,
                    plaintextPassword: plaintextForUser,
                    organizationId,
                });
            }
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

        runInBackground('register-employee-cache-invalidate', async () => {
            await invalidateEmployeesCache(organizationId);
        });
        
        let emailSent = false;
        let emailQueued = false;
        try {
            if (linkedToExistingUser) {
                logger.info('Skipped welcome email with password — account uses existing admin/login credentials', {
                    email: normalizedEmail,
                    employeeId: employee._id
                });
            } else {
                const queued = await queueWelcomeEmail(normalizedEmail, `${name} ${lastName}`, employeePassword);
                if (queued) {
                    emailQueued = true;
                    emailSent = true;
                    logger.info('Welcome email queued', {
                        email: normalizedEmail,
                        employeeId: employee._id,
                        employeeName: `${name} ${lastName}`
                    });
                } else {
                    logger.warn('Welcome email skipped — queue unavailable', {
                        email: normalizedEmail,
                        employeeId: employee._id,
                    });
                }
            }
        } catch (emailError) {
            logger.error('Failed to queue welcome email', { 
                email: normalizedEmail, 
                employeeId: employee._id,
                employeeName: `${name} ${lastName}`,
                error: emailError.message,
            });
            // Do not surface email failures to the client — employee was created successfully
        }
        
        // SECURITY FIX: Do NOT generate tokens when admin/HR creates employee.
        // This prevents overwriting the creator's session cookies.
        // Employee will get tokens when they log in themselves.
        const isPrivilegedCreating = !!(req.user || req.employee);
        
        let token = undefined;
        let refreshToken = undefined;
        let csrfToken = undefined;
        
        // Only generate tokens if NOT created by authenticated admin/HR (self-registration scenario)
        // This should rarely happen since the route requires admin/HR auth, but kept for safety.
        if (!isPrivilegedCreating) {
            const passwordChangedAt = employee.passwordChangedAt || employee.createdAt;
            const tokenResult = generateToken(employee._id, "employee", organizationId, res, passwordChangedAt);
            token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
            refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
            csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;
        }
        
        const response = {
            emailSent,
            emailQueued,
            employee: {
                _id: employee._id,
                name: employee.name,
                lastName: employee.lastName,
                email: employee.email,
                position: employee.position,
                jobTitle: employee.jobTitle,
                employeeId: employee.employeeId,
                unifiedAuth: !!employee.userId,
                systemRole,
                functionalRoles: employee.functionalRoles,
            },
            ...(linkedToExistingUser && {
                linkedToExistingUser: true,
                message: 'Employee profile created and linked to existing login. Use your existing account password for admin and employee portals.'
            })
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

        const createdById = req.user?._id || req.employee?._id;
        runInBackground('register-employee-id-card', async () => {
            const idCardResult = await autoGenerateIdCard(
                employee._id,
                organizationId,
                createdById
            );
            if (idCardResult.success) {
                logger.info('ID card auto-generated for new employee', {
                    employeeId: employee._id,
                    idCardId: idCardResult.idCard?._id,
                });
            } else if (idCardResult.reason !== 'already_exists') {
                logger.warn('Failed to auto-generate ID card for new employee', {
                    employeeId: employee._id,
                    reason: idCardResult.reason,
                    error: idCardResult.error,
                });
            }
        });

        response.idCardQueued = true;

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
 * @swagger
 * /api/v1/employee/auth/login:
 *   post:
 *     summary: Login as employee
 *     description: Authenticates an employee and returns JWT tokens. Account lockout applies after failed attempts. Organization is determined from email domain.
 *     tags: [Employee Authentication]
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
 *                 example: john.doe@example.com
 *                 description: Employee email address
 *               password:
 *                 type: string
 *                 format: password
 *                 example: EmployeePass123!
 *                 description: Employee password
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
 *                 employee:
 *                   $ref: '#/components/schemas/Employee'
 *                 refreshToken:
 *                   type: string
 *                   description: JWT refresh token (optional)
 *                 csrfToken:
 *                   type: string
 *                   description: CSRF token (optional)
 *                 dashboardRoute:
 *                   type: string
 *                   example: /dashboard-employee
 *                   description: Dashboard route for the employee
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
 *                 message: Your account is inactive. Please contact HR or Admin.
 *                 code: ACCOUNT_INACTIVE
 */
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
    
    // Find organization by domain field first (if exists)
    let organization = await Organization.findOne({
        domain: emailDomain,
        isActive: true
    }).select('_id domain');

    // Fallback: If domain field not set, try to find organization by email domain
    // Extract domain from organization email and match it
    if (!organization) {
        // Find organizations where email ends with the domain
        const organizations = await Organization.find({
            email: { $regex: new RegExp(`@${emailDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') },
            isActive: true
        }).select('_id domain email').limit(1);
        
        if (organizations.length > 0) {
            organization = organizations[0];
            
            // Auto-populate domain field if missing for future lookups
            if (organization && !organization.domain) {
                try {
                    await Organization.updateOne(
                        { _id: organization._id },
                        { $set: { domain: emailDomain.toLowerCase() } }
                    );
                    logger.info('Auto-populated organization domain field', {
                        requestId,
                        organizationId: organization._id,
                        domain: emailDomain,
                        organizationEmail: organization.email
                    });
                    // Update the organization object to reflect the change
                    organization.domain = emailDomain.toLowerCase();
                } catch (updateError) {
                    // Log but don't fail - domain update is not critical for login
                    logger.warn('Failed to auto-populate organization domain', {
                        requestId,
                        organizationId: organization._id,
                        error: updateError.message
                    });
                }
            }
        }
    }

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
        // No organization found for this domain - search globally but log warning
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

    const { record: authRecord, type: authRecordType, unified: unifiedAuth } =
        await getEmployeeLoginAuthRecord(employee);

    // Check if account is locked (User record when unified auth)
    if (isAccountLocked(authRecord)) {
        const lockoutMessage = getLockoutMessage(authRecord);
        logger.warn('Employee login failed: Account locked', {
            requestId,
            email: normalizedEmail,
            employeeId: employee._id,
            authRecordType,
            lockUntil: authRecord.lockUntil
        });
        return sendForbidden(res, lockoutMessage);
    }

    if (unifiedAuth && authRecordType === 'user' && !authRecord.isActive) {
        logger.warn('Employee login failed: Linked user account inactive', {
            requestId,
            email: normalizedEmail,
            employeeId: employee._id
        });
        return sendForbidden(res, 'Your account is inactive. Please contact administrator.');
    }

    if (!employee.active) {
        logger.warn('Employee login failed: Account inactive', { requestId, email: normalizedEmail, employeeId: employee._id });
        return sendForbidden(res, 'Your account is inactive. Please contact HR or Admin.');
    }

    logger.debug('Comparing password', { requestId, employeeId: employee._id, unifiedAuth });
    const isPasswordValid = await verifyEmployeeLoginPassword(employee, password);

    if (!isPasswordValid) {
        await handleFailedLogin(authRecord);
        logger.warn('Employee login failed: Invalid password', {
            requestId,
            email: normalizedEmail,
            employeeId: employee._id,
            unifiedAuth,
            attempts: authRecord.loginAttempts
        });
        return sendUnauthorized(res, 'Invalid email or password');
    }

    await resetLoginAttempts(authRecord);
    
    logger.info('Employee login successful', { 
        requestId, 
        email: normalizedEmail, 
        employeeId: employee._id, 
        organizationId: employee.organizationId 
    });

    const passwordChangedAt = await getEmployeeTokenPasswordChangedAt(employee);
    const tokenResult = generateToken(employee._id, "employee", employee.organizationId, res, passwordChangedAt);
    const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
    const refreshToken = typeof tokenResult === 'object' ? tokenResult.refreshToken : undefined;
    const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

    // Get dashboard route based on role, position, and department
    let dashboardRoute = '/dashboard-employee'; // Default fallback
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

    let timezoneContext = null;
    try {
        const { getTimezoneContext } = await import('../../helpers/organizationTimezoneService.js');
        timezoneContext = await getTimezoneContext(employee.organizationId);
    } catch (tzError) {
        logger.warn('Failed to load timezone on login', { error: tzError.message });
    }

    // CODE QUALITY FIX: Unified response structure across all login endpoints
    // Structure: { token, user/employee, dashboardRoute, refreshToken?, csrfToken? }
    const response = {
        token,
        dashboardRoute, // Add dashboard route for automatic redirection
        timezone: timezoneContext?.timezone || 'UTC',
        timezoneContext,
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
            functionalRoles: employee.functionalRoles || [],
            birthDate: employee.birthDate,
            profilePhoto: employee.profilePhoto,
            mustResetPassword: employee.mustResetPassword,
            unifiedAuth: !!employee.userId
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

        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return sendNotFound(res, 'Employee');
        }

        if (employee.userId) {
            const linkedUser = await User.findById(employee.userId);
            if (!linkedUser) {
                return sendNotFound(res, 'Linked user account');
            }
            linkedUser.password = newPassword;
            await linkedUser.save();
            employee.mustResetPassword = false;
            await employee.save();
        } else {
            employee.password = newPassword;
            employee.mustResetPassword = false;
            await employee.save();
        }

        // Clear authentication cookies to force logout
        await clearAuthCookies(res, req);

        return sendSuccess(res, { logout: true }, 'Password reset successful. Please login with your new password.');
    } catch (error) {
        logger.error('Reset employee password error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to reset password', error);
    }
};

// Note: deleteEmployee has been moved to 
// controllers/admin/employeeManagementController.js for better organization
