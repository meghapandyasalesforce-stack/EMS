import Calendar from '../../models/calendar.model.js';
import logger from '../../helpers/logger.js';
import { detectHolidayTheme } from '../../helpers/indianHolidayService.js';
import { addOrganizationFilter } from '../../helpers/organizationHelper.js';

// Get calendar for year (employee view - read-only)
export const getEmployeeCalendar = async (req, res) => {
  try {
    const { year } = req.params;
    const yearNum = parseInt(year);
    
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
      return res.status(400).json({ message: 'Invalid year. Must be between 2020 and 2050' });
    }

    // Get calendar for the year
    const query = addOrganizationFilter(req, { year: yearNum });
    let calendar = await Calendar.findOne(query);
    
    if (!calendar) {
      // Return empty calendar if not found
      calendar = {
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
      };
    }

    // Filter only active holidays for employee view and enhance with theme
    const activeHolidays = (calendar.holidays || [])
      .filter(holiday => holiday.isActive)
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

    // HR-enabled WFH dates for apply eligibility (no attendance/punch impact)
    const employeeId = String(req.employee?._id || '');
    const wfhDates = (calendar.wfhDates || []).map((entry) => {
      const obj = entry.toObject ? entry.toObject() : entry;
      const excludedIds = (obj.excludedEmployeeIds || []).map((id) => String(id?._id || id));
      const access = obj.employeeAccess === 'only_these' ? 'only_these' : 'all_except';
      const inList = employeeId ? excludedIds.includes(employeeId) : false;
      const blocked =
        !employeeId
          ? false
          : access === 'only_these'
            ? !inList
            : inList;
      return {
        date: obj.date,
        employeeAccess: access,
        excluded: blocked,
      };
    });

    const base = calendar.toObject ? calendar.toObject() : calendar;
    res.json({
      ...base,
      holidays: activeHolidays,
      wfhDates,
    });

  } catch (error) {
    logger.error('Get employee calendar error', { error: error.message, stack: error.stack, employeeId: req.employee?._id });
    res.status(500).json({ message: 'Failed to fetch calendar', error: error.message });
  }
};

// Get holidays for a specific month
export const getHolidaysForMonth = async (req, res) => {
  try {
    const { year, month } = req.params;
    const yearNum = parseInt(year);
    const monthNum = parseInt(month);
    
    if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
      return res.status(400).json({ message: 'Invalid year. Must be between 2020 and 2050' });
    }
    
    if (isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return res.status(400).json({ message: 'Invalid month. Must be between 1 and 12' });
    }

    const query = addOrganizationFilter(req, { year: yearNum });
    const calendar = await Calendar.findOne(query);
    
    if (!calendar) {
      return res.json({ holidays: [] });
    }

    // Filter holidays for the specific month
    const monthHolidays = calendar.holidays.filter(holiday => {
      const holidayDate = new Date(holiday.date);
      return holidayDate.getMonth() === monthNum - 1 && holiday.isActive;
    });

    res.json({ holidays: monthHolidays });

  } catch (error) {
    logger.error('Get holidays for month error', { error: error.message, stack: error.stack, year: req.params.year, month: req.params.month });
    res.status(500).json({ message: 'Failed to fetch holidays', error: error.message });
  }
};

// Check if a specific date is a working day
export const isWorkingDay = async (req, res) => {
  try {
    const { date } = req.params;
    const checkDate = new Date(date);
    
    if (isNaN(checkDate.getTime())) {
      return res.status(400).json({ message: 'Invalid date format' });
    }

    const year = checkDate.getFullYear();
    const query = addOrganizationFilter(req, { year });
    const calendar = await Calendar.findOne(query);
    
    if (!calendar) {
      // Default working days if no calendar found
      const dayOfWeek = checkDate.getDay();
      const isWorking = dayOfWeek >= 1 && dayOfWeek <= 5; // Monday to Friday
      return res.json({ 
        isWorkingDay: isWorking,
        isHoliday: false,
        holidayName: null
      });
    }

    const dayOfWeek = checkDate.getDay();
    const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
    const isWorkingDay = calendar.workingDays[dayName];

    const holiday = calendar.holidays.find((h) => {
      if (!h?.isActive) return false;
      const holidayDate = new Date(h.date);
      return holidayDate.getDate() === checkDate.getDate() &&
             holidayDate.getMonth() === checkDate.getMonth() &&
             holidayDate.getFullYear() === checkDate.getFullYear();
    });
    const isBlockingHoliday =
      Boolean(holiday) &&
      holiday.workModeOverride !== 'office' &&
      holiday.workModeOverride !== 'home';

    res.json({
      isWorkingDay: isWorkingDay && !isBlockingHoliday,
      isHoliday: isBlockingHoliday,
      holidayName: holiday ? holiday.name : null,
      holidayType: holiday ? holiday.type : null,
      workModeOverride: holiday?.workModeOverride || null
    });

  } catch (error) {
    logger.error('Check working day error', { error: error.message, stack: error.stack, date: req.params.date });
    res.status(500).json({ message: 'Failed to check working day', error: error.message });
  }
};
