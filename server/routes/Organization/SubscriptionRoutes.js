import express from 'express';
import {
  getSubscriptionPlans,
  getSubscriptionPlanDetails,
} from '../../controllers/organization/subscriptionController.js';
import {
  getCurrentSubscription,
  createSubscriptionCheckout,
  previewMockCheckout,
  confirmMockCheckout,
  createPortalSession,
  switchToFreePlan,
  syncCheckoutSession,
} from '../../controllers/organization/billingController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Public plan catalog
router.route('/plans').get(getSubscriptionPlans);
router.route('/plans/:planId').get(getSubscriptionPlanDetails);

// Authenticated org billing
router.get('/current', isAdminAuthenticated, getCurrentSubscription);
router.post('/checkout', isAdminAuthenticated, createSubscriptionCheckout);
router.get('/checkout/preview', isAdminAuthenticated, previewMockCheckout);
router.post('/confirm-mock', isAdminAuthenticated, confirmMockCheckout);
router.post('/portal', isAdminAuthenticated, createPortalSession);
router.post('/switch-free', isAdminAuthenticated, switchToFreePlan);
router.get('/checkout/session/:sessionId', isAdminAuthenticated, syncCheckoutSession);

export default router;
