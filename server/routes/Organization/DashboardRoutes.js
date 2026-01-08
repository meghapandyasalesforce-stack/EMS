import express from 'express';
import {
    getDashboardRoute,
    getDashboardConfig,
    updateDashboardConfig
} from '../../controllers/role/dashboardController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import unifiedAuth from '../../middlewares/unifiedAuth.js';
import validateOrganizationId from '../../middlewares/validateOrganizationId.js';
import { generalLimiter } from '../../middlewares/rateLimiter.js';
import { cacheMiddleware } from '../../helpers/cache.js';

const router = express.Router();

// Get current user's dashboard route (both admin and employee) - cached for 5 minutes
router.get('/route', unifiedAuth, validateOrganizationId, generalLimiter, cacheMiddleware('dashboard:route', 300), getDashboardRoute);

// Get and update dashboard config (admin only) - cached for 10 minutes
router.get('/config/:roleId', isAdminAuthenticated, validateOrganizationId, generalLimiter, cacheMiddleware('dashboard:config', 600), getDashboardConfig);
router.put('/config/:roleId', isAdminAuthenticated, validateOrganizationId, generalLimiter, updateDashboardConfig);

export default router;

