import express from 'express';
import {
  requirePlatformOperator,
  requirePlatformPermission,
} from '../../middlewares/requirePlatformOperator.js';
import { PLATFORM_PERMISSIONS } from '../../config/identity.constants.js';
import {
  listOrganizations,
  getOrganization,
  updateOrganization,
  updateOrganizationSubscription,
  updateOrganizationFeatures,
  listPlans,
  getDashboardStats,
  exportOrganizationsCsv,
  createOrganization,
  extendTrial,
  softDeleteOrganization,
  restoreOrganization,
  updateOrganizationAdmin,
  getFeatureCatalog,
  listPlatformAuditLogs,
} from '../../controllers/platform/platformOrgController.js';
import { updatePlan } from '../../controllers/platform/platformPlanController.js';
import {
  listOperators,
  createOperator,
  updateOperator,
} from '../../controllers/platform/platformOperatorController.js';

const router = express.Router();

router.use(requirePlatformOperator);

router.get('/dashboard', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), getDashboardStats);
router.get('/feature-catalog', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), getFeatureCatalog);
router.get('/audit-logs', requirePlatformPermission(PLATFORM_PERMISSIONS.AUDIT_READ), listPlatformAuditLogs);

router.get('/plans', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), listPlans);
router.patch('/plans/:planId', requirePlatformPermission(PLATFORM_PERMISSIONS.PLANS_WRITE), updatePlan);

router.get('/operators', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), listOperators);
router.post('/operators', requirePlatformPermission(PLATFORM_PERMISSIONS.OPERATORS_WRITE), createOperator);
router.patch('/operators/:userId', requirePlatformPermission(PLATFORM_PERMISSIONS.OPERATORS_WRITE), updateOperator);

router.get('/organizations/export', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), exportOrganizationsCsv);
router.get('/organizations', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), listOrganizations);
router.post('/organizations', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), createOrganization);
router.get('/organizations/:orgId', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_READ), getOrganization);
router.patch('/organizations/:orgId', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), updateOrganization);
router.patch('/organizations/:orgId/subscription', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), updateOrganizationSubscription);
router.patch('/organizations/:orgId/features', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), updateOrganizationFeatures);
router.post('/organizations/:orgId/extend-trial', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), extendTrial);
router.post('/organizations/:orgId/soft-delete', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), softDeleteOrganization);
router.post('/organizations/:orgId/restore', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), restoreOrganization);
router.patch('/organizations/:orgId/admins/:userId', requirePlatformPermission(PLATFORM_PERMISSIONS.ORGS_WRITE), updateOrganizationAdmin);

export default router;
