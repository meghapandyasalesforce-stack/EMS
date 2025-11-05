import User from "../../models/user.model.js"
import Employee from '../../models/employee.model.js';
import bcrypt from 'bcryptjs';
import { generateToken } from "../../helpers/utils.js";
import logger from "../../helpers/logger.js";
import sendWelcomeEmail from "../../helpers/emailSender.js";


export const registerUser = async (req, res) => {
    try {
        const { name, email, password } = req.body;

        // Basic validation
        if (!name || !email || !password) {
            return res.status(400).json({ message: 'Name, email and password are required' });
        }

        // Check if user already exists
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.status(400).json({ message: 'Email already registered' });
        }

        // Create new user (defaults to admin role as per model defaults/config)
        const newUser = new User({ name, email, password });
        await newUser.save();

        // Send welcome email with the password
        let emailSent = false;
        try {
            await sendWelcomeEmail(email, name, password);
            emailSent = true;
            logger.info('Welcome email sent to admin user', { email });
        } catch (emailError) {
            logger.error('Error sending welcome email to admin', { 
                email, 
                error: emailError.message,
                stack: emailError.stack 
            });
            // Don't fail registration if email fails
        }

        // Generate JWT token
        generateToken(newUser._id, newUser.role, res);

        // Return success response with user data
        res.status(201).json({
            message: 'Registration successful',
            emailSent: emailSent, // Indicate if welcome email was sent
            _id: newUser._id,
            name: newUser.name,
            email: newUser.email,
            role: newUser.role
        });
        
    } catch (error) {
        res.status(500).json({ message: 'Registration failed', error: error.message });
    }
};

export const loginUser = async (req, res) => {
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
        
        // Look up user across collections with case-insensitive email match
        let user = await User.findOne({ 
            email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
        }).select('+password');
        let role = 'admin';
        let isEmployee = false;
        if (!user) {
            const employee = await Employee.findOne({ 
                email: { $regex: new RegExp(`^${normalizedEmail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i') } 
            }).select('+password');
            if (employee) {
                user = employee;
                role = 'employee';
                isEmployee = true;
            }
        }

        // Authentication checks
        if (!user) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' // Generic message for security
            });
        }

        // Check if employee is active
        if (isEmployee && !user.active) {
            return res.status(403).json({ 
                success: false,
                message: 'Account inactive',
                details: 'Please contact HR or Admin for assistance' 
            });
        }

        // Verify password - use comparePassword method for both admin and employee
        // This ensures consistent security practices across all user types
        const isPasswordValid = await user.comparePassword(password);

        if (!isPasswordValid) {
            return res.status(401).json({ 
                success: false,
                message: 'Invalid credentials' 
            });
        }

        // Generate token and prepare user data
        const tokenResult = generateToken(user._id, role, res);
        const token = typeof tokenResult === 'object' ? tokenResult.token : tokenResult;
        const csrfToken = typeof tokenResult === 'object' ? tokenResult.csrfToken : undefined;
        
        const userData = {
            id: user._id,
            name: user.name,
            email: user.email,
            role
        };

        // Add employee-specific fields if needed
        if (isEmployee) {
            userData.position = user.position;
            userData.department = user.department;
        }

        // Successful response - return both token and user data
        const response = {
            success: true,
            message: 'Login successful',
            token, // Return token in response for Authorization header
            user: userData
        };
        
        // Include CSRF token in response for cross-site scenarios
        if (csrfToken) {
            response.csrfToken = csrfToken;
        }
        
        return res.status(200).json(response);

    } catch (error) {
        console.error('Login error:', error);
        return res.status(500).json({ 
            success: false,
            message: 'Authentication failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

export const logoutUser = async (req, res) => {
    try {
        // Clear auth and CSRF cookies with environment-aware options
        const crossSite = String(process.env.CROSS_SITE_COOKIES).toLowerCase() === 'true';
        const cookieOptions = {
            httpOnly: true,
            sameSite: crossSite ? 'none' : 'lax',
            secure: crossSite || process.env.NODE_ENV === 'production',
            path: '/',
        };

        res.clearCookie('jwt', cookieOptions);
        // Clear CSRF helper cookie as well (not httpOnly by design)
        res.clearCookie('csrfToken', {
            httpOnly: false,
            sameSite: cookieOptions.sameSite,
            secure: cookieOptions.secure,
            path: '/',
        });

        // Return success response
        res.status(200).json({
            success: true,
            message: 'Logout successful'
        });
        
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({
            success: false,
            message: 'Logout failed',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};
