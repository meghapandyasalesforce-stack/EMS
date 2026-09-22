import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createPerformanceReview,
    getPerformanceReviews,
    getPerformanceReviewById,
    submitSelfAssessment,
    submitManagerEvaluation,
    addPeerReview,
    updatePerformanceReview,
    deletePerformanceReview
} from '../../controllers/performance/performanceReviewController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.PERFORMANCE));

// Employee routes
router.get('/', isAuthenticated, getPerformanceReviews);
router.get('/:id', isAuthenticated, getPerformanceReviewById);
router.post('/:id/self-assessment', isAuthenticated, submitSelfAssessment);
router.post('/:id/peer-review', isAuthenticated, addPeerReview);

// Admin/Manager routes
router.post('/', isAdminAuthenticated, createPerformanceReview);
router.post('/:id/manager-evaluation', isAdminAuthenticated, submitManagerEvaluation);
router.put('/:id', isAdminAuthenticated, updatePerformanceReview);
router.delete('/:id', isAdminAuthenticated, deletePerformanceReview);

export default router;

