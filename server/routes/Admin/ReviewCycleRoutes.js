import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createReviewCycle,
    getReviewCycles,
    getReviewCycleById,
    updateReviewCycle,
    activateReviewCycle,
    assignEmployeeToCycle,
    completeReviewCycle,
    getCycleStatistics,
    deleteReviewCycle
} from '../../controllers/performance/reviewCycleController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PERFORMANCE));

// All routes require admin authentication
router.post('/', isAdminAuthenticated, createReviewCycle);
router.get('/', isAdminAuthenticated, getReviewCycles);
router.get('/:id', isAdminAuthenticated, getReviewCycleById);
router.put('/:id', isAdminAuthenticated, updateReviewCycle);
router.delete('/:id', isAdminAuthenticated, deleteReviewCycle);
router.post('/:id/activate', isAdminAuthenticated, activateReviewCycle);
router.post('/:id/assign', isAdminAuthenticated, assignEmployeeToCycle);
router.post('/:id/complete', isAdminAuthenticated, completeReviewCycle);
router.get('/:id/statistics', isAdminAuthenticated, getCycleStatistics);

export default router;

