import express from 'express';
import {
  updateEmployeeWorkInfo,
  getEmployeeWorkInfo,
  calculateEmployeeStats
} from '../../controllers/admin/employeeController.js';
import { getManagers } from '../../controllers/admin/employeeManagementController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Get managers (employees with management positions)
router.route('/managers')
  .get(isAdminAuthenticated, getManagers);

// Update employee work information
router.route('/:employeeId/work-info')
  .put(isAdminAuthenticated, updateEmployeeWorkInfo)
  .get(isAdminAuthenticated, getEmployeeWorkInfo);

// Calculate employee statistics
router.route('/:employeeId/stats')
  .get(isAdminAuthenticated, calculateEmployeeStats);

export default router;
