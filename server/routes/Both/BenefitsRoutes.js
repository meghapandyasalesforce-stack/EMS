import express from 'express';
import {
    getBenefitPlans,
    enrollInBenefit,
    getEmployeeBenefits
} from '../../controllers/benefits/benefitsController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Benefit Plans
router.route('/benefit-plans')
    .get(isAuthenticatedBoth, readLimiter, getBenefitPlans);

// Enrollment
router.route('/benefits/enroll')
    .post(isAuthenticatedBoth, writeLimiter, enrollInBenefit);

router.route('/benefits')
    .get(isAuthenticatedBoth, readLimiter, getEmployeeBenefits);

export default router;

