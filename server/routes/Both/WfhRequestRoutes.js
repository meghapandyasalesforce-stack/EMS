import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createWfhRequest,
    getMyWfhRequests,
    getAllWfhRequests,
    reviewWfhRequest
} from '../../controllers/wfh/wfhRequestController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ATTENDANCE));

// Employee: submit + view own WFH requests
router.route('/').post(isAuthenticated, createWfhRequest);
router.route('/my').get(isAuthenticated, getMyWfhRequests);

// Admin / HR / Manager: view + approve/reject organization WFH requests
router.route('/all').get(isAdminOrManagerOrHRAuthenticated, getAllWfhRequests);
router.route('/:id/review').put(isAdminOrManagerOrHRAuthenticated, reviewWfhRequest);

export default router;
