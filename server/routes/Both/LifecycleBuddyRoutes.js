import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import {
    getBuddyDashboard,
    getBuddyWorkflowsHandler,
    getBuddyWorkflowDetail,
    postCompleteBuddyTask,
    postBuddyCheckin,
    postMarkInductionComplete,
    postBuddyFeedback,
    postBuddyDocumentUpload,
    getBuddyTasks,
} from '../../controllers/lifecycle/lifecycleBuddyController.js';
import { requireLifecycleFeature } from '../../middlewares/requireLifecycleFeature.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LIFECYCLE));

// Buddy dashboard and workflows
router.route('/buddy/dashboard')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), getBuddyDashboard);

router.route('/buddy/workflows')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), getBuddyWorkflowsHandler);

router.route('/buddy/workflows/:workflowId')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), getBuddyWorkflowDetail);

router.route('/buddy/workflows/:workflowId/tasks')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), getBuddyTasks);

router.route('/buddy/workflows/:workflowId/tasks/:taskId/complete')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), postCompleteBuddyTask);

router.route('/buddy/workflows/:workflowId/checkin')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), postBuddyCheckin);

router.route('/buddy/workflows/:workflowId/induction/complete')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), postMarkInductionComplete);

router.route('/buddy/workflows/:workflowId/feedback')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), postBuddyFeedback);

router.route('/buddy/workflows/:workflowId/documents')
    .post(isAuthenticated, writeLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), postBuddyDocumentUpload);

export default router;
