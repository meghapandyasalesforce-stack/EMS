import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    createPolicy,
    getPolicies,
    getPolicyById,
    updatePolicy,
    deletePolicy,
    getEmployeePolicies,
    acknowledgePolicy,
    getPolicyCompliance
} from '../../controllers/organization/policyController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { policyValidations } from '../../middlewares/policyValidations.js';
import validateOrganizationId from '../../middlewares/validateOrganizationId.js';
import { generalLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Rate limiter for policy endpoints (stricter for write operations)
const policyWriteLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 10 : 100, // Limit policy creation/updates
    message: {
        success: false,
        message: 'Too many policy modification requests. Please try again later.'
    },
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin routes (require admin authentication for write operations)
router.post('/', isAdminAuthenticated, validateOrganizationId, policyWriteLimiter, policyValidations.create, createPolicy);
router.put('/:id', isAdminAuthenticated, validateOrganizationId, policyWriteLimiter, policyValidations.update, updatePolicy);
router.delete('/:id', isAdminAuthenticated, validateOrganizationId, policyWriteLimiter, policyValidations.delete, deletePolicy);

// Employee routes (require employee authentication) - MUST come before /:id to avoid route conflicts
router.get('/employee/policies', isAuthenticated, validateOrganizationId, generalLimiter, getEmployeePolicies);
router.post('/employee/acknowledge', isAuthenticated, validateOrganizationId, generalLimiter, policyValidations.acknowledge, acknowledgePolicy);

// Admin/HR routes (allow both admin and HR for read operations) - MUST come after /employee routes
router.get('/', isAdminOrHRAuthenticated, validateOrganizationId, generalLimiter, getPolicies);
router.get('/compliance', isAdminOrHRAuthenticated, validateOrganizationId, generalLimiter, getPolicyCompliance);
router.get('/:id', isAdminOrHRAuthenticated, validateOrganizationId, generalLimiter, policyValidations.getById, getPolicyById);

export default router;

