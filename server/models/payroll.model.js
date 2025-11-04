import mongoose from "mongoose";

const payrollSchema = new mongoose.Schema({
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
        enum: ['Pending', 'Processed', 'Paid'],
        default: 'Pending'
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
payrollSchema.index({ year: 1, month: 1 }); // For period-based queries
payrollSchema.index({ status: 1 }); // For filtering by status
payrollSchema.index({ employeeId: 1 }); // For employee payroll history
payrollSchema.index({ status: 1, isVisible: 1 }); // For filtering visible processed payrolls

const Payroll = mongoose.model("Payroll", payrollSchema, "payrolls");
export default Payroll;
