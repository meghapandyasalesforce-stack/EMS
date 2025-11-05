import Employee from '../../models/employee.model.js';
import { generateToken } from '../../helpers/utils.js';
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

        // Validate required fields
        if (!name || !lastName || !email || !password || !position ||
            !department || !manager || !jobTitle || !jobCategory || !salary) {
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Validate position value
        const validPositions = ["Intern", "Junior", "Mid-Level", "Senior", "Lead", "Supervisor", "Manager", "Director", "VP", "CTO", "CFO", "CEO", "Developer"];
        if (!validPositions.includes(position)) {
            return res.status(400).json({ message: 'Invalid position value' });
        }

        // Check if employee already exists
        const existingEmployee = await Employee.findOne({ email });
        if (existingEmployee) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Password will be hashed automatically by the model's pre-save hook
        // No need to hash manually
        
        // Generate unique employee ID: EMP-{first3lettersOfName}-{joiningYear}-{random4Digits}
        const namePrefix = name.substring(0, 3).toUpperCase();
        const joiningYear = new Date().getFullYear();
        let employeeId;
        let isUnique = false;
        
        // Ensure unique employee ID
        while (!isUnique) {
            const random = Math.floor(1000 + Math.random() * 9000);
            employeeId = `EMP-${namePrefix}-${joiningYear}-${random}`;
            const existing = await Employee.findOne({ employeeId });
            if (!existing) {
                isUnique = true;
            }
        }

        // Create the employee
        const employee = new Employee({
            name,
            lastName,
            email,
            password, // Will be hashed automatically by model's pre-save hook
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

        await employee.save();
        
        // Send welcome email with the original password
        // Wrap in try-catch so registration doesn't fail if email fails
        let emailSent = false;
        let emailErrorMessage = null;
        try {
            await sendWelcomeEmail(email, name, password);
            emailSent = true;
            logger.info('Welcome email sent successfully', { email, employeeId: employee._id });
        } catch (emailError) {
            // Log error but don't fail registration - employee is already created
            logger.error('Failed to send welcome email', { 
                email, 
                employeeId: employee._id,
                error: emailError.message,
                stack: emailError.stack 
            });
            emailErrorMessage = emailError.message;
            // Continue with registration even if email fails
        }
        
        // Create associated default payroll
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

        // Generate token and send response
        const token = generateToken(employee._id);
        res.status(201).json({
            message: 'Employee registered successfully',
            emailSent: emailSent, // Indicate if welcome email was sent
            ...(emailErrorMessage && { emailWarning: `Welcome email could not be sent: ${emailErrorMessage}` }),
            token,
            employee: {
                _id: employee._id,
                name: employee.name,
                email: employee.email,
                position: employee.position,
                jobTitle: employee.jobTitle
            }
        });
    } catch (error) {
        logger.error('Registration error', { error: error.message, stack: error.stack });
        res.status(500).json({
            message: 'Registration failed',
            error: error.message,
            ...(error.errors && { detailedErrors: error.errors })
        });
    }
};

// Login employee
export const loginEmployee = async (req, res) => {
    try {
        const { email, password } = req.body;

        const employee = await Employee.findOne({ email });
        if (!employee) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        if (!employee.active) {
            return res.status(403).json({ message: 'Your account is inactive. Please contact HR or Admin.' });
        }

        // Use the model's comparePassword method for consistency
        const isPasswordValid = await employee.comparePassword(password);
        if (!isPasswordValid) {
            return res.status(401).json({ message: 'Invalid email or password' });
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
        res.status(500).json({ message: 'Login failed', error: error.message });
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
        console.error('Error fetching employees:', error);
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
        console.error('Error updating employee status:', error);
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
            return res.status(400).json({ message: 'Password must be at least 8 characters long.' });
        }

        // Password will be hashed automatically by the model's pre-save hook
        const employee = await Employee.findByIdAndUpdate(
            employeeId,
            {
                password: newPassword, // Will be hashed by pre-save hook
                mustResetPassword: false
            },
            { new: true }
        );

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found.' });
        }

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
            message: 'Password reset successful. Please login with your new password.',
            logout: true 
        });
    } catch (error) {
        console.error('Reset error:', error);
        res.status(500).json({ message: 'Failed to reset password', error: error.message });
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
        console.error('Error deleting employee:', error);
        res.status(500).json({ message: 'Failed to delete employee', error: error.message });
    }
};
