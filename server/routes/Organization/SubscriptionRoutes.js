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
  verifyRazorpayPayment,
  createPortalSession,
  switchToFreePlan,
  syncCheckoutSession,
  listBillingPayments,
  downloadBillingInvoice,
  cancelRecurringSubscription,
} from '../../controllers/organization/billingController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Public plan catalog
router.route('/plans').get(getSubscriptionPlans);
router.route('/plans/:planId').get(getSubscriptionPlanDetails);

// Authenticated org billing
router.get('/current', isAdminAuthenticated, getCurrentSubscription);
router.get('/payments', isAdminAuthenticated, listBillingPayments);
router.get('/payments/:paymentId/invoice', isAdminAuthenticated, downloadBillingInvoice);
router.post('/checkout', isAdminAuthenticated, createSubscriptionCheckout);
router.get('/checkout/preview', isAdminAuthenticated, previewMockCheckout);
router.post('/confirm-mock', isAdminAuthenticated, confirmMockCheckout);
router.post('/verify-payment', isAdminAuthenticated, verifyRazorpayPayment);
router.post('/portal', isAdminAuthenticated, createPortalSession);
router.post('/cancel', isAdminAuthenticated, cancelRecurringSubscription);
router.post('/switch-free', isAdminAuthenticated, switchToFreePlan);
router.get('/checkout/session/:sessionId', isAdminAuthenticated, syncCheckoutSession);

export default router;
