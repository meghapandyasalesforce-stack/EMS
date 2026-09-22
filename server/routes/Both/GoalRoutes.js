import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createGoal,
    getGoals,
    getGoalById,
    updateGoal,
    deleteGoal,
    updateGoalProgress,
    addMilestone,
    updateMilestone,
    addGoalReview,
    getGoalStatistics
} from '../../controllers/goal/goalController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PERFORMANCE));

// Employee routes (authenticated)
router.get('/', isAuthenticated, getGoals);
router.get('/statistics', isAuthenticated, getGoalStatistics);
router.get('/:id', isAuthenticated, getGoalById);
router.post('/', isAuthenticated, createGoal);
router.put('/:id', isAuthenticated, updateGoal);
router.delete('/:id', isAuthenticated, deleteGoal);
router.put('/:id/progress', isAuthenticated, updateGoalProgress);
router.post('/:id/milestones', isAuthenticated, addMilestone);
router.put('/:id/milestones/:milestoneIndex', isAuthenticated, updateMilestone);
router.post('/:id/reviews', isAuthenticated, addGoalReview);

export default router;

