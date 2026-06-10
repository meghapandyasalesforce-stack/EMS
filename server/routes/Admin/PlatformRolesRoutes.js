import express from 'express';
import {
  updateUserPlatformRoles,
  updateEmployeeFunctionalRoles,
  getSystemRoleCatalog,
  getSuggestedSystemRole,
  getUsersRolesRoster,
  getEmployeeAccess,
  assignEmployeeSystemRole,
} from '../../controllers/admin/platformRolesController.js';
import { composeMiddleware, requireAnyPermission } from '../../middlewares/requirePermission.js';
import { PERMISSIONS } from '../../config/permissions.constants.js';

const router = express.Router();

const manageRoles = composeMiddleware(
  requireAnyPermission([PERMISSIONS.ORG_SETTINGS_MANAGE, PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE])
);

const viewCatalog = composeMiddleware(
  requireAnyPermission([
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.ORG_SETTINGS_MANAGE,
    PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE,
  ])
);

const suggestRole = composeMiddleware(
  requireAnyPermission([
    PERMISSIONS.EMPLOYEE_CREATE,
    PERMISSIONS.EMPLOYEE_EDIT,
    PERMISSIONS.ORG_SETTINGS_MANAGE,
    PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE,
  ])
);

const viewAccess = composeMiddleware(
  requireAnyPermission([
    PERMISSIONS.EMPLOYEE_EDIT_SENSITIVE,
    PERMISSIONS.ORG_SETTINGS_MANAGE,
  ])
);

router.get('/catalog', viewCatalog, getSystemRoleCatalog);
router.get('/suggest', suggestRole, getSuggestedSystemRole);
router.get('/roster', manageRoles, getUsersRolesRoster);
router.get('/employees/:employeeId/access', viewAccess, getEmployeeAccess);
router.patch('/employees/:employeeId/system-role', viewAccess, assignEmployeeSystemRole);
router.patch('/users/:userId/platform-roles', manageRoles, updateUserPlatformRoles);
router.patch(
  '/employees/:employeeId/functional-roles',
  manageRoles,
  updateEmployeeFunctionalRoles
);

export default router;
