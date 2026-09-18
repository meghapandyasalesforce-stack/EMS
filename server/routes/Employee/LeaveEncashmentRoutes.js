import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    requestLeaveEncashment,
    getEncashmentHistory
} from '../../controllers/leave/leaveEncashmentController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { approveLeaveEncashment } from '../../controllers/leave/leaveEncashmentController.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.LEAVE));

// Employee routes
router.route('/request')
    .post(isAuthenticated, requestLeaveEncashment);

router.route('/history/:employeeId?')
    .get(isAuthenticated, getEncashmentHistory);

// Admin/HR routes
router.route('/approve/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, approveLeaveEncashment);

export default router;

