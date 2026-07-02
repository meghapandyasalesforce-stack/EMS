import mongoose from 'mongoose';

const leaveBalanceSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    policy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LeavePolicy',
        required: true
    },
    year: {
        type: Number,
        required: true,
        index: true
    },
    
    // Balance breakdown by leave type
    balances: [{
        leaveType: {
            type: String,
            enum: ['casual', 'paid', 'sick', 'loss_of_pay', 'maternity', 'paternity', 'vacation', 'privileged', 'compensatory', 'sabbatical'],
            required: true
        },
        // Accrued balance
        accrued: {
            type: Number,
            default: 0,
            min: 0
        },
        // Used balance
        used: {
            type: Number,
            default: 0,
            min: 0
        },
        // Available balance (accrued - used)
        available: {
            type: Number,
            default: 0,
            min: 0
        },
        // Carried forward from previous year
        carriedForward: {
            type: Number,
            default: 0,
            min: 0
        },
        // Expired balance (if applicable)
        expired: {
            type: Number,
            default: 0,
            min: 0
        },
        // Pending balance (in pending leave requests)
        pending: {
            type: Number,
            default: 0,
            min: 0
        },
        /** Manual correction by admin / HR / line manager — preserved across recalculation */
        manualOverride: {
            active: { type: Boolean, default: false },
            accrued: Number,
            used: Number,
            carriedForward: Number,
            reason: String,
            adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
            adjustedAt: Date
        }
    }],
    
    // Accrual tracking
    lastAccrualDate: Date,
    accrualHistory: [{
        date: Date,
        leaveType: String,
        amount: Number,
        method: String, // 'initial', 'monthly', 'anniversary', 'manual'
        notes: String
    }],
    
    // Carry-forward tracking
    carryForwardHistory: [{
        fromYear: Number,
        toYear: Number,
        leaveType: String,
        amount: Number,
        date: Date,
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        previousAvailable: Number,
    }],

    /** Prevents duplicate carry-forward for the same year transition */
    carryForwardProcessed: [{
        fromYear: Number,
        toYear: Number,
        processedAt: Date,
        processedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    }],

    /** Last automated period recalculation marker */
    lastAutomatedUpdate: {
        fromYear: Number,
        fromMonth: Number,
        toYear: Number,
        toMonth: Number,
        updatedAt: Date,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    },
    
    /** Monthly allocation log — prevents duplicate monthly credits */
    monthlyAllocationLog: [{
        year: Number,
        month: Number,
        leaveType: String,
        amount: Number,
        allocatedAt: { type: Date, default: Date.now },
    }],

    /** Employee-level leave wallet (shared pool) — not tied to any leave type */
    employeeLeaveSummary: {
        manualOverride: {
            active: { type: Boolean, default: false },
            available: Number,
            accrued: Number,
            used: Number,
            carriedForward: Number,
            /** Month/year this manual balance anchors rolling accrual from */
            anchorYear: Number,
            anchorMonth: Number,
            reason: String,
            adjustedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
            adjustedAt: Date,
        },
    },

    // Metadata
    isLocked: {
        type: Boolean,
        default: false
    },
    lockedReason: String
}, { timestamps: true });

// Compound index for efficient queries
leaveBalanceSchema.index({ organizationId: 1, employee: 1, year: 1 }, { unique: true });
leaveBalanceSchema.index({ organizationId: 1, employee: 1, policy: 1 });

const LeaveBalance = mongoose.model('LeaveBalance', leaveBalanceSchema);
export default LeaveBalance;

