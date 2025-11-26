import { body, param } from 'express-validator';
import { handleValidationErrors } from './inputValidation.js';

/**
 * Validation rules for policy management
 */
export const policyValidations = {
    create: [
        body('policyType')
            .notEmpty().withMessage('Policy type is required')
            .isIn([
                'leave', 'attendance', 'payroll', 'work_hours', 
                'dress_code', 'code_of_conduct', 'data_security',
                'remote_work', 'overtime', 'expense', 'travel',
                'performance', 'disciplinary', 'benefits', 'custom'
            ]).withMessage('Invalid policy type'),
        body('title')
            .trim()
            .notEmpty().withMessage('Title is required')
            .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
        body('description')
            .trim()
            .notEmpty().withMessage('Description is required')
            .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
        body('content')
            .trim()
            .notEmpty().withMessage('Content is required')
            .isLength({ min: 20 }).withMessage('Content must be at least 20 characters'),
        body('effectiveDate')
            .optional()
            .isISO8601().withMessage('Effective date must be a valid ISO 8601 date')
            .toDate(),
        body('expiryDate')
            .optional()
            .isISO8601().withMessage('Expiry date must be a valid ISO 8601 date')
            .toDate(),
        body('requiresAcknowledgment')
            .optional()
            .isBoolean().withMessage('Requires acknowledgment must be a boolean'),
        body('applicableRoles')
            .optional()
            .isArray().withMessage('Applicable roles must be an array'),
        body('applicableRoles.*')
            .optional()
            .isMongoId().withMessage('Each applicable role must be a valid MongoDB ObjectId'),
        body('applicableDepartments')
            .optional()
            .isArray().withMessage('Applicable departments must be an array'),
        body('applicableDepartments.*')
            .optional()
            .isString().withMessage('Each department must be a string')
            .isIn([
                'Engineering', 'HR', 'Finance', 'Sales', 'Marketing', 'IT Support', 
                'Operations', 'Customer Support', 'Legal', 'Product', 
                'Research & Development', 'Design', 'Administration'
            ]).withMessage('Invalid department name'),
        handleValidationErrors
    ],

    update: [
        param('id')
            .isMongoId().withMessage('Invalid policy ID format'),
        body('policyType')
            .optional()
            .isIn([
                'leave', 'attendance', 'payroll', 'work_hours', 
                'dress_code', 'code_of_conduct', 'data_security',
                'remote_work', 'overtime', 'expense', 'travel',
                'performance', 'disciplinary', 'benefits', 'custom'
            ]).withMessage('Invalid policy type'),
        body('title')
            .optional()
            .trim()
            .isLength({ min: 3, max: 200 }).withMessage('Title must be between 3 and 200 characters'),
        body('description')
            .optional()
            .trim()
            .isLength({ min: 10, max: 1000 }).withMessage('Description must be between 10 and 1000 characters'),
        body('content')
            .optional()
            .trim()
            .isLength({ min: 20 }).withMessage('Content must be at least 20 characters'),
        body('effectiveDate')
            .optional()
            .isISO8601().withMessage('Effective date must be a valid ISO 8601 date')
            .toDate(),
        body('expiryDate')
            .optional()
            .isISO8601().withMessage('Expiry date must be a valid ISO 8601 date')
            .toDate(),
        body('isActive')
            .optional()
            .isBoolean().withMessage('Is active must be a boolean'),
        handleValidationErrors
    ],

    getById: [
        param('id')
            .isMongoId().withMessage('Invalid policy ID format'),
        handleValidationErrors
    ],

    delete: [
        param('id')
            .isMongoId().withMessage('Invalid policy ID format'),
        handleValidationErrors
    ],

    acknowledge: [
        body('policyId')
            .notEmpty().withMessage('Policy ID is required')
            .isMongoId().withMessage('Invalid policy ID format'),
        handleValidationErrors
    ]
};

