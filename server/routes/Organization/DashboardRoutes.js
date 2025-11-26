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

const router = express.Router();

// Get current user's dashboard route (both admin and employee)
router.get('/route', unifiedAuth, validateOrganizationId, generalLimiter, getDashboardRoute);

// Get and update dashboard config (admin only)
router.get('/config/:roleId', isAdminAuthenticated, validateOrganizationId, generalLimiter, getDashboardConfig);
router.put('/config/:roleId', isAdminAuthenticated, validateOrganizationId, generalLimiter, updateDashboardConfig);

export default router;

