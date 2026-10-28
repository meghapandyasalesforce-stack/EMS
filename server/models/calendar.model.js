import mongoose from "mongoose";

const calendarSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
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
        theme: {
            type: String,
            enum: ['saffron', 'green', 'blue', 'red', 'orange', 'yellow', 'purple', 'pink', 'gold', 'silver', 'default'],
            default: 'default'
        },
        icon: {
            type: String,
            trim: true
        },
        color: {
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
        },
        /**
         * HR can convert a holiday into a working day without deleting it:
         * - null: normal holiday (blocks work)
         * - office: work from office that day
         * - home: work from home that day (also enables WFH on calendar)
         */
        workModeOverride: {
            type: String,
            enum: [null, 'office', 'home'],
            default: null
        },
        /** Optional half-day holiday (attendance treats other half as working). */
        isHalfDay: {
            type: Boolean,
            default: false
        },
        halfDayType: {
            type: String,
            enum: ['first_half', 'second_half'],
            default: undefined
        },
        source: {
            type: String,
            enum: ['manual', 'upload', 'import'],
            default: 'manual'
        },
        sourceFileName: {
            type: String,
            trim: true
        },
        uploadedAt: {
            type: Date
        }
    }],
    /**
     * HR-enabled Work From Home dates for this calendar year.
     * Presence = WFH is enabled for that date.
     * employeeAccess:
     *   - all_except (default): everyone may apply except excludedEmployeeIds
     *   - only_these: only excludedEmployeeIds may apply (allowlist; same field, inverted meaning)
     * Punch rules are separate: office punch is blocked only when the employee has approved WFH.
     */
    wfhDates: [{
        date: {
            type: Date,
            required: true
        },
        employeeAccess: {
            type: String,
            enum: ['all_except', 'only_these'],
            default: 'all_except'
        },
        excludedEmployeeIds: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        }],
        note: {
            type: String,
            trim: true,
            maxlength: 500,
            default: ''
        },
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
        },
        updatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            default: null
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
calendarSchema.index({ organizationId: 1, year: 1, 'wfhDates.date': 1 });

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
            const isHoliday = this.holidays.some((holiday) => {
                if (!holiday?.isActive) return false;
                if (holiday.workModeOverride === 'office' || holiday.workModeOverride === 'home') return false;
                const holidayDate = new Date(holiday.date);
                return holidayDate.getDate() === day &&
                       holidayDate.getMonth() === month &&
                       holidayDate.getFullYear() === year;
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
