import express from 'express';
import { 
  subscribe, 
  unsubscribe, 
  getVapidPublicKey,
  getSubscriptionStatus,
  sendTestPush,
} from '../../controllers/admin/pushSubscriptionController.js';
import isUserAuthenticated from '../../middlewares/isUserAuthenticated.js';

const router = express.Router();

// Get VAPID public key (public endpoint, no auth required)
router.get('/vapid-public-key', getVapidPublicKey);

// Subscribe to push notifications
router.post('/push-subscribe', isUserAuthenticated, subscribe);

// Unsubscribe from push notifications
router.post('/push-unsubscribe', isUserAuthenticated, unsubscribe);

// Get subscription status
router.get('/push-subscription-status', isUserAuthenticated, getSubscriptionStatus);

// Send test push to current user
router.post('/test-push', isUserAuthenticated, sendTestPush);

export default router;

