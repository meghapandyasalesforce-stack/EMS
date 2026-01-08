import express from 'express';
import {
    createBenefitPlan,
    getBenefitPlan,
    updateBenefitPlan,
    deleteBenefitPlan,
    getBenefitPlanEnrollments,
    updateEnrollmentStatus,
    getAllEnrollments
} from '../../controllers/benefits/benefitsController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Benefit Plans
router.route('/benefit-plans')
    .post(isAdminOrHRAuthenticated, writeLimiter, createBenefitPlan);

router.route('/benefit-plans/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getBenefitPlan)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateBenefitPlan)
    .delete(isAdminOrHRAuthenticated, writeLimiter, deleteBenefitPlan);

router.route('/benefit-plans/:id/enrollments')
    .get(isAdminOrHRAuthenticated, readLimiter, getBenefitPlanEnrollments);

// Enrollments
router.route('/enrollments')
    .get(isAdminOrHRAuthenticated, readLimiter, getAllEnrollments);

router.route('/enrollments/:id')
    .put(isAdminOrHRAuthenticated, writeLimiter, updateEnrollmentStatus);

export default router;

