import mongoose from "mongoose";

const workforcePlanSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    planName: {
        type: String,
        required: true
    },
    planYear: {
        type: Number,
        required: true
    },
    quarter: {
        type: Number,
        min: 1,
        max: 4
    },
    department: String,
    /** Role-level planning: designation / job title */
    jobTitle: String,
    designation: String,
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    reason: String,
    status: {
        type: String,
        enum: ['Draft', 'Approved', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Draft'
    },
    currentHeadcount: {
        type: Number,
        required: true
    },
    targetHeadcount: {
        type: Number,
        required: true
    },
    budget: {
        allocated: Number,
        spent: Number,
        remaining: Number
    },
    hiringPlan: [{
        position: String,
        department: String,
        jobTitle: String,
        numberOfPositions: Number,
        filledPositions: {
            type: Number,
            default: 0,
            min: 0
        },
        priority: {
            type: String,
            enum: ['Low', 'Medium', 'High', 'Critical']
        },
        expectedStartDate: Date,
        budget: Number,
        reason: String,
        recruitmentJobId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Recruitment',
            default: null
        },
        status: {
            type: String,
            enum: ['Planned', 'In Progress', 'Filled', 'Cancelled'],
            default: 'Planned'
        }
    }],
    skillsRequired: [{
        skill: String,
        currentCount: Number,
        requiredCount: Number,
        gap: Number
    }],
    risks: [{
        risk: String,
        impact: {
            type: String,
            enum: ['Low', 'Medium', 'High']
        },
        mitigation: String
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedAt: Date
}, {
    timestamps: true
});

const headcountForecastSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    forecastDate: {
        type: Date,
        required: true
    },
    department: String,
    currentHeadcount: Number,
    projectedHeadcount: Number,
    newHires: Number,
    terminations: Number,
    transfers: Number,
    promotions: Number,
    factors: [{
        factor: String,
        impact: Number,
        description: String
    }],
    confidenceLevel: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

// Indexes
workforcePlanSchema.index({ organizationId: 1, planYear: 1, department: 1 });
workforcePlanSchema.index({ organizationId: 1, status: 1 });
workforcePlanSchema.index({ organizationId: 1, department: 1, jobTitle: 1 });
headcountForecastSchema.index({ organizationId: 1, forecastDate: 1 });
headcountForecastSchema.index({ organizationId: 1, department: 1 });

export const WorkforcePlan = mongoose.model('WorkforcePlan', workforcePlanSchema);
export const HeadcountForecast = mongoose.model('HeadcountForecast', headcountForecastSchema);

