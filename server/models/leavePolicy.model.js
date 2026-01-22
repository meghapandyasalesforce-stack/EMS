import mongoose from 'mongoose';

const leavePolicySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    policyName: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    isActive: {
        type: Boolean,
        default: true
    },
    effectiveDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    expiryDate: Date,
    
    // Leave types configuration (Fixed Split Policy)
    leaveTypes: [{
        type: {
            type: String,
            enum: ['casual', 'paid', 'sick', 'maternity', 'paternity', 'vacation', 'privileged', 'compensatory', 'sabbatical', 'loss_of_pay'],
            required: true
        },
        displayName: {
            type: String,
            required: true
        },
        // Accrual configuration
        accrual: {
            method: {
                type: String,
                enum: ['fixed', 'proportional', 'monthly', 'yearly', 'on_anniversary'],
                default: 'fixed'
            },
            // For fixed: total days per year
            // For proportional: days per month of service
            // For monthly: days accrued per month
            // For yearly: days accrued at start of year
            amount: {
                type: Number,
                required: true,
                min: 0
            },
            // For proportional: based on months of service
            maxAccrual: Number,
            // Accrual frequency: 'daily', 'monthly', 'yearly', 'on_anniversary'
            frequency: {
                type: String,
                enum: ['daily', 'monthly', 'yearly', 'on_anniversary'],
                default: 'yearly'
            },
            // For monthly accrual: day of month (1-31)
            accrualDay: Number,
            // For anniversary accrual: based on joining date
            anniversaryBased: {
                type: Boolean,
                default: false
            }
        },
        // Carry-forward rules
        carryForward: {
            enabled: {
                type: Boolean,
                default: false
            },
            maxDays: {
                type: Number,
                default: 0,
                min: 0
            },
            // Expiry after carry-forward (in days)
            expiryDays: Number,
            // Whether unused balance expires
            expiresIfNotUsed: {
                type: Boolean,
                default: false
            }
        },
        // Usage rules
        minDaysPerRequest: {
            type: Number,
            default: 0.5,
            min: 0.5
        },
        maxDaysPerRequest: {
            type: Number,
            min: 0.5
        },
        maxConsecutiveDays: Number,
        // Whether this leave type requires approval
        requiresApproval: {
            type: Boolean,
            default: true
        },
        // Whether this leave type requires document
        requiresDocument: {
            type: Boolean,
            default: false
        },
        // Whether this leave type is paid
        isPaid: {
            type: Boolean,
            default: true
        },
        // Encashment rules
        encashment: {
            enabled: {
                type: Boolean,
                default: false
            },
            maxDaysPerYear: Number,
            calculationMethod: {
                type: String,
                enum: ['daily_salary', 'monthly_salary_divided_by_30', 'custom'],
                default: 'daily_salary'
            }
        },
        // Probation period restrictions
        probationRestrictions: {
            enabled: {
                type: Boolean,
                default: false
            },
            minServiceDays: Number, // Minimum days of service before eligible
            maxDaysDuringProbation: Number
        },
        // Notice period restrictions
        noticePeriodRestrictions: {
            enabled: {
                type: Boolean,
                default: false
            },
            minNoticeDays: Number // Minimum notice required before leave start date
        }
    }],
    
    // Blackout dates - dates when leave cannot be applied
    blackoutDates: [{
        startDate: {
            type: Date,
            required: true
        },
        endDate: {
            type: Date,
            required: true
        },
        reason: {
            type: String,
            trim: true
        },
        applicableLeaveTypes: [{
            type: String,
            enum: ['casual', 'paid', 'sick', 'maternity', 'paternity', 'vacation', 'privileged', 'compensatory', 'sabbatical', 'loss_of_pay', 'all']
        }],
        isActive: {
            type: Boolean,
            default: true
        }
    }],
    
    // Weekend and holiday handling rules
    dateHandlingRules: {
        // Whether weekends are counted in leave duration
        countWeekends: {
            type: Boolean,
            default: false
        },
        // Whether holidays are counted in leave duration
        countHolidays: {
            type: Boolean,
            default: false
        },
        // Whether to auto-adjust leave dates to exclude weekends/holidays
        autoAdjustDates: {
            type: Boolean,
            default: false
        }
    },
    
    // Applicability rules
    applicableTo: {
        type: String,
        enum: ['all', 'department', 'role', 'employee', 'custom'],
        default: 'all'
    },
    applicableDepartments: [String],
    applicableRoles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }],
    applicableEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    
    // Policy metadata
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, { timestamps: true });

// Indexes for performance
leavePolicySchema.index({ organizationId: 1, isActive: 1 });
leavePolicySchema.index({ organizationId: 1, effectiveDate: 1, expiryDate: 1 });

const LeavePolicy = mongoose.model('LeavePolicy', leavePolicySchema);
export default LeavePolicy;

