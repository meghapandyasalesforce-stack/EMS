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

const router = express.Router();

// Create role
router.route('/')
    .post(isAdminAuthenticated, createRole);

// Get all roles
router.route('/')
    .get(isAdminAuthenticated, getAllRoles);

// Get role hierarchy
router.route('/hierarchy')
    .get(isAdminAuthenticated, getRoleHierarchy);

// Get role by ID
router.route('/:id')
    .get(isAdminAuthenticated, getRoleById);

// Update role
router.route('/:id')
    .put(isAdminAuthenticated, updateRole);

// Delete role
router.route('/:id')
    .delete(isAdminAuthenticated, deleteRole);

// Assign role to employee
router.route('/assign')
    .post(isAdminAuthenticated, assignRoleToEmployee);

// Check user permissions
router.route('/permissions/:userType/:userId')
    .get(isAdminAuthenticated, checkPermissions);

export default router;
