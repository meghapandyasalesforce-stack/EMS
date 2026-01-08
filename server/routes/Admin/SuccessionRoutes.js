import express from 'express';
import {
    createSuccessionPlan,
    getSuccessionPlans,
    getSuccessionPlan,
    updateSuccessionPlan,
    deleteSuccessionPlan,
    addToTalentPool,
    getTalentPool,
    updateTalentPool,
    deleteTalentPool
} from '../../controllers/succession/successionController.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Succession Plans
router.route('/succession-plans')
    .post(isAdminOrHRAuthenticated, writeLimiter, createSuccessionPlan)
    .get(isAdminOrHRAuthenticated, readLimiter, getSuccessionPlans);

router.route('/succession-plans/:id')
    .get(isAdminOrHRAuthenticated, readLimiter, getSuccessionPlan)
    .put(isAdminOrHRAuthenticated, writeLimiter, updateSuccessionPlan)
    .delete(isAdminOrHRAuthenticated, writeLimiter, deleteSuccessionPlan);

// Talent Pool
router.route('/talent-pool')
    .post(isAdminOrHRAuthenticated, writeLimiter, addToTalentPool)
    .get(isAdminOrHRAuthenticated, readLimiter, getTalentPool);

router.route('/talent-pool/:id')
    .put(isAdminOrHRAuthenticated, writeLimiter, updateTalentPool)
    .delete(isAdminOrHRAuthenticated, writeLimiter, deleteTalentPool);

export default router;

