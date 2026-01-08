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
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import { roleValidations } from '../../middlewares/inputValidation.js';

const router = express.Router();

// Create role
router.route('/')
    .post(isAdminAuthenticated, roleValidations.create, createRole);

// Get all roles
// Allow HR to read roles (for viewing role hierarchy)
router.route('/')
    .get(isAdminOrHRAuthenticated, getAllRoles);

// Get role hierarchy
// Allow HR to view role hierarchy
router.route('/hierarchy')
    .get(isAdminOrHRAuthenticated, getRoleHierarchy);

// Get role by ID
router.route('/:id')
    .get(isAdminAuthenticated, roleValidations.getById, getRoleById);

// Update role
router.route('/:id')
    .put(isAdminAuthenticated, roleValidations.update, updateRole);

// Delete role
router.route('/:id')
    .delete(isAdminAuthenticated, roleValidations.getById, deleteRole);

// Assign role to employee
router.route('/assign')
    .post(isAdminAuthenticated, roleValidations.assign, assignRoleToEmployee);

// Check user permissions
router.route('/permissions/:userType/:userId')
    .get(isAdminAuthenticated, checkPermissions);

export default router;
