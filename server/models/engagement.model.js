import mongoose from "mongoose";

const surveySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    type: {
        type: String,
        enum: ['Pulse', 'Annual', 'Exit', 'Onboarding', 'Custom'],
        required: true
    },
    questions: [{
        question: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['Multiple Choice', 'Rating', 'Text', 'Yes/No', 'Scale'],
            required: true
        },
        options: [String],
        required: {
            type: Boolean,
            default: false
        },
        order: Number
    }],
    targetAudience: {
        type: String,
        enum: ['All Employees', 'Department', 'Role', 'Specific Employees'],
        default: 'All Employees'
    },
    targetDepartments: [String],
    targetRoles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }],
    targetEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date,
        required: true
    },
    anonymous: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Closed', 'Archived'],
        default: 'Draft'
    },
    responseCount: {
        type: Number,
        default: 0
    },
    totalInvites: {
        type: Number,
        default: 0
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

const surveyResponseSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    surveyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Survey',
        required: true,
        index: true
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        index: true
    },
    responses: [{
        questionId: mongoose.Schema.Types.ObjectId,
        answer: mongoose.Schema.Types.Mixed,
        questionText: String
    }],
    submittedAt: {
        type: Date,
        default: Date.now
    },
    timeSpent: Number, // in seconds
    isAnonymous: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const feedbackSchema = new mongoose.Schema({
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
    type: {
        type: String,
        enum: ['Suggestion', 'Complaint', 'Appreciation', 'Question', 'Other'],
        required: true
    },
    category: {
        type: String,
        enum: ['Work Environment', 'Management', 'Benefits', 'Process', 
               'Technology', 'Training', 'Culture', 'Other']
    },
    subject: {
        type: String,
        required: true
    },
    message: {
        type: String,
        required: true
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    status: {
        type: String,
        enum: ['Open', 'In Review', 'Resolved', 'Closed'],
        default: 'Open'
    },
    anonymous: {
        type: Boolean,
        default: false
    },
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    responses: [{
        respondedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        response: String,
        respondedAt: {
            type: Date,
            default: Date.now
        }
    }],
    resolvedAt: Date,
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }
}, {
    timestamps: true
});

const recognitionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true
    },
    givenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    type: {
        type: String,
        enum: ['Achievement', 'Excellence', 'Teamwork', 'Innovation', 
               'Leadership', 'Customer Service', 'Going Above and Beyond', 'Other'],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    points: {
        type: Number,
        default: 0
    },
    badge: String,
    status: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected'],
        default: 'Pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedAt: Date,
    isPublic: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

// Indexes
surveySchema.index({ organizationId: 1, status: 1 });
surveySchema.index({ organizationId: 1, startDate: 1, endDate: 1 });
surveyResponseSchema.index({ organizationId: 1, surveyId: 1, employeeId: 1 });
feedbackSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
recognitionSchema.index({ organizationId: 1, recipientId: 1 });
recognitionSchema.index({ organizationId: 1, status: 1 });

export const Survey = mongoose.model('Survey', surveySchema);
export const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);
export const Feedback = mongoose.model('Feedback', feedbackSchema);
export const Recognition = mongoose.model('Recognition', recognitionSchema);

