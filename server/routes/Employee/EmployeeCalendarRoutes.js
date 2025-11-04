import express from 'express';
import {
    getEmployeeCalendar,
    getHolidaysForMonth,
    isWorkingDay
} from '../../controllers/employee/employeeCalendarController.js';
import isAuthenticated from '../../middlewares/isAuthenticated.js';

const router = express.Router();

// Get calendar for year (employee view)
router.route('/:year')
    .get(isAuthenticated, getEmployeeCalendar);

// Get holidays for specific month
router.route('/:year/:month/holidays')
    .get(isAuthenticated, getHolidaysForMonth);

// Check if specific date is working day
router.route('/working-day/:date')
    .get(isAuthenticated, isWorkingDay);

export default router;
