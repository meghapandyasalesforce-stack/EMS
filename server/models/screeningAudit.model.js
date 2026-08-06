import mongoose from 'mongoose';

const screeningAuditSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        default: null,
        index: true,
    },
    jobPostingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recruitment',
        default: null,
    },
    event: {
        type: String,
        enum: [
            'screening_started',
            'screening_completed',
            'candidate_approved',
            'candidate_rejected',
            'auto_deleted',
            'manual_deleted',
        ],
        required: true,
        index: true,
    },
    meta: { type: mongoose.Schema.Types.Mixed, default: {} },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', default: null },
}, { timestamps: true });

screeningAuditSchema.index({ organizationId: 1, createdAt: -1 });

const ScreeningAudit = mongoose.model('ScreeningAudit', screeningAuditSchema);
export default ScreeningAudit;
