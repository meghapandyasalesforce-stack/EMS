import express from 'express';
import {
    createRole,
    getAllRoles,
    getRoleById,
    updateRole,
    deleteRole,
    assignRoleToEmployee,
    getRoleHierarchy,
    checkPermissions
} from '../../controllers/admin/roleController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';
import { roleValidations } from '../../middlewares/inputValidation.js';

const router = express.Router();

// Static paths before /:id
router.route('/hierarchy')
    .get(isAdminOrHROrExecutiveAuthenticated, getRoleHierarchy);

router.route('/assign')
    .post(isAdminAuthenticated, roleValidations.assign, assignRoleToEmployee);

router.route('/permissions/:userType/:userId')
    .get(isAdminAuthenticated, checkPermissions);

router.route('/')
    .post(isAdminAuthenticated, roleValidations.create, createRole)
    .get(isAdminOrHROrExecutiveAuthenticated, getAllRoles);

router.route('/:id')
    .get(isAdminAuthenticated, roleValidations.getById, getRoleById)
    .put(isAdminAuthenticated, roleValidations.update, updateRole)
    .delete(isAdminAuthenticated, roleValidations.getById, deleteRole);

export default router;
