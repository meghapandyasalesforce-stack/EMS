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
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Benefit Plans
router.route('/benefit-plans')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createBenefitPlan);

router.route('/benefit-plans/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getBenefitPlan)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateBenefitPlan)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteBenefitPlan);

router.route('/benefit-plans/:id/enrollments')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getBenefitPlanEnrollments);

// Enrollments
router.route('/enrollments')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getAllEnrollments);

router.route('/enrollments/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateEnrollmentStatus);

export default router;

