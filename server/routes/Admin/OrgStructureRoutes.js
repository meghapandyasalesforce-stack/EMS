import express from 'express';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';
import { composeMiddleware, requireAnyPermission } from '../../middlewares/requirePermission.js';
import { writeLimiter } from '../../middlewares/rateLimiter.js';
import {
    getOrgStructureCatalog,
    seedOrgStructure,
    listOrgMaster,
    createOrgMaster,
    updateOrgMaster,
    deleteOrgMaster,
    getTenantFeaturesAndUsage,
    getOrganizationChart,
} from '../../controllers/organization/orgStructureController.js';
import { requireEmployeeList } from '../../middlewares/requirePermission.js';

const router = express.Router();

const manageOrgMw = composeMiddleware(
    requireAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_CREATE])
);

router.get('/chart', requireEmployeeList, getOrganizationChart);
router.get('/catalog', isAdminOrHROrExecutiveAuthenticated, getOrgStructureCatalog);
router.post('/seed', isAdminAuthenticated, writeLimiter, seedOrgStructure);
router.get('/tenant-features', isAdminAuthenticated, getTenantFeaturesAndUsage);

router.get('/:resource', isAdminOrHROrExecutiveAuthenticated, listOrgMaster);
router.post('/:resource', manageOrgMw, writeLimiter, createOrgMaster);
router.put('/:resource/:id', manageOrgMw, writeLimiter, updateOrgMaster);
router.delete('/:resource/:id', manageOrgMw, writeLimiter, deleteOrgMaster);

export default router;
