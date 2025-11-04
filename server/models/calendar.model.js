import mongoose from "mongoose";

const calendarSchema = new mongoose.Schema({
    year: {
        type: Number,
        required: true,
        min: 2020,
        max: 2050
    },
    holidays: [{
        name: {
            type: String,
            required: true,
            trim: true
        },
        date: {
            type: Date,
            required: true
        },
        type: {
            type: String,
            enum: ['national', 'religious', 'company', 'regional'],
            default: 'national'
        },
        description: {
            type: String,
            trim: true
        },
        isRecurring: {
            type: Boolean,
            default: false
        },
        recurringPattern: {
            type: String,
            enum: ['yearly', 'monthly', 'weekly'],
            default: 'yearly'
        },
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    workingDays: {
        monday: { type: Boolean, default: true },
        tuesday: { type: Boolean, default: true },
        wednesday: { type: Boolean, default: true },
        thursday: { type: Boolean, default: true },
        friday: { type: Boolean, default: true },
        saturday: { type: Boolean, default: false },
        sunday: { type: Boolean, default: false }
    },
    workingHours: {
        startTime: {
            type: String,
            default: "09:00",
            match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        },
        endTime: {
            type: String,
            default: "17:00",
            match: /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/
        },
        breakDuration: {
            type: Number,
            default: 60, // in minutes
            min: 0,
            max: 180
        }
    },
    companySettings: {
        timezone: {
            type: String,
            default: "UTC",
            trim: true
        },
        dateFormat: {
            type: String,
            default: "DD/MM/YYYY",
            trim: true
        },
        weekStartsOn: {
            type: String,
            enum: ['monday', 'sunday'],
            default: 'monday'
        }
    }
}, {
    timestamps: true
});

// Index for efficient queries
calendarSchema.index({ year: 1 });
calendarSchema.index({ 'holidays.date': 1 });

// Virtual for getting total working days in a month
calendarSchema.virtual('totalWorkingDaysInMonth').get(function() {
    const currentDate = new Date();
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    let workingDays = 0;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    
    for (let day = 1; day <= daysInMonth; day++) {
        const date = new Date(year, month, day);
        const dayOfWeek = date.getDay();
        const dayName = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][dayOfWeek];
        
        if (this.workingDays[dayName]) {
            // Check if it's not a holiday
            const isHoliday = this.holidays.some(holiday => {
                const holidayDate = new Date(holiday.date);
                return holidayDate.getDate() === day && 
                       holidayDate.getMonth() === month && 
                       holidayDate.getFullYear() === year &&
                       holiday.isActive;
            });
            
            if (!isHoliday) {
                workingDays++;
            }
        }
    }
    
    return workingDays;
});

const Calendar = mongoose.model("Calendar", calendarSchema, "calendars");
export default Calendar;
