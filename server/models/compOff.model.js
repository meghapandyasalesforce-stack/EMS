import mongoose from 'mongoose';

const compOffSchema = new mongoose.Schema({
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
        required: true,
        index: true
    },
    employeeName: {
        type: String,
        required: true
    },
    // Date for which comp-off is earned
    date: {
        type: Date,
        required: true,
        index: true
    },
    // Date when comp-off was earned (attendance date)
    earnedDate: {
        type: Date,
        required: true
    },
    /** Calendar day yyyy-MM-dd for the work being claimed. */
    workDateKey: {
        type: String,
        trim: true,
        index: true
    },
    /** hours bank toward leave, or a direct half/full day claim. */
    requestUnit: {
        type: String,
        enum: ['hours', 'half_day', 'full_day'],
        default: 'hours'
    },
    startTime: {
        type: String,
        trim: true
    },
    endTime: {
        type: String,
        trim: true
    },
    requestedHours: {
        type: Number,
        default: 0,
        min: 0
    },
    /** Hours already converted into compensatory leave. */
    consumedHours: {
        type: Number,
        default: 0,
        min: 0
    },
    /** Leave days granted from this request (0.5 or 1, or a share of converted hours). */
    creditDays: {
        type: Number,
        default: 0,
        min: 0
    },
    leaveCredited: {
        type: Boolean,
        default: false
    },
    // Reason for earning comp-off
    reason: {
        type: String,
        required: true,
        trim: true
    },
    // Status: pending, approved, rejected, expired, used
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected', 'expired', 'used'],
        default: 'pending',
        index: true
    },
    // Approval workflow
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
    rejectionReason: {
        type: String
    },
    // Expiry tracking
    isExpired: {
        type: Boolean,
        default: false,
        index: true
    },
    expiredAt: {
        type: Date
    },
    // Usage tracking
    isUsed: {
        type: Boolean,
        default: false
    },
    usedAt: {
        type: Date
    },
    // Link to leave if comp-off was used
    usedInLeave: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Leave'
    },
    // Validity period (in days) - from attendance rule
    validityDays: {
        type: Number,
        default: 90
    },
    // Expiry date (calculated)
    expiryDate: {
        type: Date
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
    }],
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Expiry is validity days from the moment the request is created.
compOffSchema.pre('save', function (next) {
    if (this.isNew && !this.expiryDate) {
        const expiryDate = new Date();
        expiryDate.setDate(expiryDate.getDate() + (Number(this.validityDays) || 90));
        this.expiryDate = expiryDate;
    }
    next();
});

// Indexes for performance
compOffSchema.index({ organizationId: 1, employeeId: 1, date: 1 });
compOffSchema.index({ organizationId: 1, status: 1, isExpired: 1 });
compOffSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
compOffSchema.index({ expiryDate: 1, isExpired: 1 }); // For expiry job queries

const CompOff = mongoose.model('CompOff', compOffSchema);
export default CompOff;

