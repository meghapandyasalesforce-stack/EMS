import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    month: {
        type: String,
        required: true
    },
    year: {
        type: Number,
        required: true
    },
    basicSalary: {
        type: Number,
        required: true
    },
    earnings: {
        basicWage: Number,
        houseRentAllowance: Number,
        transportAllowance: Number,
        medicalAllowance: Number,
        overtime: Number,
        gratuity: Number,
        specialAllowance: Number,
        performanceBonus: Number,
        projectBonus: Number,
        attendanceBonus: Number,
        pfEmployer: Number,
        esiEmployer: Number,
        totalEarnings: Number // This should sum all of the above
    },
    deductions: {
        pfEmployee: Number,
        esiEmployee: Number,
        professionalTax: Number,
        incomeTax: Number,
        advanceSalary: Number,
        loanDeduction: Number,
        otherDeductions: Number,
        total: Number // This should sum all deductions
    },
    ctc: {
        type: Number // Grand Total CTC = basic + allowances + employer contributions
    },
    inHandSalary: {
        type: Number // = totalEarnings - deductions.total
    },
    leaves: [{
        type: {
            type: String,
            enum: ['Sick', 'Casual', 'Vacation', 'Other'],
            required: true
        },
        reason: String,
        days: Number
    }],
    status: {
        type: String,
        enum: ['Pending', 'Processed', 'Paid', 'Cancelled'],
        default: 'Pending'
    },
    // Payroll record type:
    // - monthly: the base payroll for one employee per month (exactly one per month)
    // - off_cycle: additional adjustments (bonus, F&F, correction) that stack on top
    type: {
        type: String,
        enum: ['monthly', 'off_cycle'],
        default: 'monthly',
        index: true
    },
    // Off-cycle subtype (ignored for monthly records)
    subType: {
        type: String,
        enum: ['bonus', 'fnf', 'correction'],
        default: 'correction'
    },
    // How this record should be interpreted in final math:
    // - earning: positive addition
    // - deduction: positive reduction (stored as deductions amounts)
    // - full_override: UI hint (final net is still computed by earnings/deductions aggregation)
    adjustmentMode: {
        type: String,
        enum: ['earning', 'deduction', 'full_override'],
        default: 'earning'
    },
    // Amount actually paid for this record (supports partial payments)
    paidAmount: {
        type: Number,
        default: 0
    },
    paymentDate: Date,
    /** Bulk generator mode: provisional estimate vs closed monthly run */
    generationType: {
        type: String,
        enum: ['preview', 'final'],
        default: 'final'
    },
    isProvisional: {
        type: Boolean,
        default: false
    },
    computedAsOf: {
        type: Date
    },
    payrollLocked: {
        type: Boolean,
        default: false
    },
    isVisible: {
        type: Boolean,
        default: true
    },
    notes: {
        type: String,
        maxlength: 500
    },
    lastModifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    processedDate: Date,
    paidDate: Date,
    payment: {
        provider: { type: String },
        reference: { type: String },
        status: { type: String, enum: ['Success', 'Failed', 'Pending'] },
        processedAt: { type: Date },
        error: { type: String }
    }
}, {
    timestamps: true
});

// Add database indexes for better query performance
payrollSchema.index({ employeeId: 1, month: 1, year: 1 }); // Composite index for specific payroll queries

// Monthly records are generated/overwritten by code. We still index for speed,
// but we avoid a DB-level UNIQUE constraint here because existing data may
// already contain preview + final documents from older runs.
payrollSchema.index({ organizationId: 1, employeeId: 1, month: 1, year: 1, type: 1 });

// Off-cycle queries (many records per month)
payrollSchema.index({ organizationId: 1, employeeId: 1, month: 1, year: 1, type: 1, subType: 1 });
payrollSchema.index({ year: 1, month: 1 }); // For period-based queries
payrollSchema.index({ status: 1 }); // For filtering by status
payrollSchema.index({ employeeId: 1 }); // For employee payroll history
payrollSchema.index({ status: 1, isVisible: 1 }); // For filtering visible processed payrolls

const Payroll = mongoose.model("Payroll", payrollSchema, "payrolls");
export default Payroll;
