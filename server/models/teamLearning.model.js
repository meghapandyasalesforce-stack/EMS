import mongoose from "mongoose";

const teamLearningSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: String,
        enum: ['Technical', 'Soft Skills', 'Leadership', 'Compliance', 
               'Product Knowledge', 'Safety', 'Customer Service', 'Sales', 
               'MERN', 'Frontend', 'Backend', 'Full Stack', 'Other'],
        default: 'Other'
    },
    resourceType: {
        type: String,
        enum: ['Document', 'YouTube Link', 'Article', 'Course', 'Video', 'PDF', 'Other'],
        required: true
    },
    resources: [{
        type: {
            type: String,
            enum: ['Document', 'YouTube Link', 'Article', 'Course', 'Video', 'PDF', 'Other'],
            required: true
        },
        title: String,
        url: String, // For YouTube links, articles, etc.
        file: {
            url: String,
            filename: String,
            uploadedAt: { type: Date, default: Date.now }
        },
        description: String,
        order: { type: Number, default: 0 }
    }],
    assignedTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }], // If empty, assigned to all team members
    tags: [String],
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    dueDate: Date,
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft'
    },
    completionTracking: {
        enabled: {
            type: Boolean,
            default: false
        },
        requiredCompletion: {
            type: Boolean,
            default: false
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: true
});

// Indexes
teamLearningSchema.index({ organizationId: 1, managerId: 1, status: 1 });
teamLearningSchema.index({ organizationId: 1, assignedTo: 1 });
teamLearningSchema.index({ organizationId: 1, category: 1 });

// Learning Progress Tracking
const learningProgressSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    learningId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'TeamLearning',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    status: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Completed'],
        default: 'Not Started'
    },
    progress: {
        type: Number,
        min: 0,
        max: 100,
        default: 0
    },
    completedResources: [{
        resourceId: mongoose.Schema.Types.ObjectId,
        completedAt: Date
    }],
    startedAt: Date,
    completedAt: Date,
    notes: String
}, {
    timestamps: true
});

// Indexes
learningProgressSchema.index({ organizationId: 1, employeeId: 1, learningId: 1 }, { unique: true });
learningProgressSchema.index({ organizationId: 1, learningId: 1, status: 1 });

export const TeamLearning = mongoose.model('TeamLearning', teamLearningSchema);
export const LearningProgress = mongoose.model('LearningProgress', learningProgressSchema);

