import express from 'express';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import {
  createTaxRegimeChangeRequest,
  getMyTaxRegimeChangeRequests,
  cancelTaxRegimeChangeRequest,
  getPendingTaxRegimeChangeRequests,
  approveTaxRegimeChangeRequest,
  rejectTaxRegimeChangeRequest,
} from '../../controllers/employee/taxRegimeChangeController.js';

const router = express.Router();

router
  .route('/request')
  .get(isAuthenticated, getMyTaxRegimeChangeRequests)
  .post(isAuthenticated, createTaxRegimeChangeRequest);

router
  .route('/request/:id/cancel')
  .patch(isAuthenticated, cancelTaxRegimeChangeRequest);

router
  .route('/admin/pending')
  .get(isAdminOrHROrExecutiveAuthenticated, getPendingTaxRegimeChangeRequests);

router
  .route('/admin/approve/:id')
  .patch(isAdminOrHROrExecutiveAuthenticated, approveTaxRegimeChangeRequest);

router
  .route('/admin/reject/:id')
  .patch(isAdminOrHROrExecutiveAuthenticated, rejectTaxRegimeChangeRequest);

export default router;
