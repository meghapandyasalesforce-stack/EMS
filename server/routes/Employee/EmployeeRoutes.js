import express from 'express';
import { getEmployees, getCurrentEmployee } from '../../controllers/employee/employeeController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';
import { employeeListLimiter } from '../../middlewares/endpointRateLimiters.js';

const router = express.Router();

// Get employees (accessible to current employee based on role)
// Managers/Directors see their department, regular employees see only themselves
router.route('/')
    .get(isAuthenticated, employeeListLimiter, getEmployees);

// Get current employee's own information
router.route('/me')
    .get(isAuthenticated, getCurrentEmployee);

export default router;

