import mongoose from "mongoose";

const successionPlanSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    positionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role',
        required: true
    },
    positionName: {
        type: String,
        required: true
    },
    department: String,
    currentIncumbent: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    riskLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        required: true
    },
    criticality: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        required: true
    },
    successors: [{
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        readinessLevel: {
            type: String,
            enum: ['Ready Now', 'Ready in 1-2 Years', 'Ready in 3-5 Years', 'Long-term Potential'],
            required: true
        },
        developmentPlan: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'LearningPath'
        },
        strengths: [String],
        gaps: [String],
        notes: String
    }],
    developmentActivities: [{
        activity: String,
        assignedTo: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        dueDate: Date,
        status: {
            type: String,
            enum: ['Not Started', 'In Progress', 'Completed'],
            default: 'Not Started'
        }
    }],
    lastReviewDate: Date,
    nextReviewDate: Date,
    status: {
        type: String,
        enum: ['Draft', 'Active', 'On Hold', 'Archived'],
        default: 'Draft'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

const talentPoolSchema = new mongoose.Schema({
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
    potentialLevel: {
        type: String,
        enum: ['High Potential', 'Medium Potential', 'Emerging Talent'],
        required: true
    },
    currentRole: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    },
    targetRoles: [{
        roleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Role'
        },
        readinessLevel: {
            type: String,
            enum: ['Ready Now', 'Ready in 1-2 Years', 'Ready in 3-5 Years', 'Long-term Potential']
        },
        timeline: String
    }],
    strengths: [String],
    developmentAreas: [String],
    careerAspirations: String,
    developmentPlan: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LearningPath'
    },
    performanceRating: Number,
    lastReviewDate: Date,
    nextReviewDate: Date,
    notes: String,
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

// Indexes
successionPlanSchema.index({ organizationId: 1, positionId: 1 });
successionPlanSchema.index({ organizationId: 1, riskLevel: 1 });
talentPoolSchema.index({ organizationId: 1, employeeId: 1 });
talentPoolSchema.index({ organizationId: 1, potentialLevel: 1 });

export const SuccessionPlan = mongoose.model('SuccessionPlan', successionPlanSchema);
export const TalentPool = mongoose.model('TalentPool', talentPoolSchema);

