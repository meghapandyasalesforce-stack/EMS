import mongoose from "mongoose";
import { lifecycleStageSchema } from "./lifecycle.model.js";

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
    overdueAt: Date,
    overdueNotifiedAt: Date,
    reminderSentAt: Date,
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
    mandatory: { type: Boolean, default: true },
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
    canonicalDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
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
    originalFileName: String,
    url: String,
    uploadedAt: Date,
    dueDate: Date,
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
    remarks: String,
    version: { type: Number, default: 0 },
    versionHistory: [{
        version: Number,
        originalFileName: String,
        url: String,
        uploadedAt: Date,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        status: String,
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        verifiedAt: Date,
        rejectionReason: String,
        remarks: String
    }]
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
    backgroundVerificationCaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'BackgroundVerificationCase' },
    offboardingTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OffboardingTemplate' },
    startDate: { type: Date, default: Date.now },
    joiningDate: Date,
    expectedCompletionDate: Date,
    actualCompletionDate: Date,
    status: {
        type: String,
        enum: ['Draft', 'Scheduled', 'Not Started', 'In Progress', 'Completed', 'Paused', 'Cancelled', 'Overdue', 'On Hold'],
        default: 'Draft'
    },
    pausedFromStatus: {
        type: String,
        enum: ['Scheduled', 'Not Started', 'In Progress', 'Overdue']
    },
    scheduledStartDate: Date,
    tasks: [onboardingTaskSchema],
    documents: [onboardingDocumentSchema],
    checklist: [{
        item: String,
        category: String,
        phase: String,
        featureKey: String,
        mandatory: { type: Boolean, default: false },
        assignedRole: {
            type: String,
            enum: ['employee', 'hr', 'manager', 'buddy', 'it', 'payroll', 'admin', 'other'],
            default: 'employee'
        },
        completed: { type: Boolean, default: false },
        dueDate: Date,
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
        policies: { type: Number, default: 0 },
        assets: { type: Number, default: 0 },
        forms: { type: Number, default: 0 },
        goals: { type: Number, default: 0 },
        bgv: { type: Number, default: 0 },
        software: { type: Number, default: 0 },
        byRole: {
            employee: { type: Number, default: 0 },
            hr: { type: Number, default: 0 },
            it: { type: Number, default: 0 },
            manager: { type: Number, default: 0 },
            buddy: { type: Number, default: 0 },
            payroll: { type: Number, default: 0 },
        },
    },
    /** Mirrored from BackgroundVerificationCase for progress + joining gates */
    bgvProgress: { type: Number, min: 0, max: 100, default: 0 },
    bgvStatus: {
        type: String,
        enum: ['Not Started', 'In Progress', 'Partially Clear', 'Clear', 'Failed', 'Waived'],
        default: 'Not Started',
    },
    bgvBlocksJoining: { type: Boolean, default: false },
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
        mandatory: { type: Boolean, default: false }
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
        dueDate: Date,
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
        dueDate: Date,
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
    milestones: [{
        day: { type: Number, enum: [30, 60, 90] },
        title: String,
        status: { type: String, enum: ['Pending', 'In Progress', 'Completed', 'Overdue', 'Waived'], default: 'Pending' },
        dueDate: Date,
        completedAt: Date,
        employeeReview: {
            status: { type: String, default: 'Pending' },
            rating: Number,
            feedback: String,
            submittedAt: Date,
            submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        },
        managerReview: {
            status: { type: String, default: 'Pending' },
            rating: Number,
            feedback: String,
            submittedAt: Date,
            submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        },
        hrReview: {
            status: { type: String, default: 'Pending' },
            rating: Number,
            feedback: String,
            submittedAt: Date,
            submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        },
        goals: [{ title: String, status: String, dueDate: Date }],
        actionItems: [{ title: String, assignee: String, status: String, dueDate: Date }],
    }],
    probation: {
        startDate: Date,
        endDate: Date,
        originalEndDate: Date,
        status: { type: String, enum: ['Not Started', 'Active', 'Extended', 'Confirmed', 'Rejected', 'Terminated', 'Waived'] },
        extensionDays: { type: Number, default: 0 },
        extensionReason: String,
        midReview: {
            status: { type: String, default: 'Pending' },
            scheduledDate: Date,
            completedAt: Date,
            rating: Number,
            feedback: String,
            completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        },
        finalReview: {
            status: { type: String, default: 'Pending' },
            scheduledDate: Date,
            completedAt: Date,
            rating: Number,
            feedback: String,
            completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        },
        confirmedAt: Date,
        confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        rejectedAt: Date,
        rejectionReason: String,
    },
    softwareRequests: [{
        system: { type: String, required: true },
        category: { type: String, enum: ['scm', 'communication', 'project', 'application', 'email', 'vpn', 'other'], default: 'application' },
        status: { type: String, enum: ['Pending', 'Approved', 'Ticket Created', 'Assigned', 'In Progress', 'Provisioned', 'Completed', 'Rejected', 'Revoked'], default: 'Pending' },
        approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
        ticketId: String,
        ticketUrl: String,
        provisionedAt: Date,
        mandatory: { type: Boolean, default: false },
        featureKey: String,
        approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        notes: String,
    }],
    fastTrack: { type: Boolean, default: false },
    packBgvCheckTypes: [String],
    mandatoryFormsCompleted: { type: Boolean, default: false },
    formsProgress: { type: Number, min: 0, max: 100, default: 0 },
    goalsProgress: { type: Number, min: 0, max: 100, default: 0 },
    assignedGoalIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Goal' }],
    formGateStatus: mongoose.Schema.Types.Mixed,
    onboardingGoals: mongoose.Schema.Types.Mixed,
    activityFeed: [activityFeedSchema],
    notes: [onboardingNoteSchema],
    isTemplate: { type: Boolean, default: false },
    templateName: String,
    policyAccepted: { type: Boolean, default: false },
    policyAcceptedAt: Date,
    orientationCompleted: { type: Boolean, default: false },
    reviewMeetingScheduled: Date,
    reviewMeetingCompleted: { type: Boolean, default: false },
    completionNotifiedAt: Date,
    notificationHistory: [{
        key: { type: String, required: true },
        eventType: String,
        sentAt: { type: Date, default: Date.now },
    }],
    lastAutomationRunAt: Date,
    escalationHistory: [{
        key: String,
        ruleKey: String,
        sentAt: Date,
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    }],
}, { timestamps: true });

const templateTaskFields = new mongoose.Schema({
    title: String,
    description: String,
    category: String,
    assigneeRole: String,
    priority: String,
    mandatory: { type: Boolean, default: true },
    dueDaysFromStart: Number,
    dueDaysBeforeLastWorkingDate: Number,
    dueDaysAfterLastWorkingDate: Number,
    phase: String,
    stageKey: String,
    featureKey: String,
    order: { type: Number, default: 0 },
    dependencies: [String],
    requiredDocuments: [String],
    requiresAllMandatoryDocsVerified: { type: Boolean, default: false },
}, { _id: true });

const templateVersionHistorySchema = new mongoose.Schema({
    version: { type: Number, required: true },
    snapshot: mongoose.Schema.Types.Mixed,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    changedAt: { type: Date, default: Date.now },
    changeNotes: String,
}, { _id: false });

const templateWorkflowMetaSchema = {
    version: { type: Number, default: 1 },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Published',
        index: true,
    },
    publishedAt: Date,
    versionHistory: [templateVersionHistorySchema],
    clonedFrom: { type: mongoose.Schema.Types.ObjectId },
    stageGroups: [{
        key: { type: String, required: true },
        name: { type: String, required: true },
        description: String,
        order: { type: Number, default: 0 },
    }],
};

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
    ...templateWorkflowMetaSchema,
    stages: [lifecycleStageSchema],
    tasks: [templateTaskFields],
    checklist: [{
        item: String,
        category: String,
        phase: String,
        stageKey: String,
        featureKey: String,
        order: { type: Number, default: 0 },
        mandatory: Boolean,
        assignedRole: String
    }],
    documents: [{
        documentType: String,
        catalogKey: String,
        mandatory: Boolean,
        featureKey: String,
        stageKey: String,
        order: { type: Number, default: 0 },
    }],
    assets: [{
        assetType: String,
        name: String,
        mandatory: Boolean,
        featureKey: String,
        stageKey: String,
        order: { type: Number, default: 0 },
    }],
    trainingModules: [{
        title: String,
        description: String,
        type: String,
        videoUrl: String,
        documentUrl: String,
        quizQuestions: [{
            question: String,
            options: [String],
            correctIndex: Number
        }],
        passingScore: Number,
        mandatory: Boolean,
        phase: String,
        featureKey: String,
        stageKey: String,
        order: { type: Number, default: 0 },
    }],
    policySignatures: [{
        documentType: String,
        title: String,
        documentUrl: String,
        mandatory: Boolean,
        featureKey: String,
        stageKey: String,
        order: { type: Number, default: 0 },
    }]
}, { timestamps: true });

const offboardingTemplateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: { type: String, required: true },
    description: String,
    isDefault: { type: Boolean, default: false },
    expectedDays: { type: Number, default: 14 },
    ...templateWorkflowMetaSchema,
    exitTypes: [{
        type: String,
        enum: ['Resignation', 'Termination', 'Retirement', 'Contract End', 'Other'],
    }],
    stages: [lifecycleStageSchema],
    tasks: [templateTaskFields],
    clearanceChecklist: [{
        item: String,
        category: String,
        assignedRole: String,
        mandatory: { type: Boolean, default: true },
        featureKey: String,
        stageKey: String,
        order: { type: Number, default: 0 },
    }],
    accessRevocation: [{
        system: String,
        accessType: String,
        mandatory: { type: Boolean, default: true },
        featureKey: String,
        order: { type: Number, default: 0 },
    }],
    knowledgeTransfer: [{
        topic: String,
        description: String,
        mandatory: { type: Boolean, default: true },
        featureKey: String,
        dueDaysBeforeLastWorkingDate: Number,
        order: { type: Number, default: 0 },
    }],
    assetRules: [{
        assetType: String,
        mandatory: { type: Boolean, default: true },
        featureKey: String,
        order: { type: Number, default: 0 },
    }],
    clearanceRules: [{
        department: String,
        assignedRole: String,
        mandatory: { type: Boolean, default: true },
        featureKey: String,
        slaDays: Number,
        order: { type: Number, default: 0 },
    }],
    documents: [{
        documentType: String,
        catalogKey: String,
        mandatory: Boolean,
        featureKey: String,
        order: { type: Number, default: 0 },
    }],
    exitInterview: {
        enabled: { type: Boolean, default: false },
        mandatory: { type: Boolean, default: false },
        featureKey: { type: String, default: 'exitInterview' },
    },
    finalSettlement: {
        enabled: { type: Boolean, default: true },
        mandatory: { type: Boolean, default: true },
        featureKey: { type: String, default: 'fnfSettlement' },
    },
}, { timestamps: true });

const offboardingTaskSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    category: {
        type: String,
        enum: ['IT', 'HR', 'Finance', 'Access', 'Equipment', 'Knowledge Transfer', 'Documentation', 'Other'],
        default: 'Other'
    },
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assigneeRole: {
        type: String,
        enum: ['employee', 'hr', 'manager', 'it', 'payroll', 'admin', 'other'],
        default: 'employee'
    },
    dueDate: Date,
    startedDate: Date,
    completedDate: Date,
    overdueAt: Date,
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
    mandatory: { type: Boolean, default: true },
    completionNotes: String
}, { _id: true });

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
    noticePeriod: {
        startDate: Date,
        policyDays: Number,
        servedDays: Number,
        remainingDays: Number,
        buyoutApproved: { type: Boolean, default: false },
        buyoutDays: { type: Number, default: 0 },
        leaveAdjustmentDays: { type: Number, default: 0 },
        status: {
            type: String,
            enum: ['Not Applicable', 'Active', 'Completed', 'Waived', 'Buyout'],
            default: 'Not Applicable',
        },
    },
    startDate: { type: Date, default: Date.now },
    expectedCompletionDate: Date,
    actualCompletionDate: Date,
    reason: {
        type: String,
        enum: ['Resignation', 'Termination', 'Retirement', 'Contract End', 'Other']
    },
    reasonDetails: String,
    status: {
        type: String,
        enum: ['Draft', 'Scheduled', 'Initiated', 'In Progress', 'Completed', 'Paused', 'Cancelled', 'Overdue', 'On Hold'],
        default: 'Initiated'
    },
    pausedFromStatus: String,
    assignedHR: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    tasks: [offboardingTaskSchema],
    clearanceChecklist: [{
        item: { type: String, required: true },
        category: {
            type: String,
            enum: ['HR', 'IT', 'Finance', 'Manager', 'Employee', 'Documentation', 'Other'],
            default: 'Other'
        },
        assignedRole: {
            type: String,
            enum: ['employee', 'hr', 'manager', 'it', 'payroll', 'admin', 'other'],
            default: 'employee'
        },
        mandatory: { type: Boolean, default: true },
        completed: { type: Boolean, default: false },
        dueDate: Date,
        completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        completedAt: Date,
        notes: String
    }],
    exitInterview: {
        scheduledDate: Date,
        conductedDate: Date,
        conductedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        questions: [{ question: String, answer: String }],
        feedback: String,
        rating: { type: Number, min: 1, max: 5 },
        status: {
            type: String,
            enum: ['Not Scheduled', 'Scheduled', 'In Progress', 'Completed', 'Waived', 'Overdue'],
            default: 'Not Scheduled'
        },
        mandatory: { type: Boolean, default: true },
        sessions: [{
            sessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExitInterviewSession' },
            interviewType: String,
            status: String,
            scheduledDate: Date,
            formDefinitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleFormDefinition' },
        }],
        completionPercent: { type: Number, default: 0 },
    },
    assets: [{
        onboardingWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingWorkflow' },
        onboardingAssetId: mongoose.Schema.Types.ObjectId,
        assetType: String,
        assetName: String,
        assetId: String,
        returnDate: Date,
        returned: { type: Boolean, default: false },
        condition: {
            type: String,
            enum: ['Good', 'Damaged', 'Lost', 'Not Applicable'],
            default: 'Good'
        },
        status: {
            type: String,
            enum: ['Pending', 'Returned', 'Damaged', 'Lost', 'Waived'],
            default: 'Pending'
        },
        mandatory: { type: Boolean, default: true },
        notes: String,
        clearedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }
    }],
    accessRevocation: [{
        system: String,
        accessType: String,
        revokedDate: Date,
        revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        dueDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'Completed', 'Waived'],
            default: 'Pending'
        },
        mandatory: { type: Boolean, default: true },
        notes: String
    }],
    knowledgeTransfer: [{
        topic: String,
        description: String,
        transferredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        transferredTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        transferDate: Date,
        documents: [String],
        dueDate: Date,
        status: {
            type: String,
            enum: ['Pending', 'In Progress', 'Completed', 'Waived', 'Overdue'],
            default: 'Pending'
        },
        mandatory: { type: Boolean, default: true },
        notes: String
    }],
    finalSettlement: {
        lastSalaryDate: Date,
        pendingDues: Number,
        leaveEncashment: Number,
        bonusAmount: Number,
        gratuityEstimate: Number,
        recoveries: Number,
        taxDeduction: Number,
        deductions: Number,
        finalAmount: Number,
        paidDate: Date,
        pdfUrl: String,
        pdfFileName: String,
        approvalInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalInstance' },
        calculationNotes: String,
        calculatedAt: Date,
        calculatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        status: {
            type: String,
            enum: ['Pending', 'In Review', 'Calculated', 'Pending Approval', 'Approved', 'Paid', 'Cleared', 'Waived'],
            default: 'Pending'
        },
        mandatory: { type: Boolean, default: true },
        notes: String,
        clearedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        clearedAt: Date
    },
    // Kept for backwards compatibility. New uploads remain in the canonical Document model.
    documents: [{
        canonicalDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
        documentType: String,
        name: String,
        url: String,
        uploadedAt: Date
    }],
    documentSummary: {
        total: { type: Number, default: 0 },
        pending: { type: Number, default: 0 },
        verified: { type: Number, default: 0 },
        rejected: { type: Number, default: 0 },
        synchronizedAt: Date
    },
    experienceLetter: {
        canonicalDocumentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
        name: String,
        fileName: String,
        fileUrl: String,
        mimeType: String,
        uploadedAt: Date,
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        status: {
            type: String,
            enum: ['Pending', 'Issued', 'Waived'],
            default: 'Pending'
        }
    },
    progress: { type: Number, min: 0, max: 100, default: 0 },
    progressBreakdown: {
        tasks: { type: Number, default: 0 },
        checklist: { type: Number, default: 0 },
        assets: { type: Number, default: 0 },
        knowledgeTransfer: { type: Number, default: 0 },
        exitInterview: { type: Number, default: 0 },
        payrollClearance: { type: Number, default: 0 },
        accessRevocation: { type: Number, default: 0 },
        byRole: {
            employee: { type: Number, default: 0 },
            hr: { type: Number, default: 0 },
            manager: { type: Number, default: 0 },
            it: { type: Number, default: 0 },
            payroll: { type: Number, default: 0 }
        }
    },
    activityFeed: [activityFeedSchema],
    notes: [onboardingNoteSchema],
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    completionNotifiedAt: Date,
    overdueNotifiedAt: Date,
    notificationHistory: [{
        key: { type: String, required: true },
        eventType: String,
        sentAt: { type: Date, default: Date.now }
    }],
    lastAutomationRunAt: Date,
    escalationHistory: [{
        key: String,
        ruleKey: String,
        sentAt: Date,
        recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    }],
}, { timestamps: true });

onboardingWorkflowSchema.index({ organizationId: 1, employeeId: 1 });
onboardingWorkflowSchema.index({ organizationId: 1, status: 1 });
onboardingTemplateSchema.index({ organizationId: 1, isDefault: 1 });
offboardingTemplateSchema.index({ organizationId: 1, isDefault: 1 });
offboardingWorkflowSchema.index({ organizationId: 1, employeeId: 1 });
offboardingWorkflowSchema.index({ organizationId: 1, status: 1 });

export const OnboardingWorkflow = mongoose.model('OnboardingWorkflow', onboardingWorkflowSchema);
export const OnboardingTemplate = mongoose.model('OnboardingTemplate', onboardingTemplateSchema);
export const OffboardingTemplate = mongoose.model('OffboardingTemplate', offboardingTemplateSchema);
export const OffboardingWorkflow = mongoose.model('OffboardingWorkflow', offboardingWorkflowSchema);
