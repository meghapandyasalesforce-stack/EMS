import Calendar from '../../models/calendar.model.js';

// Get calendar for a specific year
export const getCalendar = async (req, res) => {
    try {
        const { year } = req.params;
        const yearNum = parseInt(year);

        if (isNaN(yearNum) || yearNum < 2020 || yearNum > 2050) {
            return res.status(400).json({ message: 'Invalid year. Must be between 2020 and 2050' });
        }

        let calendar = await Calendar.findOne({ year: yearNum });

        // Create calendar if it doesn't exist
        if (!calendar) {
            calendar = new Calendar({
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

        res.json(calendar);
    } catch (error) {
        console.error('Get calendar error:', error);
        res.status(500).json({ message: 'Failed to get calendar', error: error.message });
    }
};

// Add holiday
export const addHoliday = async (req, res) => {
    try {
        const { year } = req.params;
        const { name, date, type, description, isRecurring, recurringPattern } = req.body;

        const yearNum = parseInt(year);
        if (isNaN(yearNum)) {
            return res.status(400).json({ message: 'Invalid year' });
        }

        let calendar = await Calendar.findOne({ year: yearNum });
        if (!calendar) {
            calendar = new Calendar({ year: yearNum });
        }

        // Check if holiday already exists for this date
        const existingHoliday = calendar.holidays.find(h => 
            new Date(h.date).getTime() === new Date(date).getTime()
        );

        if (existingHoliday) {
            return res.status(400).json({ message: 'Holiday already exists for this date' });
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

        res.status(201).json({
            message: 'Holiday added successfully',
            holiday
        });
    } catch (error) {
        console.error('Add holiday error:', error);
        res.status(500).json({ message: 'Failed to add holiday', error: error.message });
    }
};

// Update holiday
export const updateHoliday = async (req, res) => {
    try {
        const { year, holidayId } = req.params;
        const updates = req.body;

        const yearNum = parseInt(year);
        const calendar = await Calendar.findOne({ year: yearNum });

        if (!calendar) {
            return res.status(404).json({ message: 'Calendar not found' });
        }

        const holiday = calendar.holidays.id(holidayId);
        if (!holiday) {
            return res.status(404).json({ message: 'Holiday not found' });
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

        res.json({
            message: 'Holiday updated successfully',
            holiday
        });
    } catch (error) {
        console.error('Update holiday error:', error);
        res.status(500).json({ message: 'Failed to update holiday', error: error.message });
    }
};

// Delete holiday
export const deleteHoliday = async (req, res) => {
    try {
        const { year, holidayId } = req.params;
        console.log(`Attempting to delete holiday ${holidayId} for year ${year}`);

        const yearNum = parseInt(year);
        if (isNaN(yearNum)) {
            return res.status(400).json({ message: 'Invalid year parameter' });
        }

        const calendar = await Calendar.findOne({ year: yearNum });
        if (!calendar) {
            console.log(`Calendar not found for year ${yearNum}`);
            return res.status(404).json({ message: 'Calendar not found' });
        }

        console.log(`Found calendar with ${calendar.holidays.length} holidays`);

        const holiday = calendar.holidays.id(holidayId);
        if (!holiday) {
            console.log(`Holiday with ID ${holidayId} not found`);
            return res.status(404).json({ message: 'Holiday not found' });
        }

        console.log(`Found holiday: ${holiday.name} on ${holiday.date}`);

        // Use pull method to remove the holiday from the array
        calendar.holidays.pull(holidayId);
        await calendar.save();

        console.log(`Successfully deleted holiday ${holidayId}`);
        res.json({ message: 'Holiday deleted successfully' });
    } catch (error) {
        console.error('Delete holiday error:', error);
        console.error('Error details:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        res.status(500).json({ message: 'Failed to delete holiday', error: error.message });
    }
};

// Update working days
export const updateWorkingDays = async (req, res) => {
    try {
        const { year } = req.params;
        const { workingDays } = req.body;

        const yearNum = parseInt(year);
        let calendar = await Calendar.findOne({ year: yearNum });

        if (!calendar) {
            calendar = new Calendar({ year: yearNum });
        }

        calendar.workingDays = { ...calendar.workingDays, ...workingDays };
        await calendar.save();

        res.json({
            message: 'Working days updated successfully',
            workingDays: calendar.workingDays
        });
    } catch (error) {
        console.error('Update working days error:', error);
        res.status(500).json({ message: 'Failed to update working days', error: error.message });
    }
};

// Update working hours
export const updateWorkingHours = async (req, res) => {
    try {
        const { year } = req.params;
        const { workingHours } = req.body;

        const yearNum = parseInt(year);
        let calendar = await Calendar.findOne({ year: yearNum });

        if (!calendar) {
            calendar = new Calendar({ year: yearNum });
        }

        calendar.workingHours = { ...calendar.workingHours, ...workingHours };
        await calendar.save();

        res.json({
            message: 'Working hours updated successfully',
            workingHours: calendar.workingHours
        });
    } catch (error) {
        console.error('Update working hours error:', error);
        res.status(500).json({ message: 'Failed to update working hours', error: error.message });
    }
};

// Get holidays for a specific month
export const getHolidaysForMonth = async (req, res) => {
    try {
        const { year, month } = req.params;
        const yearNum = parseInt(year);
        const monthNum = parseInt(month) - 1; // JavaScript months are 0-indexed

        if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 0 || monthNum > 11) {
            return res.status(400).json({ message: 'Invalid year or month' });
        }

        const calendar = await Calendar.findOne({ year: yearNum });
        if (!calendar) {
            return res.json({ holidays: [] });
        }

        const holidays = calendar.holidays.filter(holiday => {
            const holidayDate = new Date(holiday.date);
            return holidayDate.getMonth() === monthNum && holiday.isActive;
        });

        res.json({ holidays });
    } catch (error) {
        console.error('Get holidays error:', error);
        res.status(500).json({ message: 'Failed to get holidays', error: error.message });
    }
};

// Check if a date is a working day
export const isWorkingDay = async (req, res) => {
    try {
        const { date } = req.params;
        const checkDate = new Date(date);

        if (isNaN(checkDate.getTime())) {
            return res.status(400).json({ message: 'Invalid date format' });
        }

        const year = checkDate.getFullYear();
        const calendar = await Calendar.findOne({ year });

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

        res.json({
            isWorkingDay,
            reason: isHoliday ? 'holiday' : (isWorkingDayBySchedule ? 'working_day' : 'weekend'),
            holiday: isHoliday ? calendar.holidays.find(h => 
                new Date(h.date).getTime() === checkDate.getTime() && h.isActive
            ) : null
        });
    } catch (error) {
        console.error('Check working day error:', error);
        res.status(500).json({ message: 'Failed to check working day', error: error.message });
    }
};
