import mongoose from 'mongoose';

/**
 * Reusable resume screening keyword templates for job postings.
 * Selecting a template copies values into Job.screeningCriteria (job-specific customization).
 */
const resumeScreeningTemplateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 120,
    },
    requiredKeywords: [{ type: String, trim: true }],
    optionalKeywords: [{ type: String, trim: true }],
    minimumMatchPercent: {
        type: Number,
        default: 70,
        min: 0,
        max: 100,
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true,
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
    },
}, { timestamps: true });

resumeScreeningTemplateSchema.index(
    { organizationId: 1, name: 1 },
    { unique: true, collation: { locale: 'en', strength: 2 } }
);

const ResumeScreeningTemplate = mongoose.model(
    'ResumeScreeningTemplate',
    resumeScreeningTemplateSchema
);

export default ResumeScreeningTemplate;
