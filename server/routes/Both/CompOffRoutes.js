import express from 'express';
import {
    createCompOffRequest,
    getMyCompOffRequests,
    useCompOff,
    cancelCompOffRequest
} from '../../controllers/compOff/compOffController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

// Employee routes
router.route('/request')
    .post(isAuthenticated, createCompOffRequest)
    .get(isAuthenticated, getMyCompOffRequests);

router.route('/use/:id')
    .post(isAuthenticated, useCompOff);

router.route('/cancel/:id')
    .delete(isAuthenticated, cancelCompOffRequest);

export default router;

