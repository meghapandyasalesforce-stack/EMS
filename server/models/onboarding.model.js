import mongoose from "mongoose";

const onboardingCommentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const onboardingTaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    category: {
        type: String,
        enum: ['Documentation', 'IT Setup', 'HR Paperwork', 'Training',
               'Orientation', 'Equipment', 'Access', 'Other'],
        required: true
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assigneeRole: {
        type: String,
        enum: ['employee', 'hr', 'manager', 'buddy', 'it', 'payroll', 'admin', 'other'],
        default: 'employee'
    },
    dueDate: Date,
    startedDate: Date,
    completedDate: Date,
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Waiting', 'Blocked', 'Completed', 'Cancelled', 'Overdue'],
        default: 'Pending'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    phase: { type: String, default: 'Day 1' },
    dependencies: [{ type: mongoose.Schema.Types.ObjectId }],
    /** Document types that must be uploaded before this task can be completed */
    requiredDocuments: [{ type: String }],
    /** When true, all mandatory workflow documents must be verified (HR tasks) */
    requiresAllMandatoryDocsVerified: { type: Boolean, default: false },
    attachments: [{ name: String, url: String, uploadedAt: Date }],
    comments: [onboardingCommentSchema],
    completionNotes: String,
    notes: String
}, { _id: true });

const onboardingDocumentSchema = new mongoose.Schema({
    documentType: {
        type: String,
        enum: ['AADHAAR', 'PAN', 'PASSPORT', 'DEGREE', 'EXPERIENCE', 'RESUME',
               'OFFER_ACK', 'PHOTO', 'BANK_DETAILS', 'OTHER',
               'Contract', 'NDA', 'Tax Forms',
               'ID Proof', 'Address Proof', 'Education Certificates', 'Previous Employment',
               'Bank Details', 'Other'],
        required: true
    },
    name: String,
    url: String,
    uploadedAt: Date,
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: {
        type: String,
        enum: ['Pending', 'Uploaded', 'Verified', 'Rejected'],
        default: 'Pending'
    },
    mandatory: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    verifiedAt: Date,
    rejectionReason: String,
    remarks: String
}, { _id: true });

const activityFeedSchema = new mongoose.Schema({
    action: { type: String, required: true },
    description: String,
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    actorName: String,
    metadata: mongoose.Schema.Types.Mixed,
    createdAt: { type: Date, default: Date.now }
}, { _id: true });

const onboardingNoteSchema = new mongoose.Schema({
    note: { type: String, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    visibility: {
        type: String,
        enum: ['internal', 'employee', 'manager', 'all'],
        default: 'internal'
    },
    addedAt: { type: Date, default: Date.now }
}, { _id: true });

const onboardingWorkflowSchema = new mongoose.Schema({
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
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate' },
    startDate: { type: Date, default: Date.now },
    joiningDate: Date,
    expectedCompletionDate: Date,
    actualCompletionDate: Date,
    status: {
        type: String,
        enum: ['Draft', 'Scheduled', 'Not Started', 'In Progress', 'Completed', 'Paused', 'Cancelled', 'Overdue', 'On Hold'],
        default: 'Draft'
    },
    scheduledStartDate: Date,
    tasks: [onboardingTaskSchema],
    documents: [onboardingDocumentSchema],
    checklist: [{
        item: String,
        category: String,
        phase: String,
        mandatory: { type: Boolean, default: false },
        completed: { type: Boolean, default: false },
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        completedAt: Date
    }],
    welcomeMessage: String,
    assignedHR: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedBuddy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    progressBreakdown: {
        tasks: { type: Number, default: 0 },
        documents: { type: Number, default: 0 },
        checklist: { type: Number, default: 0 },
        training: { type: Number, default: 0 },
        byRole: {
            employee: { type: Number, default: 0 },
            hr: { type: Number, default: 0 },
            it: { type: Number, default: 0 },
            manager: { type: Number, default: 0 },
            buddy: { type: Number, default: 0 },
            payroll: { type: Number, default: 0 },
        },
    },
    assets: [{
        assetType: {
            type: String,
            enum: ['Laptop', 'Mouse', 'Keyboard', 'Monitor', 'ID Card', 'Access Card', 'SIM', 'Locker', 'Headphones', 'Other'],
        },
        name: String,
        serialNumber: String,
        status: {
            type: String,
            enum: ['Pending', 'Assigned', 'Returned', 'Lost', 'Damaged'],
            default: 'Pending',
        },
        assignedAt: Date,
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        returnedAt: Date,
        notes: String,
        mandatory: { type: Boolean, default: false },
    }],
    trainingModules: [{
        title: { type: String, required: true },
        description: String,
        type: { type: String, enum: ['video', 'quiz', 'document'], default: 'video' },
        videoUrl: String,
        documentUrl: String,
        quizQuestions: [{
            question: String,
            options: [String],
            correctIndex: Number,
        }],
        status: {
            type: String,
            enum: ['Not Started', 'In Progress', 'Completed', 'Failed'],
            default: 'Not Started',
        },
        score: Number,
        passingScore: { type: Number, default: 70 },
        certificateUrl: String,
        completedAt: Date,
        mandatory: { type: Boolean, default: true },
        phase: String,
    }],
    policySignatures: [{
        documentType: {
            type: String,
            enum: ['OFFER_LETTER', 'NDA', 'COMPANY_POLICIES', 'CODE_OF_CONDUCT', 'SECURITY_POLICY', 'OTHER'],
        },
        title: String,
        documentUrl: String,
        status: { type: String, enum: ['Pending', 'Signed'], default: 'Pending' },
        signedAt: Date,
        signedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        signatureData: String,
        ipAddress: String,
        mandatory: { type: Boolean, default: true },
    }],
    buddyCheckins: [{
        type: {
            type: String,
            enum: ['welcome_meeting', 'first_week', 'day_30'],
        },
        title: String,
        scheduledDate: Date,
        completedDate: Date,
        status: { type: String, enum: ['Pending', 'Scheduled', 'Completed'], default: 'Pending' },
        feedback: String,
        rating: { type: Number, min: 1, max: 5 },
    }],
    managerActions: [{
        actionType: {
            type: String,
            enum: ['probation_goals', 'first_project', 'one_on_one', 'review', 'team_progress'],
        },
        title: String,
        status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
        dueDate: Date,
        completedAt: Date,
        notes: String,
    }],
    activityFeed: [activityFeedSchema],
    notes: [onboardingNoteSchema],
    isTemplate: { type: Boolean, default: false },
    templateName: String,
    policyAccepted: { type: Boolean, default: false },
    policyAcceptedAt: Date,
    orientationCompleted: { type: Boolean, default: false },
    reviewMeetingScheduled: Date,
    reviewMeetingCompleted: { type: Boolean, default: false }
}, { timestamps: true });

const onboardingTemplateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: { type: String, required: true },
    description: String,
    isDefault: { type: Boolean, default: false },
    welcomeMessage: String,
    expectedDays: { type: Number, default: 30 },
    tasks: [{
        title: String,
        description: String,
        category: String,
        assigneeRole: String,
        priority: String,
        dueDaysFromStart: Number,
        phase: String
    }],
    checklist: [{
        item: String,
        category: String,
        phase: String,
        mandatory: Boolean
    }],
    documents: [{
        documentType: String,
        mandatory: Boolean
    }]
}, { timestamps: true });

const offboardingWorkflowSchema = new mongoose.Schema({
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
    lastWorkingDate: { type: Date, required: true },
    resignationDate: Date,
    reason: {
        type: String,
        enum: ['Resignation', 'Termination', 'Retirement', 'Contract End', 'Other']
    },
    reasonDetails: String,
    status: {
        type: String,
        enum: ['Initiated', 'In Progress', 'Completed', 'On Hold'],
        default: 'Initiated'
    },
    tasks: [{
        title: String,
        description: String,
        category: {
            type: String,
            enum: ['IT', 'HR', 'Finance', 'Access', 'Equipment', 'Knowledge Transfer', 'Other']
        },
        assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        dueDate: Date,
        completedDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Overdue'],
            default: 'Pending'
        }
    }],
    exitInterview: {
        scheduledDate: Date,
        conductedDate: Date,
        conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        questions: [{ question: String, answer: String }],
        feedback: String,
        rating: Number
    },
    assets: [{
        assetType: String,
        assetName: String,
        assetId: String,
        returnDate: Date,
        returned: { type: Boolean, default: false },
        condition: String
    }],
    accessRevocation: [{
        system: String,
        accessType: String,
        revokedDate: Date,
        revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    }],
    knowledgeTransfer: [{
        topic: String,
        transferredTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        transferDate: Date,
        documents: [String],
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed'],
            default: 'Pending'
        }
    }],
    finalSettlement: {
        lastSalaryDate: Date,
        pendingDues: Number,
        deductions: Number,
        finalAmount: Number,
        paidDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'Calculated', 'Paid'],
            default: 'Pending'
        }
    },
    documents: [{
        documentType: String,
        name: String,
        url: String,
        uploadedAt: Date
    }],
    progress: { type: Number, min: 0, max: 100, default: 0 },
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
}, { timestamps: true });

onboardingWorkflowSchema.index({ organizationId: 1, employeeId: 1 });
onboardingWorkflowSchema.index({ organizationId: 1, status: 1 });
onboardingTemplateSchema.index({ organizationId: 1, isDefault: 1 });
offboardingWorkflowSchema.index({ organizationId: 1, employeeId: 1 });
offboardingWorkflowSchema.index({ organizationId: 1, status: 1 });

export const OnboardingWorkflow = mongoose.model('OnboardingWorkflow', onboardingWorkflowSchema);
export const OnboardingTemplate = mongoose.model('OnboardingTemplate', onboardingTemplateSchema);
export const OffboardingWorkflow = mongoose.model('OffboardingWorkflow', offboardingWorkflowSchema);
