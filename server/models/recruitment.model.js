import mongoose from "mongoose";

const recruitmentSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    jobTitle: {
        type: String,
        required: true,
        trim: true
    },
    department: {
        type: String,
        required: true
    },
    position: {
        type: String,
        required: true
    },
    jobDescription: {
        type: String,
        required: true
    },
    requirements: [{
        type: String
    }],
    responsibilities: [{
        type: String
    }],
    /**
     * Automatic resume screening criteria for this job.
     * Empty requiredKeywords → screening skipped for applicants to this job.
     */
    screeningCriteria: {
        enabled: { type: Boolean, default: true },
        requiredKeywords: [{ type: String, trim: true }],
        optionalKeywords: [{ type: String, trim: true }],
        minimumMatchPercent: { type: Number, default: 70, min: 0, max: 100 },
        experienceRequired: { type: String, trim: true, default: '' },
        education: { type: String, trim: true, default: '' },
        certifications: [{ type: String, trim: true }],
        /** Source template (optional). Keywords on this job are a copy and may differ from the template. */
        templateId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'ResumeScreeningTemplate',
            default: null,
        },
        templateName: { type: String, trim: true, default: '' },
    },
    location: {
        type: String,
        required: true
    },
    employmentType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'],
        required: true
    },
    salaryRange: {
        min: Number,
        max: Number,
        currency: {
            type: String,
            default: 'USD'
        }
    },
    status: {
        type: String,
        enum: ['Draft', 'Open', 'Closed', 'On Hold', 'Cancelled'],
        default: 'Draft'
    },
    postedDate: {
        type: Date,
        default: Date.now
    },
    closingDate: {
        type: Date
    },
    hiringManager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    recruiter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    primaryRecruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    backupRecruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    coordinatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    numberOfPositions: {
        type: Number,
        default: 1
    },
    filledPositions: {
        type: Number,
        default: 0
    },
    currentApplications: {
        type: Number,
        default: 0
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium'
    },
    /** Internal-only posting (employees); external career portal when externalVisible */
    internalVisible: {
        type: Boolean,
        default: false
    },
    externalVisible: {
        type: Boolean,
        default: true
    },
    /** When Open + internalVisible, notify all employees (default off) */
    notifyEmployeesOnOpen: {
        type: Boolean,
        default: false
    },
    /** Prevent duplicate employee blasts for the same open cycle */
    employeesNotifiedAt: {
        type: Date,
        default: null
    },
    tags: [String],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    archivedAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

const candidateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    jobPostingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Recruitment',
        required: true,
        index: true
    },
    firstName: {
        type: String,
        required: true,
        trim: true
    },
    lastName: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true
    },
    phone: {
        type: String
    },
    resume: {
        url: String,
        fileName: String,
        uploadedAt: Date
    },
    coverLetter: {
        type: String
    },
    /** Uploaded cover letter file (preferred over free-text coverLetter) */
    coverLetterAttachment: {
        url: String,
        fileName: String,
        mimeType: String,
        uploadedAt: Date
    },
    status: {
        type: String,
        enum: ['Applied', 'Screening', 'Phone Interview', 'Technical Interview',
               'Final Interview', 'Offer Extended', 'Offer Accepted', 'Offer Declined',
               'Rejected', 'Withdrawn', 'On Hold'],
        default: 'Applied'
    },
    stage: {
        type: String,
        enum: ['Application', 'Screening', 'Interview', 'Offer', 'Hired', 'Rejected'],
        default: 'Application'
    },
    source: {
        type: String,
        enum: ['Job Board', 'Company Website', 'Referral', 'LinkedIn', 'Indeed',
               'Glassdoor', 'Recruitment Agency', 'Social Media', 'Internal', 'Email', 'Other'],
        default: 'Company Website'
    },
    /** Metadata when candidate was imported via Resume Inbox (email) */
    emailImport: {
        messageId: String,
        fromAddress: String,
        subject: String,
        receivedAt: Date,
        unassigned: { type: Boolean, default: false },
        importId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResumeInboxImport' },
    },
    referredBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    /** If the applicant is an existing employee (internal apply) */
    applicantEmployeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
        index: true,
    },
    referralBonusStatus: {
        type: String,
        enum: ['None', 'Pending', 'Payable', 'Paid', 'NotEligible'],
        default: 'None',
    },
    /** Token for candidate self-service portal */
    selfServiceToken: { type: String, sparse: true, index: true },
    selfServiceTokenExpiresAt: Date,
    primaryRecruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    backupRecruiterId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    coordinatorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    assignmentHistory: [{
        field: { type: String, enum: ['primary', 'backup', 'coordinator'] },
        from: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        to: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        reason: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        changedAt: { type: Date, default: Date.now }
    }],
    applicationDate: {
        type: Date,
        default: Date.now
    },
    interviewSchedule: [{
        interviewType: {
            type: String,
            enum: ['Phone', 'Video', 'On-site', 'Technical', 'Panel', 'Final']
        },
        scheduledDate: Date,
        scheduledTime: String,
        interviewer: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        location: String,
        meetingLink: String,
        status: {
            type: String,
            enum: ['Scheduled', 'Completed', 'Cancelled', 'Rescheduled'],
            default: 'Scheduled'
        },
        feedbackDueAt: Date,
        feedback: {
            rating: Number,
            technical: Number,
            communication: Number,
            behaviour: Number,
            comments: String,
            strengths: [String],
            weaknesses: [String],
            recommendation: {
                type: String,
                enum: ['Strong Hire', 'Hire', 'Maybe', 'No Hire']
            },
            submittedAt: Date
        }
    }],
    scores: {
        resumeScore: Number,
        technicalScore: Number,
        culturalFitScore: Number,
        overallScore: Number
    },
    /**
     * Automatic resume screening result (Career Portal / Email / Referral / Internal / etc.).
     * Does not replace status/stage enums — Failed sets status=Rejected; Passed keeps Applied.
     */
    resumeScreening: {
        status: {
            type: String,
            enum: ['pending', 'passed', 'failed', 'skipped'],
            default: 'pending',
            index: true,
        },
        /** Display decision: approved when passed, rejected when failed, pending when not screened */
        decision: {
            type: String,
            enum: ['approved', 'rejected', 'pending'],
            default: 'pending',
        },
        matchScore: { type: Number, default: null },
        requiredMatchPercent: { type: Number, default: null },
        requiredTotal: { type: Number, default: null },
        matchedRequired: { type: Number, default: null },
        matchedKeywords: [String],
        missingKeywords: [String],
        optionalMatched: [String],
        minimumRequired: { type: Number, default: null },
        screeningDate: Date,
        screenedAt: Date,
        rejectedDate: Date,
        deleteAfterDate: { type: Date, default: null, index: true },
        reason: { type: String, default: null },
        parsedTextLength: { type: Number, default: 0 },
        /** Monotonic run id to ignore stale concurrent saves */
        runId: { type: Number, default: 0 },
    },
    notes: [{
        note: String,
        addedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        addedAt: {
            type: Date,
            default: Date.now
        }
    }],
    communications: [{
        channel: {
            type: String,
            enum: ['email', 'sms', 'whatsapp', 'call', 'meeting', 'note'],
            default: 'note'
        },
        direction: {
            type: String,
            enum: ['inbound', 'outbound'],
            default: 'outbound'
        },
        subject: String,
        body: String,
        participants: [String],
        attachments: [{
            fileName: String,
            url: String,
        }],
        autoLogged: { type: Boolean, default: false },
        emailType: String,
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        createdAt: { type: Date, default: Date.now }
    }],
    offerDetails: {
        position: String,
        startDate: Date,
        salary: Number,
        benefits: [String],
        offerLetter: {
            url: String,
            sentDate: Date,
            expiryDate: Date
        },
        status: {
            type: String,
            enum: ['Draft', 'Sent', 'Accepted', 'Declined', 'Expired', 'Countered']
        }
    },
    backgroundCheck: {
        status: {
            type: String,
            enum: ['Not Started', 'In Progress', 'Completed', 'Failed']
        },
        completedDate: Date,
        report: String
    },
    poolMemberships: [{
        type: String,
        enum: ['Silver', 'Gold', 'Future Hiring', 'Campus', 'Referral']
    }],
    blacklist: {
        isBlacklisted: { type: Boolean, default: false },
        reason: String,
        blacklistedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        blacklistedAt: Date,
        expiryDate: Date
    },
    consent: {
        accepted: { type: Boolean, default: false },
        acceptedAt: Date,
        policyVersion: String,
        ipAddress: String
    },
    joiningStatus: {
        type: String,
        enum: ['None', 'Confirmed', 'Delayed', 'Declined'],
        default: 'None'
    },
    expectedJoiningDate: Date,
    withdrawnReason: String,
    archivedAt: Date,
    screeningDueAt: Date,
    linkedEmployeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        default: null,
        index: true
    },
    tags: [String],
    assessments: [{
        type: {
            type: String,
            enum: ['Coding', 'MCQ', 'Excel', 'Behaviour', 'Typing', 'Other'],
            required: true,
        },
        title: String,
        status: {
            type: String,
            enum: ['Assigned', 'In Progress', 'Completed', 'Expired', 'Cancelled'],
            default: 'Assigned',
        },
        score: Number,
        maxScore: { type: Number, default: 100 },
        resultUrl: String,
        dueAt: Date,
        completedAt: Date,
        notes: String,
        assignedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        createdAt: { type: Date, default: Date.now },
    }],
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true
});

const jobRequisitionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    title: { type: String, required: true, trim: true },
    department: { type: String, required: true },
    position: { type: String, required: true },
    jobDescription: { type: String, required: true },
    location: { type: String, required: true },
    employmentType: {
        type: String,
        enum: ['Full-time', 'Part-time', 'Contract', 'Internship', 'Temporary'],
        default: 'Full-time',
    },
    numberOfPositions: { type: Number, default: 1 },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Critical'],
        default: 'Medium',
    },
    justification: String,
    salaryRange: {
        min: Number,
        max: Number,
        currency: { type: String, default: 'INR' },
    },
    hiringManager: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: {
        type: String,
        enum: ['Draft', 'PendingApproval', 'Approved', 'Rejected', 'Converted', 'Cancelled'],
        default: 'Draft',
        index: true,
    },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    approvedAt: Date,
    rejectionReason: String,
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruitment' },
    targetStartDate: Date,
    notes: [{
        note: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        addedAt: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

jobRequisitionSchema.index({ organizationId: 1, status: 1 });

// Indexes
recruitmentSchema.index({ organizationId: 1, status: 1 });
recruitmentSchema.index({ organizationId: 1, department: 1 });
recruitmentSchema.index({ organizationId: 1, status: 1, externalVisible: 1 });
candidateSchema.index({ organizationId: 1, jobPostingId: 1, status: 1 });
candidateSchema.index({ organizationId: 1, email: 1 });
candidateSchema.index({ organizationId: 1, stage: 1, archivedAt: 1 });
candidateSchema.index({ organizationId: 1, primaryRecruiterId: 1 });
candidateSchema.index({ organizationId: 1, 'resumeScreening.status': 1, archivedAt: 1 });
candidateSchema.index({ 'resumeScreening.deleteAfterDate': 1, 'resumeScreening.status': 1 });

/** Fire automatic screening once after a new candidate is created (all sources). */
candidateSchema.pre('save', function (next) {
    this._wasNew = this.isNew;
    next();
});

candidateSchema.post('save', function (doc) {
    if (!doc._wasNew) return;
    // Resume Inbox runs an explicit screen after import — skip async post-save to avoid
    // racing Rejected vs Skipped writes on the same candidate.
    const tags = doc.tags || [];
    if (doc.source === 'Email' || tags.includes('Resume Inbox')) return;

    setImmediate(() => {
        import('../services/resumeScreeningService.js')
            .then(({ screenCandidateById }) => screenCandidateById(doc._id))
            .catch((err) => {
                import('../helpers/logger.js').then(({ default: logger }) => {
                    logger.warn('Auto resume screening failed', {
                        candidateId: doc._id,
                        error: err?.message,
                    });
                });
            });
    });
});

export const Recruitment = mongoose.model('Recruitment', recruitmentSchema);
export const Candidate = mongoose.model('Candidate', candidateSchema);
export const JobRequisition = mongoose.model('JobRequisition', jobRequisitionSchema);
