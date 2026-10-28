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
    importIndianHolidays,
    enableWfhDates,
    disableWfhDates,
    updateWfhExclusions,
    convertHolidayToWorkingDay,
    restoreHolidayFromWorkingDay
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

// Convert holiday ↔ working day (office or home)
router.route('/:year/holidays/:holidayId/convert-to-working')
    .post(isAdminOrHROrExecutiveAuthenticated, convertHolidayToWorkingDay);

router.route('/:year/holidays/:holidayId/restore-holiday')
    .post(isAdminOrHROrExecutiveAuthenticated, restoreHolidayFromWorkingDay);

// Update working days
router.route('/:year/working-days')
    .put(isAdminOrHROrExecutiveAuthenticated, updateWorkingDays);

// Update working hours
router.route('/:year/working-hours')
    .put(isAdminOrHROrExecutiveAuthenticated, updateWorkingHours);

// WFH availability (HR calendar) — does not affect attendance punch rules
// Registered before /:year/:month/... so "wfh" is not treated as a month
router.route('/:year/wfh')
    .post(isAdminOrHROrExecutiveAuthenticated, enableWfhDates)
    .delete(isAdminOrHROrExecutiveAuthenticated, disableWfhDates);

router.route('/:year/wfh/exclusions')
    .put(isAdminOrHROrExecutiveAuthenticated, updateWfhExclusions);

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
