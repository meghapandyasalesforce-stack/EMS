import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getAllCompOffRequests,
    approveCompOff,
    rejectCompOff
} from '../../controllers/compOff/compOffController.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ATTENDANCE));

// Admin/HR/Manager routes
router.route('/requests')
    .get(isAdminOrManagerOrHRAuthenticated, getAllCompOffRequests);

router.route('/approve/:id')
    .put(isAdminOrManagerOrHRAuthenticated, approveCompOff);

router.route('/reject/:id')
    .put(isAdminOrManagerOrHRAuthenticated, rejectCompOff);

export default router;

