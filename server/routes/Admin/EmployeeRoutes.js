import express from 'express';
import {
  updateEmployeeWorkInfo,
  getEmployeeWorkInfo,
  calculateEmployeeStats
} from '../../controllers/admin/employeeController.js';
import { getManagers, getAllEmployees } from '../../controllers/admin/employeeManagementController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';
import isAdminOrHRAuthenticated from '../../middlewares/isAdminOrHRAuthenticated.js';
import isAdminOrManagerOrHRAuthenticated from '../../middlewares/isAdminOrManagerOrHRAuthenticated.js';
import { employeeListLimiter } from '../../middlewares/endpointRateLimiters.js';
import { writeLimiter as generalWriteLimiter } from '../../middlewares/rateLimiter.js';
import { cacheMiddleware } from '../../helpers/cache.js';

const router = express.Router();

// Get all employees (for dashboard) - with rate limiting and caching
// Allow HR and Managers to access this endpoint for viewing employees
// Managers will see employees in their department only
// Cache for 5 minutes
router.route('/')
  .get(isAdminOrManagerOrHRAuthenticated, employeeListLimiter, cacheMiddleware('employees:all', 300), getAllEmployees);

// Get managers (employees with management positions) - no cache so dropdown always shows current list
router.route('/managers')
  .get(isAdminOrHRAuthenticated, employeeListLimiter, getManagers);

// Update employee work information - write operations have stricter limits
router.route('/:employeeId/work-info')
  .put(isAdminAuthenticated, generalWriteLimiter, updateEmployeeWorkInfo)
  .get(isAdminAuthenticated, employeeListLimiter, getEmployeeWorkInfo);

// Calculate employee statistics - resource intensive
router.route('/:employeeId/stats')
  .get(isAdminAuthenticated, employeeListLimiter, calculateEmployeeStats);

export default router;
