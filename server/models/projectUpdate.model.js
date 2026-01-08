import mongoose from "mongoose";

const projectUpdateSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    projectId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: true,
        index: true
    },
    // Project leader who posted the update
    postedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    // Update content
    update: {
        type: String,
        required: true,
        trim: true,
        maxlength: 5000
    },
    // Update date (for daily updates, this is the date the update refers to)
    updateDate: {
        type: Date,
        required: true,
        default: Date.now
    },
    // Status at the time of update (optional, can be different from project status)
    status: {
        type: String,
        enum: ['pending', 'in-progress', 'completed', 'on-hold'],
        default: 'in-progress'
    },
    // Progress percentage (0-100)
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    // Blockers or challenges
    blockers: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    // Next steps
    nextSteps: {
        type: String,
        trim: true,
        maxlength: 1000
    }
}, { timestamps: true });

// Index for efficient queries
projectUpdateSchema.index({ projectId: 1, updateDate: -1 });
projectUpdateSchema.index({ organizationId: 1, projectId: 1 });

const ProjectUpdate = mongoose.model("ProjectUpdate", projectUpdateSchema, "projectUpdates");

export default ProjectUpdate;

