import mongoose from "mongoose";

/**
 * Work From Home request.
 * Independent from leave and regularization.
 * Submitting a request notifies manager/HR/admin by email, and a
 * manager/HR/admin can approve or reject it.
 * Punch-in gate (attendance date / half, status=approved only):
 * - approved → Home punch allowed, office punch blocked
 * - pending / rejected / none → Home punch blocked, office unchanged
 */
const wfhRequestSchema = new mongoose.Schema({
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
    wfhDate: {
        type: Date,
        required: [true, 'WFH start date is required']
    },
    wfhDateTo: {
        type: Date,
        default: null
    },
    wfhType: {
        type: String,
        enum: ['full_day', 'half_day'],
        default: 'full_day'
    },
    halfDayType: {
        type: String,
        enum: ['first_half', 'second_half'],
        required: function () {
            return this.wfhType === 'half_day';
        }
    },
    reason: {
        type: String,
        required: [true, 'Reason is required'],
        trim: true,
        maxlength: [500, 'Reason cannot exceed 500 characters']
    },
    remarks: {
        type: String,
        trim: true,
        maxlength: [500, 'Remarks cannot exceed 500 characters'],
        default: ''
    },
    status: {
        type: String,
        // 'submitted' kept for legacy records created before the approval flow;
        // it is treated the same as 'pending'.
        enum: ['pending', 'submitted', 'approved', 'rejected'],
        default: 'pending'
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null
    },
    reviewerName: {
        type: String,
        trim: true,
        default: ''
    },
    reviewNote: {
        type: String,
        trim: true,
        maxlength: [500, 'Review note cannot exceed 500 characters'],
        default: ''
    },
    reviewedAt: {
        type: Date,
        default: null
    },
    emailSent: {
        type: Boolean,
        default: false
    },
    // Root Message-ID so approval and rejection stay in the request thread
    emailThreadMessageId: {
        type: String,
        default: null
    }
}, {
    timestamps: true
});

wfhRequestSchema.index({ organizationId: 1, employeeId: 1, wfhDate: 1 });

const WfhRequest = mongoose.model('WfhRequest', wfhRequestSchema);

export default WfhRequest;
