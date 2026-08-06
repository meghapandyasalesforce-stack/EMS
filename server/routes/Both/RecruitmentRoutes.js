import express from 'express';
import { applyForJob } from '../../controllers/recruitment/recruitmentController.js';
import {
    getInternalJobs,
    getInternalJobById,
    postInternalApply,
    postInternalRefer,
    getMyReferrals,
    getMyApplications,
    getMyAssignedInterviews,
    managerCreateRequisition,
    managerListMyRequisitions,
    managerSubmitRequisition,
} from '../../controllers/recruitment/employeeRecruitmentController.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Legacy authenticated apply
router.route('/jobs/:jobPostingId/apply')
    .post(isAuthenticatedBoth, writeLimiter, applyForJob);

// Internal jobs board (any authenticated employee/user in org)
router.route('/internal-jobs')
    .get(isAuthenticatedBoth, readLimiter, getInternalJobs);

router.route('/internal-jobs/:id')
    .get(isAuthenticatedBoth, readLimiter, getInternalJobById);

router.route('/internal-jobs/:id/apply')
    .post(isAuthenticatedBoth, writeLimiter, postInternalApply);

router.route('/internal-jobs/:id/refer')
    .post(isAuthenticatedBoth, writeLimiter, postInternalRefer);

router.route('/my-referrals')
    .get(isAuthenticatedBoth, readLimiter, getMyReferrals);

router.route('/my-applications')
    .get(isAuthenticatedBoth, readLimiter, getMyApplications);

router.route('/my-interviews')
    .get(isAuthenticatedBoth, readLimiter, getMyAssignedInterviews);

// Manager hiring requests
router.route('/requisitions')
    .get(isAuthenticatedBoth, readLimiter, managerListMyRequisitions)
    .post(isAuthenticatedBoth, writeLimiter, managerCreateRequisition);

router.route('/requisitions/:id/submit')
    .post(isAuthenticatedBoth, writeLimiter, managerSubmitRequisition);

export default router;
