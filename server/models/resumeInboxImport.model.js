import mongoose from 'mongoose';

/**
 * Tracks each attempt to import a resume from the recruitment mailbox.
 * Additive — does not replace Candidate; links to Candidate when successful.
 */
const resumeInboxImportSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    messageId: {
        type: String,
        required: true,
        trim: true,
    },
    uid: String,
    fromAddress: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
    },
    fromName: String,
    subject: { type: String, default: '' },
    bodyPreview: { type: String, default: '' },
    receivedAt: { type: Date, default: Date.now },
    status: {
        type: String,
        enum: ['pending', 'imported', 'duplicate', 'failed', 'skipped'],
        default: 'pending',
        index: true,
    },
    failureReason: String,
    isUnread: { type: Boolean, default: true },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        default: null,
    },
    jobPostingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recruitment',
        default: null,
    },
    wasDuplicate: { type: Boolean, default: false },
    resume: {
        url: String,
        fileName: String,
        mimeType: String,
        size: Number,
    },
    extracted: {
        firstName: String,
        lastName: String,
        email: String,
        phone: String,
    },
    rawMeta: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
}, { timestamps: true });

resumeInboxImportSchema.index({ organizationId: 1, messageId: 1 }, { unique: true });
resumeInboxImportSchema.index({ organizationId: 1, status: 1, createdAt: -1 });
resumeInboxImportSchema.index({ organizationId: 1, isUnread: 1 });

const ResumeInboxImport = mongoose.model('ResumeInboxImport', resumeInboxImportSchema);
export default ResumeInboxImport;
