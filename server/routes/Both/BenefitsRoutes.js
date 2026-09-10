import express from 'express';
import {
    getBenefitPlans,
    getBenefitPlan,
    enrollInBenefit,
    getEmployeeBenefits,
    cancelOwnEnrollment,
    updateOwnEnrollmentDependents
} from '../../controllers/benefits/benefitsController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Benefit Plans
router.route('/benefit-plans')
    .get(isAuthenticatedBoth, readLimiter, getBenefitPlans);

router.route('/benefit-plans/:id')
    .get(isAuthenticatedBoth, readLimiter, getBenefitPlan);

// Enrollment
router.route('/benefits/enroll')
    .post(isAuthenticatedBoth, writeLimiter, enrollInBenefit);

router.route('/benefits')
    .get(isAuthenticatedBoth, readLimiter, getEmployeeBenefits);

router.route('/benefits/:id/cancel')
    .put(isAuthenticatedBoth, writeLimiter, cancelOwnEnrollment);

router.route('/benefits/:id/dependents')
    .put(isAuthenticatedBoth, writeLimiter, updateOwnEnrollmentDependents);

export default router;
