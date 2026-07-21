import mongoose from 'mongoose';

const balanceSnapshotSchema = new mongoose.Schema(
    {
        accrued: { type: Number, default: 0 },
        used: { type: Number, default: 0 },
        carriedForward: { type: Number, default: 0 },
        available: { type: Number, default: 0 },
    },
    { _id: false }
);

const leaveBalanceAuditSchema = new mongoose.Schema(
    {
        organizationId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Organization',
            required: true,
            index: true,
        },
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            index: true,
        },
        action: {
            type: String,
            enum: [
                'period_update',
                'carry_forward',
                'monthly_auto',
                'manual_adjust',
                'manual_carry_forward',
                'manual_carry_forward_reduce',
            ],
            required: true,
            index: true,
        },
        leaveType: { type: String },
        fromYear: Number,
        fromMonth: Number,
        toYear: Number,
        toMonth: Number,
        carryForwardFromYear: Number,
        carryForwardToYear: Number,
        previousBalance: balanceSnapshotSchema,
        newBalance: balanceSnapshotSchema,
        performedBy: {
            type: mongoose.Schema.Types.ObjectId,
            refPath: 'performedByModel',
        },
        performedByModel: {
            type: String,
            enum: ['Employee', 'User'],
            default: 'Employee',
        },
        performedAt: {
            type: Date,
            default: Date.now,
            index: true,
        },
        notes: String,
        remarks: String,
        employeeName: String,
        duplicatePrevented: { type: Boolean, default: false },
    },
    { timestamps: true }
);

leaveBalanceAuditSchema.index({ organizationId: 1, employee: 1, action: 1, fromYear: 1, fromMonth: 1 });
leaveBalanceAuditSchema.index({ organizationId: 1, employee: 1, action: 1, carryForwardFromYear: 1 });

const LeaveBalanceAudit = mongoose.model('LeaveBalanceAudit', leaveBalanceAuditSchema);
export default LeaveBalanceAudit;
