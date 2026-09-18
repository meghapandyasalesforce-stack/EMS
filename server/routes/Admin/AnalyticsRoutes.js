import express from 'express';
import { requireFeature } from '../../middlewares/tenantMiddleware.js';
import { SAAS_FEATURES } from '../../constants/saasFeatures.js';
import {
    getHRAnalytics,
    getManagerAnalytics
} from '../../controllers/analytics/analyticsController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { isAuthenticatedBoth } from '../../middlewares/isAuthenticatedBoth.js';
import { readLimiter } from '../../middlewares/rateLimiter.js';

const router = express.Router();

router.use(requireFeature(SAAS_FEATURES.ANALYTICS));

// HR Analytics - Allow HR, admins, and executives
router.route('/hr')
    .get(isAdminOrHROrExecutiveAuthenticated, readLimiter, getHRAnalytics);

// Manager Analytics
router.route('/manager')
    .get(isAuthenticatedBoth, readLimiter, getManagerAnalytics);

export default router;

