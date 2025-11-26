import mongoose from "mongoose";

const goalSchema = new mongoose.Schema({
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
    title: {
        type: String,
        required: true,
        maxlength: 200
    },
    description: {
        type: String,
        maxlength: 2000
    },
    goalType: {
        type: String,
        enum: ['OKR', 'KPI', 'Personal', 'Team', 'Company'],
        default: 'KPI'
    },
    // OKR Structure
    objective: {
        type: String,
        maxlength: 500
    },
    keyResults: [{
        description: {
            type: String,
            required: true,
            maxlength: 500
        },
        target: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        current: {
            type: mongoose.Schema.Types.Mixed,
            default: 0
        },
        unit: {
            type: String,
            enum: ['Number', 'Percentage', 'Currency', 'Text', 'Boolean']
        },
        status: {
            type: String,
            enum: ['Not Started', 'In Progress', 'Completed', 'At Risk', 'On Hold'],
            default: 'Not Started'
        }
    }],
    // Goal details
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed', 'Cancelled', 'On Hold'],
        default: 'Not Started'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    // Alignment
    parentGoalId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Goal'
    },
    alignedWith: [{
        goalId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Goal'
        },
        type: {
            type: String,
            enum: ['Company', 'Team', 'Individual']
        }
    }],
    // Tracking
    milestones: [{
        title: {
            type: String,
            required: true,
            maxlength: 200
        },
        targetDate: Date,
        completedDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'Completed', 'Overdue'],
            default: 'Pending'
        }
    }],
    // Review
    reviews: [{
        reviewDate: {
            type: Date,
            required: true
        },
        reviewedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        comments: {
            type: String,
            maxlength: 1000
        },
        progress: {
            type: Number,
            min: 0,
            max: 100
        }
    }],
    // Tags and categories
    tags: [String],
    category: {
        type: String
    },
    // Visibility
    isPrivate: {
        type: Boolean,
        default: false
    },
    sharedWith: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }]
}, {
    timestamps: true
});

// Indexes
goalSchema.index({ employeeId: 1, endDate: -1 });
goalSchema.index({ status: 1 });
goalSchema.index({ organizationId: 1, goalType: 1 });
goalSchema.index({ parentGoalId: 1 });

const Goal = mongoose.model("Goal", goalSchema, "goals");
export default Goal;

