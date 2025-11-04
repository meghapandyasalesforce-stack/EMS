import express from 'express';
import {
    getCalendar,
    addHoliday,
    updateHoliday,
    deleteHoliday,
    updateWorkingDays,
    updateWorkingHours,
    getHolidaysForMonth,
    isWorkingDay
} from '../../controllers/admin/calendarController.js';
import { 
    uploadCalendarFile, 
    getCalendarUploadHistory,
    upload 
} from '../../controllers/admin/calendarUploadController.js';
import isAdminAuthenticated from '../../middlewares/isAdminAuthenticated.js';

const router = express.Router();

// Get calendar for year
router.route('/:year')
    .get(isAdminAuthenticated, getCalendar);

// Add holiday
router.route('/:year/holidays')
    .post(isAdminAuthenticated, addHoliday);

// Update holiday
router.route('/:year/holidays/:holidayId')
    .put(isAdminAuthenticated, updateHoliday);

// Delete holiday
router.route('/:year/holidays/:holidayId')
    .delete(isAdminAuthenticated, deleteHoliday);

// Update working days
router.route('/:year/working-days')
    .put(isAdminAuthenticated, updateWorkingDays);

// Update working hours
router.route('/:year/working-hours')
    .put(isAdminAuthenticated, updateWorkingHours);

// Get holidays for month
router.route('/:year/:month/holidays')
    .get(isAdminAuthenticated, getHolidaysForMonth);

// Check if date is working day
router.route('/working-day/:date')
    .get(isAdminAuthenticated, isWorkingDay);

// Upload calendar file
router.route('/:year/upload')
    .post(isAdminAuthenticated, upload.single('calendarFile'), uploadCalendarFile);

// Get upload history
router.route('/:year/upload-history')
    .get(isAdminAuthenticated, getCalendarUploadHistory);

export default router;
