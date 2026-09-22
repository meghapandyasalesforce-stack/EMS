import express from 'express';
import {
    createBenefitPlan,
    getBenefitPlan,
    updateBenefitPlan,
    deleteBenefitPlan,
    getBenefitPlanEnrollments,
    updateEnrollmentStatus,
    getAllEnrollments,
    getEmployeeBenefitsOverview,
    getBenefitsReportsSummary,
    updateEnrollmentDependents,
    enrollEmployeeByHR
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

// Employee overview + reports (same Benefits module, no new nav)
router.route('/employee-overview')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getEmployeeBenefitsOverview);

router.route('/reports/summary')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getBenefitsReportsSummary);

// Enrollments
router.route('/enrollments')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getAllEnrollments)
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, enrollEmployeeByHR);

router.route('/enrollments/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateEnrollmentStatus);

router.route('/enrollments/:id/dependents')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateEnrollmentDependents);

export default router;
