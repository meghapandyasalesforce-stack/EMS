import express from 'express';
import {
    getAllCompOffRequests,
    approveCompOff,
    rejectCompOff
} from '../../controllers/compOff/compOffController.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';

const router = express.Router();

// Admin/HR/Manager routes
router.route('/requests')
    .get(isAdminOrManagerOrHRAuthenticated, getAllCompOffRequests);

router.route('/approve/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, approveCompOff);

router.route('/reject/:id')
    .put(isAdminOrHROrExecutiveAuthenticated, rejectCompOff);

export default router;

