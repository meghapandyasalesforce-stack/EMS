import express from 'express';
import {
    createRegularizationRequest,
    getMyRegularizationRequests,
    getRegularizationLimits,
    getRegularizationRequestsForManager,
    approveRegularization,
    rejectRegularization,
    cancelRegularizationRequest
} from '../../controllers/attendance/attendanceRegularizationController.js';

import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';

const router = express.Router();

// Employee routes - create and view their own requests
router.route("/limits")
    .get(isAuthenticated, getRegularizationLimits);

router.route("/request")
    .post(isAuthenticated, createRegularizationRequest)
    .get(isAuthenticated, getMyRegularizationRequests);

// Employee can cancel their own pending request
router.route("/request/:id/cancel")
    .patch(isAuthenticated, cancelRegularizationRequest);

// Manager routes - view and manage team requests
router.route("/manager/requests")
    .get(isAdminOrManagerOrHRAuthenticated, getRegularizationRequestsForManager);

// Manager approve/reject routes
router.route("/manager/approve/:id")
    .patch(isAdminOrManagerOrHRAuthenticated, approveRegularization);

router.route("/manager/reject/:id")
    .patch(isAdminOrManagerOrHRAuthenticated, rejectRegularization);

export default router;

