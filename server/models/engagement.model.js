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
        enum: ['Pulse', 'Annual', 'Exit', 'Onboarding', 'Custom', 'Wellbeing'],
        required: true
    },
    questions: [{
        question: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['Multiple Choice', 'Rating', 'Text', 'Yes/No', 'Scale', 'eNPS'],
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
    /** Pulse / survey reminder settings */
    reminderEnabled: {
        type: Boolean,
        default: true
    },
    reminderDaysBefore: {
        type: Number,
        default: 2,
        min: 0,
        max: 30
    },
    lastReminderAt: Date,
    lastClosingNoticeAt: Date,
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    /** Set only when this survey was generated from a recurring Pulse Program */
    pulseProgramId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'PulseProgram',
        index: true
    },
    /** Deterministic occurrence key (YYYY-MM-DD of scheduled start) — unique per program */
    pulseOccurrenceKey: String,
    pulsePeriodLabel: String,
    /** Lifecycle auto-survey trigger (Day 7/30/90 / Exit) — reused Survey model */
    lifecycleTrigger: {
        type: String,
        enum: ['day7', 'day30', 'day90', 'exit'],
        index: true
    },
    /**
     * Legacy: one survey per employee. New automation uses one shared survey per
     * trigger and lists assignees in targetEmployees (lifecycleEmployeeId unset).
     */
    lifecycleEmployeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        index: true
    }
}, {
    timestamps: true
});

surveySchema.index(
    { organizationId: 1, pulseProgramId: 1, pulseOccurrenceKey: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: {
            pulseProgramId: { $exists: true, $ne: null },
            pulseOccurrenceKey: { $exists: true, $ne: null }
        }
    }
);

/** Legacy per-employee lifecycle docs only (shared surveys omit lifecycleEmployeeId). */
surveySchema.index(
    { organizationId: 1, lifecycleTrigger: 1, lifecycleEmployeeId: 1 },
    {
        unique: true,
        sparse: true,
        partialFilterExpression: {
            lifecycleTrigger: { $exists: true, $ne: null },
            lifecycleEmployeeId: { $exists: true, $ne: null }
        }
    }
);

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
    /** Opaque hash for anonymous duplicate prevention (never expose) */
    respondentHash: {
        type: String,
        index: true
    },
    responses: [{
        questionId: mongoose.Schema.Types.ObjectId,
        answer: mongoose.Schema.Types.Mixed,
        questionText: String,
        questionType: String
    }],
    submittedAt: {
        type: Date,
        default: Date.now
    },
    timeSpent: Number,
    isAnonymous: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

const FEEDBACK_STATUSES = [
    'Open',
    'In Review',
    'Resolved',
    'Closed',
    // Suggestion workflow (Phase 1)
    'Submitted',
    'Under Review',
    'Accepted',
    'Rejected',
    'In Progress',
    'Implemented'
];

const feedbackSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    /** Omitted / null when anonymous — never returned for anonymous items */
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        index: true,
        required: false,
        default: null
    },
    /** Irreversible hash so submitter can see own anonymous items without exposing identity */
    submitterHash: {
        type: String,
        index: true,
        select: false
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
        enum: FEEDBACK_STATUSES,
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
    },
    /** HR/Admin-only — never returned to employees */
    internalRemarks: [{
        remark: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        addedAt: { type: Date, default: Date.now }
    }],
    /** Public resolution visible to employee when accepted/implemented */
    resolutionNote: String,
    implementationDate: Date
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
        index: true
    },
    /** Individual, Team, or Department recognition */
    recipientType: {
        type: String,
        enum: ['Individual', 'Team', 'Department'],
        default: 'Individual'
    },
    /** Team members — populated for Team and Department recognitions */
    recipientIds: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    /** Department name for Department-type recognition */
    targetDepartment: String,
    /** Optional display label e.g. "Product Launch Team" */
    teamLabel: String,
    givenBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    type: {
        type: String,
        enum: [
            'Achievement',
            'Teamwork',
            'Leadership',
            'Innovation',
            'Customer Appreciation',
            'Performance',
            'Going Extra Mile',
            // Legacy values — keep valid for existing records
            'Customer Excellence',
            'Going Above & Beyond',
            'Milestone',
            'Appreciation',
            'Other',
            'Excellence',
            'Customer Service',
            'Going Above and Beyond'
        ],
        required: true
    },
    title: {
        type: String,
        required: true
    },
    description: String,
    points: {
        type: Number,
        default: 0,
        min: 0,
        max: 100
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
    },
    reactions: [{
        emoji: {
            type: String,
            required: true,
            maxlength: 16
        },
        employeeId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee',
            required: true
        },
        reactedAt: {
            type: Date,
            default: Date.now
        }
    }]
}, {
    timestamps: true
});

// Indexes
surveySchema.index({ organizationId: 1, status: 1 });
surveySchema.index({ organizationId: 1, startDate: 1, endDate: 1 });
surveySchema.index({ organizationId: 1, status: 1, endDate: 1, reminderEnabled: 1 });
surveyResponseSchema.index({ organizationId: 1, surveyId: 1, employeeId: 1 });
surveyResponseSchema.index({ organizationId: 1, surveyId: 1, respondentHash: 1 });
feedbackSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
feedbackSchema.index({ organizationId: 1, submitterHash: 1, anonymous: 1 });
feedbackSchema.index({ organizationId: 1, type: 1, status: 1 });
recognitionSchema.index({ organizationId: 1, recipientId: 1 });
recognitionSchema.index({ organizationId: 1, status: 1, isPublic: 1 });

const pulseProgramSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: { type: String, required: true, trim: true },
    description: String,
    status: {
        type: String,
        enum: ['Draft', 'Active', 'Paused', 'Completed', 'Archived'],
        default: 'Draft',
        index: true
    },
    frequency: {
        type: String,
        enum: ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'],
        required: true
    },
    startDate: { type: Date, required: true },
    endDate: Date,
    maxOccurrences: { type: Number, min: 1 },
    scheduleAnchorDate: Date,
    nextRunAt: Date,
    lastRunAt: Date,
    occurrenceCount: { type: Number, default: 0, min: 0 },
    targetAudience: {
        type: String,
        enum: ['All Employees', 'Department', 'Role', 'Specific Employees'],
        default: 'All Employees'
    },
    targetDepartments: [String],
    targetRoles: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Role' }],
    targetEmployees: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    anonymous: { type: Boolean, default: false },
    questions: [{
        question: { type: String, required: true },
        type: {
            type: String,
            enum: ['Multiple Choice', 'Rating', 'Text', 'Yes/No', 'Scale', 'eNPS'],
            required: true
        },
        options: [String],
        required: { type: Boolean, default: false },
        order: Number
    }],
    reminderEnabled: { type: Boolean, default: true },
    reminderDaysBefore: { type: Number, default: 2, min: 0, max: 30 },
    openDurationDays: { type: Number, default: 7, min: 1, max: 90 },
    lastGenerationError: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { timestamps: true });

pulseProgramSchema.index({ organizationId: 1, status: 1, nextRunAt: 1 });

export const Survey = mongoose.model('Survey', surveySchema);
export const SurveyResponse = mongoose.model('SurveyResponse', surveyResponseSchema);
export const Feedback = mongoose.model('Feedback', feedbackSchema);
export const Recognition = mongoose.model('Recognition', recognitionSchema);
export const PulseProgram = mongoose.model('PulseProgram', pulseProgramSchema);
export const PULSE_FREQUENCIES = ['Weekly', 'Bi-weekly', 'Monthly', 'Quarterly'];
export const PULSE_PROGRAM_STATUSES = ['Draft', 'Active', 'Paused', 'Completed', 'Archived'];
export const FEEDBACK_STATUS_VALUES = FEEDBACK_STATUSES;
export const SUGGESTION_STATUSES = [
    'Submitted',
    'Under Review',
    'Accepted',
    'Rejected',
    'In Progress',
    'Implemented'
];

export const SUGGESTION_STATUS_TRANSITIONS = Object.freeze({
    Submitted: ['Under Review'],
    'Under Review': ['Accepted', 'Rejected'],
    Accepted: ['In Progress', 'Implemented'],
    'In Progress': ['Implemented'],
    Rejected: [],
    Implemented: []
});

export const RECOGNITION_TYPES = [
    'Achievement',
    'Teamwork',
    'Leadership',
    'Innovation',
    'Customer Appreciation',
    'Performance',
    'Going Extra Mile',
    // Legacy — keep valid for existing records
    'Customer Excellence',
    'Going Above & Beyond',
    'Milestone',
    'Appreciation',
    'Other',
    'Excellence',
    'Customer Service',
    'Going Above and Beyond'
];

export const RECOGNITION_STATUSES = ['Pending', 'Approved', 'Rejected'];

const actionPlanSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, maxlength: 4000 },
    sourceType: {
        type: String,
        enum: ['Survey', 'Pulse', 'Feedback', 'Suggestion', 'Manual'],
        default: 'Manual'
    },
    sourceId: { type: mongoose.Schema.Types.ObjectId },
    department: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High'],
        default: 'Medium'
    },
    dueDate: Date,
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Open',
        index: true
    },
    resolutionRemarks: { type: String, maxlength: 4000 },
    completedAt: Date,
    lastDueNoticeAt: Date,
    lastOverdueNoticeAt: Date
}, { timestamps: true });

actionPlanSchema.index({ organizationId: 1, status: 1, dueDate: 1 });
actionPlanSchema.index({ organizationId: 1, owner: 1, status: 1 });

export const EngagementActionPlan = mongoose.model('EngagementActionPlan', actionPlanSchema);
export const ACTION_PLAN_STATUSES = ['Open', 'In Progress', 'Completed', 'Cancelled'];
export const ACTION_PLAN_PRIORITIES = ['Low', 'Medium', 'High'];
export const ACTION_PLAN_SOURCE_TYPES = ['Survey', 'Pulse', 'Feedback', 'Suggestion', 'Manual'];

export const LIFECYCLE_TRIGGERS = ['day7', 'day30', 'day90', 'exit'];

export const LIFECYCLE_SURVEY_TEMPLATES = Object.freeze({
    day7: {
        title: 'New Joiner Check-in — Day 7',
        type: 'Onboarding',
        description: 'Share how your first week is going so we can support you better.',
        questions: [
            {
                question: 'How welcome have you felt in your first week?',
                type: 'Rating',
                options: ['1', '2', '3', '4', '5'],
                required: true,
                order: 0
            },
            {
                question: 'Do you have the tools and information you need to get started?',
                type: 'Yes/No',
                options: ['Yes', 'No'],
                required: true,
                order: 1
            },
            {
                question: 'What would make your onboarding smoother?',
                type: 'Text',
                options: [],
                required: false,
                order: 2
            }
        ]
    },
    day30: {
        title: 'New Joiner Check-in — Day 30',
        type: 'Onboarding',
        description: 'A short check-in after your first month with the company.',
        questions: [
            {
                question: 'How clear are your role expectations after 30 days?',
                type: 'Scale',
                options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                required: true,
                order: 0
            },
            {
                question: 'How supported do you feel by your manager and team?',
                type: 'Rating',
                options: ['1', '2', '3', '4', '5'],
                required: true,
                order: 1
            },
            {
                question: 'How likely are you to recommend this company as a place to work?',
                type: 'eNPS',
                options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                required: true,
                order: 2
            },
            {
                question: 'Any feedback for improving the first 30 days?',
                type: 'Text',
                options: [],
                required: false,
                order: 3
            }
        ]
    },
    day90: {
        title: 'New Joiner Check-in — Day 90',
        type: 'Onboarding',
        description: 'Help us understand your experience after three months.',
        questions: [
            {
                question: 'How engaged do you feel in your role after 90 days?',
                type: 'Rating',
                options: ['1', '2', '3', '4', '5'],
                required: true,
                order: 0
            },
            {
                question: 'How well does the company culture match what you expected?',
                type: 'Scale',
                options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                required: true,
                order: 1
            },
            {
                question: 'How likely are you to recommend this company as a place to work?',
                type: 'eNPS',
                options: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
                required: true,
                order: 2
            },
            {
                question: 'What should we keep doing — and what should we improve?',
                type: 'Text',
                options: [],
                required: false,
                order: 3
            }
        ]
    },
    exit: {
        title: 'Exit Engagement Survey',
        type: 'Exit',
        description: 'Your feedback helps us improve the employee experience for others.',
        questions: [
            {
                question: 'Overall, how would you rate your experience working here?',
                type: 'Rating',
                options: ['1', '2', '3', '4', '5'],
                required: true,
                order: 0
            },
            {
                question: 'What were the main reasons for leaving?',
                type: 'Multiple Choice',
                options: [
                    'Career growth',
                    'Compensation',
                    'Manager / leadership',
                    'Work-life balance',
                    'Culture / team fit',
                    'Personal reasons',
                    'Other'
                ],
                required: true,
                order: 1
            },
            {
                question: 'Would you consider returning in the future?',
                type: 'Yes/No',
                options: ['Yes', 'No'],
                required: false,
                order: 2
            },
            {
                question: 'What could we have done better?',
                type: 'Text',
                options: [],
                required: false,
                order: 3
            }
        ]
    }
});

export const WELLBEING_TEMPLATE_QUESTIONS = [
    {
        question: 'How would you rate your overall wellbeing at work this week?',
        type: 'Rating',
        options: ['1', '2', '3', '4', '5'],
        required: true,
        order: 0
    },
    {
        question: 'How manageable is your current workload?',
        type: 'Scale',
        options: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'],
        required: true,
        order: 1
    },
    {
        question: 'How would you rate your work-life balance?',
        type: 'Rating',
        options: ['1', '2', '3', '4', '5'],
        required: true,
        order: 2
    },
    {
        question: 'How would you describe your workplace experience right now?',
        type: 'Multiple Choice',
        options: ['Positive', 'Mostly positive', 'Neutral', 'Strained', 'Difficult'],
        required: true,
        order: 3
    },
    {
        question: 'Anything you would like to share (optional)?',
        type: 'Text',
        options: [],
        required: false,
        order: 4
    }
];
