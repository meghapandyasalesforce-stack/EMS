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
        /**
         * Remaining manual/imported days for this type (Balance Adjustment Add).
         * Leave consumption uses policy/accrued portion first, then this stock.
         * Employee month take limit tracks available (includes this stock + unused accrual).
         */
        manualStock: {
            type: Number,
            default: 0,
            min: 0
        },
        /**
         * Days removed from current policy/available bucket by Balance Adjustment Reduce
         * (after policy portion is consumed). Does not change annual entitlement config;
         * subtracted from computed available so future month accruals still apply on top.
         */
        manualDebit: {
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
            manualStock: Number,
            manualDebit: Number,
            /** When excess reduce uses future_months mode */
            excessMode: { type: String, enum: ['lop', 'future_months'], default: undefined },
            effectiveAnnual: Number,
            futureMonthlyRate: Number,
            /** How many months after rateAnchorMonth still receive futureMonthlyRate; later months get 0 */
            fundedFutureMonths: Number,
            rateAnchorYear: Number,
            rateAnchorMonth: Number,
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
        /** Current balance snap from Manual Correction — latest save is the accrual starting point */
        openingLeaveBalance: {
            active: { type: Boolean, default: false },
            balance: Number,
            openingYear: Number,
            openingMonth: Number,
            reason: String,
            setBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
            setAt: Date,
        },
        /** Running correction anchor — adjusts balance from a month forward without replacing opening */
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
        /** HR-added manual carry forward entries with effective dates */
        manualCarryForwards: [{
            amount: Number,
            effectiveYear: Number,
            effectiveMonth: Number,
            reason: String,
            addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
            addedAt: Date,
        }],
        /** HR reductions to leave balance (positive amount = days to subtract) */
        manualCarryForwardReductions: [{
            amount: Number,
            effectiveYear: Number,
            effectiveMonth: Number,
            reason: String,
            addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
            addedAt: Date,
        }],
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

