import mongoose from "mongoose";

/**
 * Work From Home request.
 * Independent from attendance punches, leave, and regularization.
 * Submitting a request notifies manager/HR/admin by email, and a
 * manager/HR/admin can approve or reject it. It does NOT gate WFH punch-ins.
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
        required: [true, 'WFH date is required']
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
    }
}, {
    timestamps: true
});

wfhRequestSchema.index({ organizationId: 1, employeeId: 1, wfhDate: 1 });

const WfhRequest = mongoose.model('WfhRequest', wfhRequestSchema);

export default WfhRequest;
