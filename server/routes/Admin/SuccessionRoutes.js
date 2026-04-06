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
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { writeLimiter, readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

// Succession Plans
router.route('/succession-plans')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, createSuccessionPlan)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getSuccessionPlans);

router.route('/succession-plans/:id')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getSuccessionPlan)
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateSuccessionPlan)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteSuccessionPlan);

// Talent Pool
router.route('/talent-pool')
    .post(isAdminOrHROrExecutiveAuthenticated, writeLimiter, addToTalentPool)
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getTalentPool);

router.route('/talent-pool/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, writeLimiter, updateTalentPool)
    .delete(isAdminOrHROrExecutiveAuthenticated, writeLimiter, deleteTalentPool);

export default router;

