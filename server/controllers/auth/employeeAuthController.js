import Employee from '../../models/employee.model.js';
import { generateToken, generateSecurePassword } from '../../helpers/utils.js';
import bcrypt from 'bcryptjs';
import mongoose from "mongoose";
import sendWelcomeEmail from '../../helpers/emailSender.js';
import logger from '../../helpers/logger.js';


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
            return res.status(400).json({ 
                success: false,
                message: 'All fields are required (password will be auto-generated if not provided)' 
            });
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
            return res.status(400).json({ 
                success: false,
                message: 'Invalid email format' 
            });
        }

        // Validate position value
        const validPositions = ["Intern", "Junior", "Mid-Level", "Senior", "Lead", "Supervisor", "Manager", "Director", "VP", "CTO", "CFO", "CEO", "Developer"];
        if (!validPositions.includes(position)) {
            return res.status(400).json({ 
                success: false,
                message: 'Invalid position value' 
            });
        }

        // Normalize email (lowercase and trim) for case-insensitive check
        const normalizedEmail = email.toLowerCase().trim();
        
        // Check if employee already exists (use direct query for better performance)
        const existingEmployee = await Employee.findOne({ 
            email: normalizedEmail 
        });
        if (existingEmployee) {
            return res.status(409).json({ 
                success: false,
                message: 'An employee with this email already exists. Please use a different email address.' 
            });
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
        
        // Ensure unique employee ID
        while (!isUnique && attempts < maxAttempts) {
            const random = Math.floor(1000 + Math.random() * 9000);
            employeeId = `EMP-${namePrefix}-${joiningYear}-${random}`;
            const existing = await Employee.findOne({ employeeId });
            if (!existing) {
                isUnique = true;
            }
            attempts++;
        }
        
        if (!isUnique) {
            return res.status(500).json({ 
                success: false,
                message: 'Failed to generate unique employee ID. Please try again.' 
            });
        }

        // Create the employee (normalize email to lowercase)
        const employee = new Employee({
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
                return res.status(409).json({ 
                    success: false,
                    message: `An employee with this ${duplicateField} already exists. Please use a different ${duplicateField}.` 
                });
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

        // Generate token and send response
        const token = generateToken(employee._id);
        res.status(201).json({
            success: true,
            message: 'Employee registered successfully',
            emailSent: emailSent, // Indicate if welcome email was sent
            ...(emailErrorMessage && { 
                emailWarning: `Welcome email could not be sent: ${emailErrorMessage}`,
                emailError: emailErrorMessage 
            }),
            token,
            employee: {
                _id: employee._id,
                name: employee.name,
                lastName: employee.lastName,
                email: employee.email,
                position: employee.position,
                jobTitle: employee.jobTitle,
                employeeId: employee.employeeId
            }
        });
    } catch (error) {
        logger.error('Registration error', { 
            error: error.message, 
            stack: error.stack,
            errorCode: error.code,
            errorName: error.name
        });
        
        // Handle specific error types
        if (error.code === 11000) {
            return res.status(409).json({
                success: false,
                message: 'An employee with this email already exists. Please use a different email address.'
            });
        }
        
        res.status(500).json({
            success: false,
            message: 'Registration failed',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            ...(error.errors && { detailedErrors: error.errors })
        });
    }
};

// Login employee
export const loginEmployee = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({ 
                success: false,
                message: 'Email and password are required' 
            });
        }

        // Normalize email (lowercase and trim) for case-insensitive lookup
        const normalizedEmail = email.toLowerCase().trim();
        
        // Find employee with case-insensitive email match
        const employee = await Employee.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        });
        
        if (!employee) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }

        if (!employee.active) {
            return res.status(403).json({ 
                success: false,
                message: 'Your account is inactive. Please contact HR or Admin.' 
            });
        }

        // Use the model's comparePassword method for consistency
        const isPasswordValid = await employee.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid email or password' 
            });
        }

        // ✅ Pass `res` and `role` so cookie gets set
        const tokenResult = generateToken(employee._id, "employee", res);
        const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
        const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;

        const response = {
            success: true,
            message: 'Login successful',
            token,
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
            },
        };
        
        // Include CSRF token in response for cross-site scenarios
        if (csrfToken) {
            response.csrfToken = csrfToken;
        }

        res.status(200).json(response);
    } catch (error) {
        logger.error('Login employee error', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Login failed', error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' });
    }
};

export const logoutEmployee = (req, res) => {
    try {
        const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
        const cookieOptions = {
            httpOnly: true,
            sameSite: crossSite ? 'none' : 'lax',
            secure: crossSite || process.env.NODE_ENV === 'production',
            path: '/',
        };

        res.clearCookie('jwt', cookieOptions);
        res.clearCookie('csrfToken', {
            httpOnly: false,
            sameSite: cookieOptions.sameSite,
            secure: cookieOptions.secure,
            path: '/',
        });

        res.status(200).json({ message: 'Logout successful' });
    } catch (error) {
        res.status(500).json({ message: 'Logout failed', error: error.message });
    }
};

//get all employees
export const getAllEmployees = async (req, res) => {
    try {
        const user = req.user || req.employee;

        if (!user || user.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const employees = await Employee.find().select('-password');
        res.status(200).json({ employees });
    } catch (error) {
        logger.error('Error fetching employees', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to fetch employees', error: error.message });
    }
};

// Update employee active status (Admin only)
export const updateEmployeeStatus = async (req, res) => {
    try {
        // Check if requester is admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const { employeeId } = req.params;
        const { active } = req.body;

        // Validate input
        if (typeof active !== 'boolean') {
            return res.status(400).json({ message: 'Invalid status. Must be true/false.' });
        }

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({ message: 'Invalid employee ID' });
        }

        // Update status
        const updatedEmployee = await Employee.findByIdAndUpdate(
            employeeId,
            { active },
            { new: true, runValidators: true }
        ).select('-password');

        if (!updatedEmployee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.status(200).json({
            message: `Employee ${active ? 'activated' : 'deactivated'} successfully`,
            employee: updatedEmployee
        });

    } catch (error) {
        logger.error('Error updating employee status', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Failed to update employee status',
            error: error.message
        });
    }
};
export const resetEmployeePassword = async (req, res) => {
    try {
        const employeeId = req.employee?._id;
        const { newPassword } = req.body;

        if (!newPassword || newPassword.length < 8) {
            return res.status(400).json({ 
                success: false,
                message: 'Password must be at least 8 characters long.' 
            });
        }

        // Find the employee first
        const employee = await Employee.findById(employeeId);
        if (!employee) {
            return res.status(404).json({ 
                success: false,
                message: 'Employee not found.' 
            });
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
        res.clearCookie('csrfToken', {
            httpOnly: false,
            sameSite: cookieOptions.sameSite,
            secure: cookieOptions.secure,
            path: '/',
        });

        res.status(200).json({ 
            success: true,
            message: 'Password reset successful. Please login with your new password.',
            logout: true 
        });
    } catch (error) {
        logger.error('Reset employee password error', { error: error.message, stack: error.stack });
        res.status(500).json({ 
            success: false,
            message: 'Failed to reset password', 
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error' 
        });
    }
};

// Delete employee (Admin only)
export const deleteEmployee = async (req, res) => {
    try {
        // Ensure requester is an admin
        if (req.user?.role !== 'admin') {
            return res.status(403).json({ message: 'Access denied. Admins only.' });
        }

        const { employeeId } = req.params;

        if (!mongoose.Types.ObjectId.isValid(employeeId)) {
            return res.status(400).json({ message: 'Invalid employee ID' });
        }

        const employee = await Employee.findByIdAndDelete(employeeId);

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        // Optionally delete associated payroll data (if needed)
        await Payroll.deleteMany({ employeeId: employee._id });

        res.status(200).json({ message: 'Employee deleted successfully' });
    } catch (error) {
        logger.error('Error deleting employee', { error: error.message, stack: error.stack });
        res.status(500).json({ message: 'Failed to delete employee', error: error.message });
    }
};
