import { body, param, query, validationResult } from 'express-validator';
import { createError } from './errorHandler.js';

/**
 * Middleware to handle validation errors
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware function
 */
export const handleValidationErrors = (req, res, next) => {
    const errors = validationResult(req);
    
    if (!errors.isEmpty()) {
        const errorMessages = errors.array().map(err => ({
            field: err.path || err.param,
            message: err.msg,
            value: err.value
        }));

        return res.status(400).json({
            success: false,
            message: 'Validation failed',
            errors: errorMessages
        });
    }
    
    next();
};

/**
 * Common validation rules
 */
export const commonValidations = {
    // Email validation
    email: body('email')
        .trim()
        .notEmpty().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format')
        .normalizeEmail()
        .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),

    // Password validation
    password: body('password')
        .notEmpty().withMessage('Password is required')
        .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
        .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
        .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
        .matches(/[0-9]/).withMessage('Password must contain at least one number')
        .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),

    // Name validation
    name: body('name')
        .trim()
        .notEmpty().withMessage('Name is required')
        .isLength({ min: 2, max: 100 }).withMessage('Name must be between 2 and 100 characters')
        .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),

    // Phone validation
    phone: body('phone')
        .optional()
        .trim()
        .matches(/^\+?[\d\s-()]+$/).withMessage('Invalid phone number format')
        .isLength({ min: 10, max: 20 }).withMessage('Phone number must be between 10 and 20 characters'),

    // MongoDB ObjectId validation
    objectId: (paramName = 'id') => param(paramName)
        .isMongoId().withMessage(`Invalid ${paramName} format`),

    // Pagination validation
    page: query('page')
        .optional()
        .isInt({ min: 1 }).withMessage('Page must be a positive integer')
        .toInt(),

    limit: query('limit')
        .optional()
        .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
        .toInt(),

    // Date validation
    date: (fieldName = 'date') => body(fieldName)
        .notEmpty().withMessage(`${fieldName} is required`)
        .isISO8601().withMessage(`${fieldName} must be a valid date`)
        .toDate(),

    // Salary validation
    salary: body('salary')
        .notEmpty().withMessage('Salary is required')
        .isFloat({ min: 0 }).withMessage('Salary must be a positive number')
        .toFloat(),

    // Status validation
    status: body('status')
        .optional()
        .isIn(['active', 'inactive', 'suspended', 'terminated']).withMessage('Invalid status value'),

    // Role validation
    role: body('role')
        .optional()
        .isIn(['admin', 'employee']).withMessage('Invalid role value')
};

/**
 * Authentication validations
 */
export const authValidations = {
    register: [
        commonValidations.name,
        commonValidations.email,
        // Password is optional for employee registration (will be auto-generated if not provided)
        body('password')
            .optional()
            .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
            .matches(/[0-9]/).withMessage('Password must contain at least one number')
            .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
        body('phone')
            .optional()
            .trim()
            .matches(/^\+?[\d\s-()]+$/).withMessage('Invalid phone number format'),
        handleValidationErrors
    ],

    login: [
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format'),
        body('password')
            .notEmpty().withMessage('Password is required'),
        handleValidationErrors
    ],

    resetPassword: [
        body('newPassword')
            .notEmpty().withMessage('New password is required')
            .isLength({ min: 8, max: 128 }).withMessage('Password must be between 8 and 128 characters')
            .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter')
            .matches(/[a-z]/).withMessage('Password must contain at least one lowercase letter')
            .matches(/[0-9]/).withMessage('Password must contain at least one number')
            .matches(/[!@#$%^&*(),.?":{}|<>]/).withMessage('Password must contain at least one special character'),
        handleValidationErrors
    ]
};

/**
 * Employee validations
 */
export const employeeValidations = {
    create: [
        body('name')
            .trim()
            .notEmpty().withMessage('Name is required')
            .isLength({ min: 2, max: 99 }).withMessage('Name must be between 2 and 99 characters')
            .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
        body('lastName')
            .trim()
            .notEmpty().withMessage('Last name is required')
            .isLength({ min: 2, max: 99 }).withMessage('Last name must be between 2 and 99 characters')
            .matches(/^[a-zA-Z\s'-]+$/).withMessage('Last name can only contain letters, spaces, hyphens, and apostrophes'),
        body('email')
            .trim()
            .notEmpty().withMessage('Email is required')
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail()
            .isLength({ max: 255 }).withMessage('Email must be less than 255 characters'),
        body('password')
            .optional() // Password is optional - will be auto-generated if not provided
            .isLength({ min: 8 }).withMessage('Password must be at least 8 characters if provided'),
        body('position')
            .notEmpty().withMessage('Position is required')
            .isIn(['Intern', 'Junior', 'Mid-Level', 'Senior', 'Lead', 'Supervisor', 'Manager', 'Director', 'VP', 'CTO', 'CFO', 'CEO', 'Developer'])
            .withMessage('Invalid position'),
        body('department')
            .notEmpty().withMessage('Department is required')
            .isIn(['Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 'Operations', 'Customer Support', 'Legal', 'Product', 'Research & Development', 'Design', 'Administration'])
            .withMessage('Invalid department'),
        body('manager')
            .trim()
            .notEmpty().withMessage('Manager is required'),
        body('jobTitle')
            .notEmpty().withMessage('Job title is required')
            .isIn(['Software Engineer', 'Frontend Developer', 'Backend Developer', 'DevOps Engineer', 'HR Manager', 'Financial Analyst', 'Marketing Executive', 'Sales Representative', 'Product Manager', 'QA Tester', 'Customer Support Specialist', 'UX/UI Designer', 'Project Manager', 'Legal Advisor', 'Operations Coordinator', 'Full Stack Developer'])
            .withMessage('Invalid job title'),
        body('jobCategory')
            .notEmpty().withMessage('Job category is required')
            .isIn(['Information Technology', 'Human Resources', 'Finance', 'Marketing', 'Sales', 'Operations', 'Customer Service', 'Research and Development', 'Engineering', 'Legal', 'Administration', 'Management', 'Design', 'Product Management'])
            .withMessage('Invalid job category'),
        body('salary')
            .notEmpty().withMessage('Salary is required')
            .isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
        handleValidationErrors
    ],

    update: [
        commonValidations.objectId('id'),
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 99 }).withMessage('Name must be between 2 and 99 characters')
            .matches(/^[a-zA-Z\s'-]+$/).withMessage('Name can only contain letters, spaces, hyphens, and apostrophes'),
        body('email')
            .optional()
            .trim()
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail(),
        body('salary')
            .optional()
            .isFloat({ min: 0 }).withMessage('Salary must be a positive number'),
        handleValidationErrors
    ],

    getById: [
        commonValidations.objectId('id'),
        handleValidationErrors
    ]
};

/**
 * Payroll validations
 */
export const payrollValidations = {
    create: [
        commonValidations.objectId('employeeId'),
        body('month')
            .notEmpty().withMessage('Month is required')
            .isIn(['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'])
            .withMessage('Invalid month'),
        body('year')
            .notEmpty().withMessage('Year is required')
            .isInt({ min: 2000, max: 2100 }).withMessage('Invalid year'),
        body('basicSalary')
            .notEmpty().withMessage('Basic salary is required')
            .isFloat({ min: 0 }).withMessage('Basic salary must be a positive number'),
        handleValidationErrors
    ]
};

/**
 * Attendance validations
 */
export const attendanceValidations = {
    clockIn: [
        body('workLocation')
            .optional()
            .isIn(['office', 'work_from_home']).withMessage('Invalid work location'),
        handleValidationErrors
    ],

    getLogs: [
        query('startDate')
            .optional()
            .isISO8601().withMessage('startDate must be a valid date'),
        query('endDate')
            .optional()
            .isISO8601().withMessage('endDate must be a valid date'),
        handleValidationErrors
    ]
};

/**
 * Organization validations
 */
export const organizationValidations = {
    updateProfile: [
        body('name')
            .optional()
            .trim()
            .isLength({ min: 2, max: 100 }).withMessage('Organization name must be between 2 and 100 characters'),
        body('email')
            .optional()
            .trim()
            .isEmail().withMessage('Invalid email format')
            .normalizeEmail(),
        body('phone')
            .optional()
            .trim()
            .matches(/^\+?[\d\s-()]+$/).withMessage('Invalid phone number format'),
        body('domain')
            .optional()
            .trim()
            .matches(/^([a-z0-9]+(-[a-z0-9]+)*\.)+[a-z]{2,}$/i).withMessage('Invalid domain format'),
        body('address')
            .optional()
            .isObject().withMessage('Address must be an object'),
        body('address.street')
            .optional()
            .trim()
            .isLength({ max: 200 }).withMessage('Street address must be less than 200 characters'),
        body('address.city')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('City must be less than 100 characters'),
        body('address.state')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('State must be less than 100 characters'),
        body('address.zipCode')
            .optional()
            .trim()
            .matches(/^[\d-]+$/).withMessage('Invalid zip code format'),
        body('address.country')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Country must be less than 100 characters'),
        handleValidationErrors
    ],

    updateSettings: [
        body('allowEmployeeRegistration')
            .optional()
            .isBoolean().withMessage('allowEmployeeRegistration must be a boolean'),
        body('requireEmailVerification')
            .optional()
            .isBoolean().withMessage('requireEmailVerification must be a boolean'),
        body('allowSelfService')
            .optional()
            .isBoolean().withMessage('allowSelfService must be a boolean'),
        handleValidationErrors
    ],

    updateSubscription: [
        body('subscriptionPlan')
            .optional()
            .isIn(['free', 'basic', 'premium', 'enterprise']).withMessage('Invalid subscription plan'),
        body('maxEmployees')
            .optional()
            .isInt({ min: 1, max: 10000 }).withMessage('maxEmployees must be between 1 and 10000'),
        handleValidationErrors
    ],

    getUsers: [
        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('Page must be a positive integer')
            .toInt(),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
            .toInt(),
        query('role')
            .optional()
            .isIn(['admin', 'employee']).withMessage('Invalid role'),
        query('search')
            .optional()
            .trim()
            .isLength({ max: 100 }).withMessage('Search term must be less than 100 characters'),
        handleValidationErrors
    ],

    getActivity: [
        query('page')
            .optional()
            .isInt({ min: 1 }).withMessage('Page must be a positive integer')
            .toInt(),
        query('limit')
            .optional()
            .isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
            .toInt(),
        query('startDate')
            .optional()
            .isISO8601().withMessage('startDate must be a valid date'),
        query('endDate')
            .optional()
            .isISO8601().withMessage('endDate must be a valid date'),
        handleValidationErrors
    ]
};

export default {
    commonValidations,
    authValidations,
    employeeValidations,
    payrollValidations,
    attendanceValidations,
    organizationValidations,
    handleValidationErrors
};
