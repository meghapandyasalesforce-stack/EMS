import express from 'express';
import {
    requestLeaveEncashment,
    getEncashmentHistory
} from '../../controllers/leave/leaveEncashmentController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { approveLeaveEncashment } from '../../controllers/leave/leaveEncashmentController.js';

const router = express.Router();

// Employee routes
router.route('/request')
    .post(isAuthenticated, requestLeaveEncashment);

router.route('/history/:employeeId?')
    .get(isAuthenticated, getEncashmentHistory);

// Admin/HR routes
router.route('/approve/:id')
    .put(isAdminOrHRAuthenticated, approveLeaveEncashment);

export default router;

