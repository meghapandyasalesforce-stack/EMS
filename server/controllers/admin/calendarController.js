import Calendar from '../../models/calendar.model.js';
import logger from '../../helpers/logger.js';
import { sendSuccess, sendError, sendNotFound, sendValidationError, sendInternalError } from '../../helpers/responseHelper.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';

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
        const calendarData = {
            ...calendar.toObject(),
            holidays: calendar.holidays || [],
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
            new Date(h.date).getTime() === new Date(date).getTime()
        );

        if (existingHoliday) {
            return sendError(res, 'Holiday already exists for this date', 400, 'DUPLICATE_HOLIDAY');
        }

        const holiday = {
            name,
            date: new Date(date),
            type: type || 'national',
            description,
            isRecurring: isRecurring || false,
            recurringPattern: recurringPattern || 'yearly',
            isActive: true
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

        // Update holiday fields
        Object.keys(updates).forEach(key => {
            if (key === 'date') {
                holiday[key] = new Date(updates[key]);
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

        const holidays = calendar.holidays.filter(holiday => {
            const holidayDate = new Date(holiday.date);
            return holidayDate.getMonth() === monthNum && holiday.isActive;
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
        const isHoliday = calendar.holidays.some(holiday => {
            const holidayDate = new Date(holiday.date);
            return holidayDate.getTime() === checkDate.getTime() && holiday.isActive;
        });

        const isWorkingDay = isWorkingDayBySchedule && !isHoliday;

        return sendSuccess(res, {
            isWorkingDay,
            reason: isHoliday ? 'holiday' : (isWorkingDayBySchedule ? 'working_day' : 'weekend'),
            holiday: isHoliday ? calendar.holidays.find(h => 
                new Date(h.date).getTime() === checkDate.getTime() && h.isActive
            ) : null
        }, 'Working day status retrieved successfully');
    } catch (error) {
        logger.error('Check working day error', { error: error.message, stack: error.stack, date: req.params.date });
        return sendInternalError(res, 'Failed to check working day', error);
    }
};
