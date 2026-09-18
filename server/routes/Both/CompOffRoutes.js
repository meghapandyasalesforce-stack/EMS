import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    createCompOffRequest,
    getMyCompOffRequests,
    useCompOff,
    cancelCompOffRequest
} from '../../controllers/compOff/compOffController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ATTENDANCE));

// Employee routes
router.route('/request')
    .post(isAuthenticated, createCompOffRequest)
    .get(isAuthenticated, getMyCompOffRequests);

router.route('/use/:id')
    .post(isAuthenticated, useCompOff);

router.route('/cancel/:id')
    .delete(isAuthenticated, cancelCompOffRequest);

export default router;

