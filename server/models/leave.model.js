import mongoose from 'mongoose';

const leaveSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    employee: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    employeeName: {
        type: String,
        required: true
    },
    leaveType: {
        type: String,
        required: true,
        enum: ['sick', 'annual', 'casual', 'loss_of_pay', 'maternity', 'paternity', 'vacation', 'privileged', 'compensatory', 'sabbatical']
    },
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    duration: {
        type: Number,
        required: true
    },
    resumptionDate: {
        type: Date,
        required: true
    },
    reason: {
        type: String,
        required: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'cancelled'],
        default: 'pending'
    },
    rejectionReason: {
        type: String
    },
    document: {
        type: String // Store document file path
    },
    year: {
        type: Number,
        required: true
    },
    // Approval workflow
    approvalInstanceId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'ApprovalInstance'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedAt: {
        type: Date
    },
    rejectedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    rejectedAt: {
        type: Date
    },
    // Leave encashment
    isEncashed: {
        type: Boolean,
        default: false
    },
    encashmentAmount: {
        type: Number,
        default: 0
    },
    // Working days calculation (excluding weekends and holidays)
    workingDays: {
        type: Number,
        default: 0
    },
    // Half day support
    isHalfDay: {
        type: Boolean,
        default: false
    },
    halfDayType: {
        type: String,
        enum: ['first_half', 'second_half'],
        default: null
    },
    // Comments/notes
    comments: [{
        comment: String,
        commentedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        commentedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, { timestamps: true });

// Update the updatedAt timestamp before saving
leaveSchema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
});

const Leave = mongoose.model('Leave', leaveSchema);
export default Leave;

