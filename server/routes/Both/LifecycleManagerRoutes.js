import express from 'express';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import {
    getManagerOnboarding,
    getManagerOffboarding,
    getManagerDashboardHandler,
    getManagerTasks,
    completeManagerTaskHandler,
    getManagerBuddyAssignmentsHandler,
    addManagerNoteHandler,
    getTeamStatusHandler,
} from '../../controllers/lifecycle/lifecycleManagerController.js';
import { requireLifecycleFeature, requireLifecycleModule } from '../../middlewares/requireLifecycleFeature.js';
import { readLimiter, writeLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.route('/manager/onboarding')
    .get(isAuthenticated, readLimiter, requireLifecycleModule('onboarding', 'Onboarding'), getManagerOnboarding);

router.route('/manager/offboarding')
    .get(isAuthenticated, readLimiter, requireLifecycleModule('offboarding', 'Offboarding'), getManagerOffboarding);

router.route('/manager/dashboard')
    .get(isAuthenticated, readLimiter, getManagerDashboardHandler);

router.route('/manager/tasks')
    .get(isAuthenticated, readLimiter, getManagerTasks);

router.route('/manager/workflows/:workflowId/tasks/:taskId/complete')
    .post(isAuthenticated, writeLimiter, completeManagerTaskHandler);

router.route('/manager/buddy-assignments')
    .get(isAuthenticated, readLimiter, requireLifecycleFeature('buddyProgram', 'Buddy program'), getManagerBuddyAssignmentsHandler);

router.route('/manager/workflows/:workflowId/notes')
    .post(isAuthenticated, writeLimiter, addManagerNoteHandler);

router.route('/manager/team-status')
    .get(isAuthenticated, readLimiter, getTeamStatusHandler);

export default router;
