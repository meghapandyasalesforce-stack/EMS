import Calendar from '../../models/calendar.model.js';
import AttendanceRule from '../../models/attendanceRule.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError, sendInternalError } from '../../helpers/responseHelper.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import { detectHolidayTheme, isIndianHoliday } from '../../helpers/indianHolidayService.js';
import asyncHandler from '../../middlewares/asyncHandler.js';
import {
    expandDateRange,
    findWfhEntryOnCalendar,
    parseLocalDate,
    toDateKey,
} from '../../helpers/wfhCalendarHelper.js';

const toStartOfDay = (value) => {
    const parsed = parseLocalDate(value);
    if (parsed) return parsed;
    const d = new Date(value);
    d.setHours(0, 0, 0, 0);
    return d;
};

const actorEmployeeId = (req) => req.employee?._id || req.user?._id || null;

const ensureCalendarForYear = async (organizationId, yearNum) => {
    let calendar = await Calendar.findOne({ organizationId, year: yearNum });
    if (!calendar) {
        calendar = new Calendar({
            organizationId,
            year: yearNum,
            holidays: [],
            wfhDates: [],
            workingDays: {
                monday: true,
                tuesday: true,
                wednesday: true,
                thursday: true,
                friday: true,
                saturday: false,
                sunday: false
            },
            workingHours: {
                startTime: '09:00',
                endTime: '17:00',
                breakDuration: 60
            },
            companySettings: {
                timezone: 'UTC',
                dateFormat: 'DD/MM/YYYY',
                weekStartsOn: 'monday'
            }
        });
        await calendar.save();
    }
    return calendar;
};

const isPastDate = (value) => {
    const target = toStartOfDay(value);
    const today = toStartOfDay(new Date());
    return target < today;
};

const WEEKDAY_NAMES = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

/** WFH is only meaningful on org working days (not weekends/off days or blocking holidays). */
const isWfhEligibleDay = (calendar, day) => {
    if (!day || Number.isNaN(day.getTime())) return false;
    const dayName = WEEKDAY_NAMES[day.getDay()];
    const workingDays = calendar?.workingDays || {};
    if (workingDays[dayName] === false) return false;
    const dayKey = toDateKey(day);
    const holidays = calendar?.holidays || [];
    const onBlockingHoliday = holidays.some((holiday) => {
        if (holiday?.isActive === false) return false;
        if (holiday?.workModeOverride === 'office' || holiday?.workModeOverride === 'home') return false;
        return toDateKey(holiday.date) === dayKey;
    });
    return !onBlockingHoliday;
};

// Get calendar for a specific year
export const getCalendar = async (req, res) => {
    try {
        const { year } = req.params;
        const yearNum = parseInt(year);
        
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }

        // Get organizationId from request
        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Find calendar by year and organizationId
        const query = addOrganizationFilter(req, { year: yearNum });
        let calendar = await Calendar.findOne(query);

        // Create calendar if it doesn't exist
        if (!calendar) {
            calendar = new Calendar({
                organizationId: organizationId,
                year: yearNum,
                holidays: [],
                wfhDates: [],
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                workingHours: {
                    startTime: "09:00",
                    endTime: "17:00",
                    breakDuration: 60
                },
                companySettings: {
                    timezone: "UTC",
                    dateFormat: "DD/MM/YYYY",
                    weekStartsOn: "monday"
                }
            });
            await calendar.save();
        }

        // Return calendar data in the format expected by frontend
        // Frontend expects response.data to contain the calendar object
        // Since sendSuccess merges object properties, we need to manually construct the response
        await calendar.populate({
            path: 'wfhDates.excludedEmployeeIds',
            select: 'name lastName employeeId department'
        });

        const calendarData = {
            ...calendar.toObject(),
            holidays: calendar.holidays || [],
            wfhDates: calendar.wfhDates || [],
            workingDays: calendar.workingDays || {},
            workingHours: calendar.workingHours || {},
            companySettings: calendar.companySettings || {}
        };
        
        // Return with data property to match frontend expectations
        return res.status(200).json({
            success: true,
            message: 'Calendar retrieved successfully',
            data: calendarData
        });
    } catch (error) {
        logger.error('Get calendar error', { error: error.message, stack: error.stack, year: req.params.year });
        return sendInternalError(res, 'Failed to get calendar', error);
    }
};

// Add holiday
export const addHoliday = async (req, res) => {
    try {
        const { year } = req.params;
        const { name, date, type, description, isRecurring, recurringPattern } = req.body;

        const yearNum = parseInt(year);
        if (isNaN(yearNum)) {
            return sendValidationError(res, { year: 'Invalid year' });
        }
        const holidayDate = new Date(date);
        if (isNaN(holidayDate.getTime())) {
            return sendValidationError(res, { date: 'Invalid holiday date' });
        }
        if (holidayDate.getFullYear() !== yearNum) {
            return sendValidationError(res, {
                date: `Holiday date year (${holidayDate.getFullYear()}) must match selected calendar year (${yearNum})`
            });
        }
        if (isPastDate(holidayDate)) {
            return sendValidationError(res, {
                date: 'Cannot add holidays for past dates. Only today or future dates are allowed.'
            });
        }

        // Get organizationId from request
        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        // Find calendar by year and organizationId
        const query = addOrganizationFilter(req, { year: yearNum });
        let calendar = await Calendar.findOne(query);
        if (!calendar) {
            calendar = new Calendar({ 
                organizationId: organizationId,
                year: yearNum 
            });
        }

        // Check if holiday already exists for this date
        const existingHoliday = calendar.holidays.find(h => 
            new Date(h.date).getTime() === holidayDate.getTime()
        );

        if (existingHoliday) {
            return sendError(res, 'Holiday already exists for this date', 400, 'DUPLICATE_HOLIDAY');
        }

        // Auto-detect theme if not provided
        const themeData = detectHolidayTheme(name, type || 'national');
        
        const holiday = {
            name,
            date: holidayDate,
            type: type || 'national',
            description,
            theme: themeData.theme,
            icon: themeData.icon,
            color: themeData.color,
            isRecurring: isRecurring || false,
            recurringPattern: recurringPattern || 'yearly',
            isActive: true,
            source: 'manual'
        };

        calendar.holidays.push(holiday);
        await calendar.save();

        return sendSuccess(res, { holiday }, 'Holiday added successfully', 201);
    } catch (error) {
        logger.error('Add holiday error', { error: error.message, stack: error.stack, year: req.params.year });
        return sendInternalError(res, 'Failed to add holiday', error);
    }
};

// Update holiday
export const updateHoliday = async (req, res) => {
    try {
        const { year, holidayId } = req.params;
        const updates = req.body;

        const yearNum = parseInt(year);
        const query = addOrganizationFilter(req, { year: yearNum });
        const calendar = await Calendar.findOne(query);

        if (!calendar) {
            return sendNotFound(res, 'Calendar');
        }

        const holiday = calendar.holidays.id(holidayId);
        if (!holiday) {
            return sendNotFound(res, 'Holiday');
        }
        if (isPastDate(holiday.date)) {
            return sendValidationError(res, {
                date: 'Past holidays cannot be updated.'
            });
        }

        if (updates.date) {
            const updatedDate = new Date(updates.date);
            if (isNaN(updatedDate.getTime())) {
                return sendValidationError(res, { date: 'Invalid holiday date' });
            }
            if (updatedDate.getFullYear() !== yearNum) {
                return sendValidationError(res, {
                    date: `Holiday date year (${updatedDate.getFullYear()}) must match selected calendar year (${yearNum})`
                });
            }
            if (isPastDate(updatedDate)) {
                return sendValidationError(res, {
                    date: 'Cannot set holiday date in the past. Only today or future dates are allowed.'
                });
            }
        }

        // Update holiday fields
        Object.keys(updates).forEach(key => {
            if (key === 'date') {
                holiday[key] = new Date(updates[key]);
            } else if (key === 'name' || key === 'type') {
                // Auto-update theme if name or type changes
                holiday[key] = updates[key];
                if (key === 'name' || (key === 'type' && !updates.theme)) {
                    const themeData = detectHolidayTheme(holiday.name, holiday.type);
                    holiday.theme = themeData.theme;
                    holiday.icon = themeData.icon;
                    holiday.color = themeData.color;
                }
            } else {
                holiday[key] = updates[key];
            }
        });

        await calendar.save();

        return sendSuccess(res, { holiday }, 'Holiday updated successfully');
    } catch (error) {
        logger.error('Update holiday error', { error: error.message, stack: error.stack, holidayId: req.params.holidayId });
        return sendInternalError(res, 'Failed to update holiday', error);
    }
};

// Delete holiday
export const deleteHoliday = async (req, res) => {
    try {
        const { year, holidayId } = req.params;
        logger.info('Attempting to delete holiday', { holidayId, year });

        const yearNum = parseInt(year);
        if (isNaN(yearNum)) {
            return sendValidationError(res, { year: 'Invalid year parameter' });
        }

        const query = addOrganizationFilter(req, { year: yearNum });
        const calendar = await Calendar.findOne(query);
        if (!calendar) {
            logger.warn('Calendar not found', { year: yearNum });
            return sendNotFound(res, 'Calendar');
        }

        logger.debug('Found calendar', { holidayCount: calendar.holidays.length, year: yearNum });

        const holiday = calendar.holidays.id(holidayId);
        if (!holiday) {
            logger.warn('Holiday not found', { holidayId, year: yearNum });
            return sendNotFound(res, 'Holiday');
        }
        if (isPastDate(holiday.date)) {
            return sendValidationError(res, {
                date: 'Past holidays cannot be deleted.'
            });
        }

        logger.debug('Found holiday', { holidayName: holiday.name, holidayDate: holiday.date, holidayId });

        // Use pull method to remove the holiday from the array
        calendar.holidays.pull(holidayId);
        await calendar.save();

        logger.info('Successfully deleted holiday', { holidayId, year: yearNum });
        return sendSuccess(res, null, 'Holiday deleted successfully');
    } catch (error) {
        logger.error('Delete holiday error', {
            error: error.message,
            stack: error.stack,
            name: error.name
        });
        return sendInternalError(res, 'Failed to delete holiday', error);
    }
};

/**
 * Convert a holiday into a working day (office or home) without deleting the holiday record.
 * Body: { workMode: 'office' | 'home' }
 * - office: day counts as normal office working day
 * - home: day counts as working + WFH enabled so employees can apply / punch home after approval
 */
export const convertHolidayToWorkingDay = async (req, res) => {
    try {
        const yearNum = parseInt(req.params.year, 10);
        const { holidayId } = req.params;
        const workMode = String(req.body?.workMode || '').trim().toLowerCase();

        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }
        if (workMode !== 'office' && workMode !== 'home') {
            return sendValidationError(res, { workMode: 'workMode must be "office" or "home"' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const calendar = await Calendar.findOne({ organizationId, year: yearNum });
        if (!calendar) return sendNotFound(res, 'Calendar');

        const holiday = calendar.holidays.id(holidayId);
        if (!holiday) return sendNotFound(res, 'Holiday');
        if (holiday.isActive === false) {
            return sendValidationError(res, { holiday: 'Inactive holidays cannot be converted' });
        }

        holiday.workModeOverride = workMode;
        const dayKey = toDateKey(holiday.date);
        const actor = actorEmployeeId(req);

        if (!Array.isArray(calendar.wfhDates)) calendar.wfhDates = [];

        if (workMode === 'home') {
            const existingIndex = calendar.wfhDates.findIndex((entry) => toDateKey(entry.date) === dayKey);
            if (existingIndex >= 0) {
                const existing = calendar.wfhDates[existingIndex];
                existing.note = existing.note || `Converted from holiday: ${holiday.name}`;
                existing.updatedBy = actor;
            } else {
                const day = parseLocalDate(dayKey);
                calendar.wfhDates.push({
                    date: day || holiday.date,
                    employeeAccess: 'all_except',
                    excludedEmployeeIds: [],
                    note: `Converted from holiday: ${holiday.name}`,
                    createdBy: actor,
                    updatedBy: actor
                });
            }
        } else {
            // Office mode — remove WFH on this date so it is clearly office work
            calendar.wfhDates = calendar.wfhDates.filter((entry) => toDateKey(entry.date) !== dayKey);
        }

        calendar.markModified('holidays');
        calendar.markModified('wfhDates');
        await calendar.save({ validateBeforeSave: true });
        await calendar.populate({
            path: 'wfhDates.excludedEmployeeIds',
            select: 'name lastName employeeId department'
        });

        return sendSuccess(res, {
            holiday,
            wfhDates: calendar.wfhDates || [],
            holidays: calendar.holidays || []
        }, workMode === 'home'
            ? 'Holiday converted to working day (Work From Home)'
            : 'Holiday converted to working day (Office)');
    } catch (error) {
        logger.error('Convert holiday to working day error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to convert holiday', error);
    }
};

/**
 * Restore a converted holiday back to a normal off day.
 * Removes auto-enabled WFH for that date when it was converted to home.
 */
export const restoreHolidayFromWorkingDay = async (req, res) => {
    try {
        const yearNum = parseInt(req.params.year, 10);
        const { holidayId } = req.params;

        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const calendar = await Calendar.findOne({ organizationId, year: yearNum });
        if (!calendar) return sendNotFound(res, 'Calendar');

        const holiday = calendar.holidays.id(holidayId);
        if (!holiday) return sendNotFound(res, 'Holiday');

        const previousMode = holiday.workModeOverride;
        holiday.workModeOverride = null;
        const dayKey = toDateKey(holiday.date);

        if (previousMode === 'home' && Array.isArray(calendar.wfhDates)) {
            calendar.wfhDates = calendar.wfhDates.filter((entry) => toDateKey(entry.date) !== dayKey);
            calendar.markModified('wfhDates');
        }

        calendar.markModified('holidays');
        await calendar.save({ validateBeforeSave: true });

        return sendSuccess(res, {
            holiday,
            wfhDates: calendar.wfhDates || [],
            holidays: calendar.holidays || []
        }, 'Holiday restored as a non-working day');
    } catch (error) {
        logger.error('Restore holiday error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to restore holiday', error);
    }
};

// Update working days
export const updateWorkingDays = async (req, res) => {
    try {
        const { year } = req.params;
        const { workingDays } = req.body;

        const yearNum = parseInt(year);
        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const query = addOrganizationFilter(req, { year: yearNum });
        let calendar = await Calendar.findOne(query);

        if (!calendar) {
            calendar = new Calendar({ 
                organizationId: organizationId,
                year: yearNum 
            });
        }

        calendar.workingDays = { ...calendar.workingDays, ...workingDays };
        await calendar.save();

        return sendSuccess(res, { workingDays: calendar.workingDays }, 'Working days updated successfully');
    } catch (error) {
        logger.error('Update working days error', { error: error.message, stack: error.stack, year: req.params.year });
        return sendInternalError(res, 'Failed to update working days', error);
    }
};

// Update working hours
export const updateWorkingHours = async (req, res) => {
    try {
        const { year } = req.params;
        const { workingHours } = req.body;

        const yearNum = parseInt(year);
        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const query = addOrganizationFilter(req, { year: yearNum });
        let calendar = await Calendar.findOne(query);

        if (!calendar) {
            calendar = new Calendar({ 
                organizationId: organizationId,
                year: yearNum 
            });
        }

        calendar.workingHours = { ...calendar.workingHours, ...workingHours };
        await calendar.save();

        // Keep attendance office hours in sync with calendar working hours.
        try {
            const now = new Date();
            const attendanceRuleQuery = addOrganizationFilter(req, {
                isActive: true,
                effectiveDate: { $lte: now },
                $or: [{ expiryDate: null }, { expiryDate: { $gte: now } }]
            });
            const attendanceRule = await AttendanceRule.findOne(attendanceRuleQuery)
                .sort({ priority: -1, createdAt: -1 });

            if (attendanceRule) {
                attendanceRule.officeHours = {
                    ...attendanceRule.officeHours,
                    startTime: calendar.workingHours?.startTime || attendanceRule.officeHours?.startTime || '09:00',
                    endTime: calendar.workingHours?.endTime || attendanceRule.officeHours?.endTime || '17:00'
                };
                await attendanceRule.save();
            }
        } catch (syncError) {
            logger.error('Sync calendar->attendance working hours failed', {
                error: syncError.message,
                stack: syncError.stack,
                year: yearNum
            });
        }

        return sendSuccess(res, { workingHours: calendar.workingHours }, 'Working hours updated successfully');
    } catch (error) {
        logger.error('Update working hours error', { error: error.message, stack: error.stack, year: req.params.year });
        return sendInternalError(res, 'Failed to update working hours', error);
    }
};

// Get holidays for a specific month
export const getHolidaysForMonth = async (req, res) => {
    try {
        const { year, month } = req.params;
        const yearNum = parseInt(year);
        const monthNum = parseInt(month) - 1; // JavaScript months are 0-indexed

        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
            return sendValidationError(res, { month: 'Invalid year or month' });
        }

        const query = addOrganizationFilter(req, { year: yearNum });
        const calendar = await Calendar.findOne(query);
        if (!calendar) {
            return sendSuccess(res, { holidays: [] }, 'Holidays retrieved successfully');
        }

        const holidays = calendar.holidays
            .filter(holiday => {
                const holidayDate = new Date(holiday.date);
                return holidayDate.getMonth() === monthNum && holiday.isActive;
            })
            .map(holiday => {
                const holidayObj = holiday.toObject ? holiday.toObject() : holiday;
                if (!holidayObj.theme) {
                    const themeData = detectHolidayTheme(holidayObj.name, holidayObj.type || 'national');
                    return {
                        ...holidayObj,
                        theme: themeData.theme,
                        icon: themeData.icon,
                        color: themeData.color
                    };
                }
                return holidayObj;
            });

        return sendSuccess(res, { holidays }, 'Holidays retrieved successfully');
    } catch (error) {
        logger.error('Get holidays error', { error: error.message, stack: error.stack, year: req.params.year });
        return sendInternalError(res, 'Failed to get holidays', error);
    }
};

// Check if a date is a working day
export const isWorkingDay = async (req, res) => {
    try {
        const { date } = req.params;
        const checkDate = new Date(date);

        if (isNaN(checkDate.getTime())) {
            return sendValidationError(res, { date: 'Invalid date format' });
        }

        const year = checkDate.getFullYear();
        const query = addOrganizationFilter(req, { year });
        const calendar = await Calendar.findOne(query);

        if (!calendar) {
            // Default working days if no calendar exists
            const dayOfWeek = checkDate.getDay();
            const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
            return res.json({ isWorkingDay, reason: 'default' });
        }

        const dayOfWeek = checkDate.getDay();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        const isWorkingDayBySchedule = calendar.workingDays[dayName];

        // Check if it's a holiday
        const checkKey = toDateKey(checkDate);
        const holidayData = (calendar.holidays || []).find((h) => {
            if (!h?.isActive) return false;
            return toDateKey(h.date) === checkKey;
        }) || null;
        const isBlockingHoliday =
            Boolean(holidayData) &&
            holidayData.workModeOverride !== 'office' &&
            holidayData.workModeOverride !== 'home';

        const isWorkingDay = isWorkingDayBySchedule && !isBlockingHoliday;

        const reason = !isWorkingDayBySchedule
            ? 'weekend'
            : isBlockingHoliday
              ? 'holiday'
              : holidayData?.workModeOverride === 'home'
                ? 'holiday_converted_home'
                : holidayData?.workModeOverride === 'office'
                  ? 'holiday_converted_office'
                  : 'working_day';

        return sendSuccess(res, {
            isWorkingDay,
            reason,
            holiday: holidayData ? {
                ...(holidayData.toObject ? holidayData.toObject() : holidayData),
                theme: holidayData.theme || 'default',
                icon: holidayData.icon || '📅',
                color: holidayData.color || '#808080'
            } : null
        }, 'Working day status retrieved successfully');
    } catch (error) {
        logger.error('Check working day error', { error: error.message, stack: error.stack, date: req.params.date });
        return sendInternalError(res, 'Failed to check working day', error);
    }
};

/**
 * Import Indian holidays to calendar
 */
export const importIndianHolidays = asyncHandler(async (req, res) => {
    try {
        const { year } = req.params;
        const yearNum = parseInt(year);
        
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const query = addOrganizationFilter(req, { year: yearNum });
        let calendar = await Calendar.findOne(query);

        if (!calendar) {
            calendar = new Calendar({
                organizationId: organizationId,
                year: yearNum,
                holidays: [],
                workingDays: {
                    monday: true,
                    tuesday: true,
                    wednesday: true,
                    thursday: true,
                    friday: true,
                    saturday: false,
                    sunday: false
                },
                workingHours: {
                    startTime: "09:00",
                    endTime: "17:00",
                    breakDuration: 60
                },
                companySettings: {
                    timezone: "UTC",
                    dateFormat: "DD/MM/YYYY",
                    weekStartsOn: "monday"
                }
            });
        }

        const { importIndianHolidays: importHolidays } = await import('../../helpers/indianHolidayService.js');
        const result = await importHolidays(calendar, yearNum, organizationId);

        // Enhance holidays with theme data
        const enhancedHolidays = calendar.holidays.map(holiday => {
            const holidayObj = holiday.toObject ? holiday.toObject() : holiday;
            if (!holidayObj.theme) {
                const themeData = detectHolidayTheme(holidayObj.name, holidayObj.type || 'national');
                return {
                    ...holidayObj,
                    theme: themeData.theme,
                    icon: themeData.icon,
                    color: themeData.color
                };
            }
            return holidayObj;
        });

        return sendSuccess(res, {
            imported: result.imported,
            duplicates: result.duplicates,
            totalHolidays: calendar.holidays.length,
            holidays: enhancedHolidays
        }, `Indian holidays imported successfully. ${result.imported} holidays added, ${result.duplicates} duplicates skipped.`);
    } catch (error) {
        logger.error('Import Indian holidays error', {
            error: error.message,
            stack: error.stack,
            year: req.params.year
        });
        return sendInternalError(res, 'Failed to import Indian holidays', error);
    }
});

/**
 * Enable WFH for a date or inclusive date range (creates missing day entries).
 * Body: { dateFrom, dateTo?, note?, excludedEmployeeIds? }
 */
export const enableWfhDates = async (req, res) => {
    try {
        const yearNum = parseInt(req.params.year, 10);
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const { dateFrom, dateTo, note, excludedEmployeeIds, employeeAccess } = req.body || {};
        const from = parseLocalDate(dateFrom || req.body?.date);
        const to = parseLocalDate(dateTo || dateFrom || req.body?.date);
        if (!from || !to) {
            return sendValidationError(res, { dateFrom: 'A valid date or date range is required' });
        }
        if (to < from) {
            return sendValidationError(res, { dateTo: 'End date cannot be before start date' });
        }

        const days = expandDateRange(from, to);
        const outOfYear = days.filter((d) => d.getFullYear() !== yearNum);
        if (outOfYear.length) {
            return sendValidationError(res, {
                dateFrom: `All dates must fall within calendar year ${yearNum}`
            });
        }

        const exclusionIds = Array.isArray(excludedEmployeeIds)
            ? [...new Set(excludedEmployeeIds.map((id) => String(id)).filter(Boolean))]
            : [];
        const accessMode =
            employeeAccess === 'only_these' ? 'only_these' : 'all_except';
        if (accessMode === 'only_these' && exclusionIds.length === 0) {
            return sendValidationError(res, {
                excludedEmployeeIds:
                    'Select at least one employee when “Only selected employees” is used'
            });
        }

        const calendar = await ensureCalendarForYear(organizationId, yearNum);
        if (!Array.isArray(calendar.wfhDates)) calendar.wfhDates = [];

        const actor = actorEmployeeId(req);
        let added = 0;
        let updated = 0;
        let skippedPast = 0;
        let skippedNonWorking = 0;

        // Drop any existing WFH rows in this range that fall on non-working / holiday days
        const rangeKeys = new Set(days.map((d) => toDateKey(d)).filter(Boolean));
        const beforeCleanup = calendar.wfhDates.length;
        calendar.wfhDates = (calendar.wfhDates || []).filter((entry) => {
            const key = toDateKey(entry.date);
            if (!rangeKeys.has(key)) return true;
            const entryDay = parseLocalDate(entry.date) || new Date(entry.date);
            return isWfhEligibleDay(calendar, entryDay);
        });
        const cleanedNonWorking = beforeCleanup - calendar.wfhDates.length;

        for (const day of days) {
            if (!isWfhEligibleDay(calendar, day)) {
                skippedNonWorking += 1;
                continue;
            }
            const dayKey = toDateKey(day);
            const existingIndex = (calendar.wfhDates || []).findIndex(
                (entry) => toDateKey(entry.date) === dayKey
            );
            if (existingIndex >= 0) {
                // Always allow updating note/exclusions on already-enabled dates (incl. past).
                const existing = calendar.wfhDates[existingIndex];
                if (note != null) existing.note = String(note).trim();
                existing.employeeAccess = accessMode;
                if (Array.isArray(excludedEmployeeIds)) {
                    existing.set?.('excludedEmployeeIds', exclusionIds);
                    if (!existing.set) existing.excludedEmployeeIds = exclusionIds;
                }
                existing.updatedBy = actor;
                updated += 1;
            } else if (isPastDate(day)) {
                // Do not create brand-new WFH rows for past dates
                skippedPast += 1;
            } else {
                calendar.wfhDates.push({
                    date: day,
                    employeeAccess: accessMode,
                    excludedEmployeeIds: exclusionIds,
                    note: note ? String(note).trim() : '',
                    createdBy: actor,
                    updatedBy: actor
                });
                added += 1;
            }
        }

        if (added === 0 && updated === 0) {
            return sendValidationError(res, {
                dateFrom: skippedPast && !skippedNonWorking
                    ? 'Cannot enable WFH for past dates. Only today or future dates are allowed.'
                    : skippedNonWorking
                      ? 'WFH can only be enabled on working days (not weekends, off days, or holidays).'
                      : 'No dates were updated'
            });
        }

        if (cleanedNonWorking > 0) {
            logger.info('Removed WFH from non-working days in range', {
                cleanedNonWorking,
                organizationId: String(organizationId),
                year: yearNum
            });
        }

        // Nested array mutations are not always detected — force persistence.
        calendar.markModified('wfhDates');
        await calendar.save({ validateBeforeSave: true });
        await calendar.populate({
            path: 'wfhDates.excludedEmployeeIds',
            select: 'name lastName employeeId department'
        });

        return sendSuccess(res, {
            added,
            updated,
            wfhDates: calendar.wfhDates || []
        }, `WFH enabled for ${added + updated} date(s)`);
    } catch (error) {
        logger.error('Enable WFH dates error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to enable WFH dates', error);
    }
};

/**
 * Disable WFH for a date or inclusive date range (removes day entries).
 * Body: { dateFrom, dateTo? } or { dates: ['YYYY-MM-DD', ...] }
 */
export const disableWfhDates = async (req, res) => {
    try {
        const yearNum = parseInt(req.params.year, 10);
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        let keys = new Set();
        if (Array.isArray(req.body?.dates) && req.body.dates.length) {
            req.body.dates.forEach((d) => {
                const key = toDateKey(d);
                if (key) keys.add(key);
            });
        } else {
            const from = parseLocalDate(req.body?.dateFrom || req.body?.date);
            const to = parseLocalDate(req.body?.dateTo || req.body?.dateFrom || req.body?.date);
            expandDateRange(from, to).forEach((d) => keys.add(toDateKey(d)));
        }

        if (!keys.size) {
            return sendValidationError(res, { dateFrom: 'A valid date or date range is required' });
        }

        const calendar = await Calendar.findOne({ organizationId, year: yearNum });
        if (!calendar || !calendar.wfhDates?.length) {
            return sendSuccess(res, { removed: 0, wfhDates: [] }, 'No WFH dates to disable');
        }

        const before = calendar.wfhDates.length;
        const remaining = (calendar.wfhDates || []).filter(
            (entry) => !keys.has(toDateKey(entry.date))
        );
        calendar.set('wfhDates', remaining);
        calendar.markModified('wfhDates');
        const removed = before - remaining.length;
        await calendar.save({ validateBeforeSave: true });

        return sendSuccess(res, {
            removed,
            wfhDates: calendar.wfhDates || []
        }, `WFH disabled for ${removed} date(s)`);
    } catch (error) {
        logger.error('Disable WFH dates error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to disable WFH dates', error);
    }
};

/**
 * Replace excluded employees for one WFH-enabled date.
 * Body: { date, excludedEmployeeIds: [] }
 */
export const updateWfhExclusions = async (req, res) => {
    try {
        const yearNum = parseInt(req.params.year, 10);
        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return sendValidationError(res, { year: 'Invalid year. Must be between 2020 and 2050' });
        }

        const organizationId = getOrganizationId(req);
        if (!organizationId) {
            return sendError(res, 'Organization ID is required', 400, 'MISSING_ORGANIZATION_ID');
        }

        const date = parseLocalDate(req.body?.date);
        if (!date || date.getFullYear() !== yearNum) {
            return sendValidationError(res, { date: `A valid date in ${yearNum} is required` });
        }

        if (!Array.isArray(req.body?.excludedEmployeeIds)) {
            return sendValidationError(res, {
                excludedEmployeeIds: 'excludedEmployeeIds must be an array'
            });
        }

        const calendar = await Calendar.findOne({ organizationId, year: yearNum });
        if (!calendar) {
            return sendNotFound(res, 'Calendar not found');
        }

        const entry = findWfhEntryOnCalendar(calendar, date);
        if (!entry) {
            return sendError(
                res,
                'WFH is not enabled for this date. Enable WFH first, then manage exclusions.',
                400,
                'WFH_DATE_NOT_ENABLED'
            );
        }

        entry.excludedEmployeeIds = [
            ...new Set(req.body.excludedEmployeeIds.map((id) => String(id)).filter(Boolean))
        ];
        entry.updatedBy = actorEmployeeId(req);
        entry.markModified?.('excludedEmployeeIds');
        calendar.markModified('wfhDates');
        await calendar.save();
        await calendar.populate({
            path: 'wfhDates.excludedEmployeeIds',
            select: 'name lastName employeeId department'
        });

        const refreshed = findWfhEntryOnCalendar(calendar, date);
        return sendSuccess(res, { entry: refreshed, wfhDates: calendar.wfhDates || [] }, 'WFH exclusions updated');
    } catch (error) {
        logger.error('Update WFH exclusions error', { error: error.message, stack: error.stack });
        return sendInternalError(res, 'Failed to update WFH exclusions', error);
    }
};
