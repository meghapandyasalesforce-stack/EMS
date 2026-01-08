import express from 'express';
import {
    createTeamLearning,
    getTeamLearning,
    getTeamLearningById,
    updateTeamLearning,
    deleteTeamLearning,
    updateLearningProgress
} from '../../controllers/teamLearning/teamLearningController.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Create team learning (Manager only)
router.route('/')
    .post(isAdminOrManagerOrHRAuthenticated, writeLimiter, createTeamLearning)
    .get(isAuthenticated, readLimiter, getTeamLearning);

// Get single learning resource
router.route('/:id')
    .get(isAuthenticated, readLimiter, getTeamLearningById)
    .put(isAdminOrManagerOrHRAuthenticated, writeLimiter, updateTeamLearning)
    .delete(isAdminOrManagerOrHRAuthenticated, writeLimiter, deleteTeamLearning);

// Update learning progress (Employee)
router.route('/:id/progress')
    .post(isAuthenticated, writeLimiter, updateLearningProgress);

export default router;

