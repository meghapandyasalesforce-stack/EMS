import express from 'express';
import {
    getCalendar,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    updateWorkingDays,
    updateWorkingHours,
    getHolidaysForMonth,
    isWorkingDay,
    importIndianHolidays
} from '../../controllers/admin/calendarController.js';
import { 
    uploadCalendarFile, 
    getCalendarUploadHistory,
    upload 
} from '../../controllers/admin/calendarUploadController.js';
import isAdminOrHROrExecutiveAuthenticated from '../../middlewares/isAdminOrHROrExecutiveAuthenticated.js';

const router = express.Router();

// Get calendar for year
router.route('/:year')
    .get(isAdminOrHROrExecutiveAuthenticated, getCalendar);

// Add holiday
router.route('/:year/holidays')
    .post(isAdminOrHROrExecutiveAuthenticated, addHoliday);

// Update holiday
router.route('/:year/holidays/:holidayId')
    .put(isAdminOrHROrExecutiveAuthenticated, updateHoliday);

// Delete holiday
router.route('/:year/holidays/:holidayId')
    .delete(isAdminOrHROrExecutiveAuthenticated, deleteHoliday);

// Update working days
router.route('/:year/working-days')
    .put(isAdminOrHROrExecutiveAuthenticated, updateWorkingDays);

// Update working hours
router.route('/:year/working-hours')
    .put(isAdminOrHROrExecutiveAuthenticated, updateWorkingHours);

// Get holidays for month
router.route('/:year/:month/holidays')
    .get(isAdminOrHROrExecutiveAuthenticated, getHolidaysForMonth);

// Check if date is working day
router.route('/working-day/:date')
    .get(isAdminOrHROrExecutiveAuthenticated, isWorkingDay);

// Upload calendar file
router.route('/:year/upload')
    .post(isAdminOrHROrExecutiveAuthenticated, upload.single('calendarFile'), uploadCalendarFile);

// Get upload history
router.route('/:year/upload-history')
    .get(isAdminOrHROrExecutiveAuthenticated, getCalendarUploadHistory);

// Import Indian holidays
router.route('/:year/import-indian-holidays')
    .post(isAdminOrHROrExecutiveAuthenticated, importIndianHolidays);

export default router;
