import express from 'express';
import {
    getAllCompOffRequests,
    approveCompOff,
    rejectCompOff
} from '../../controllers/compOff/compOffController.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';

const router = express.Router();

// Admin/HR/Manager routes
router.route('/requests')
    .get(isAdminOrManagerOrHRAuthenticated, getAllCompOffRequests);

router.route('/approve/:id')
    .put(isAdminOrHRAuthenticated, approveCompOff);

router.route('/reject/:id')
    .put(isAdminOrHRAuthenticated, rejectCompOff);

export default router;

