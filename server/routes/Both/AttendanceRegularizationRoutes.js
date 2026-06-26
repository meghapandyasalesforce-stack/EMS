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
import { requireAnyPermission } from '../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';

const requireRegularizationApprover = requireAnyPermission(
    [
        PERMISSIONS.ATTENDANCE_REGULARIZATION_APPROVE,
        PERMISSIONS.ATTENDANCE_VIEW_TEAM,
        PERMISSIONS.ATTENDANCE_VIEW_ALL,
        PERMISSIONS.EMPLOYEE_VIEW_ALL,
    ],
    { message: 'Access restricted to managers, HR, and admins only' }
);

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
    .get(requireRegularizationApprover, getRegularizationRequestsForManager);

// Manager approve/reject routes
router.route("/manager/approve/:id")
    .patch(requireRegularizationApprover, approveRegularization);

router.route("/manager/reject/:id")
    .patch(requireRegularizationApprover, rejectRegularization);

export default router;

