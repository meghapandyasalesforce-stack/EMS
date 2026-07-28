/**
 * Phase 1 lifecycle gap models — offer letters, BGV, letter templates.
 * Extends existing lifecycle architecture without duplicating document/approval models.
 */

import mongoose from 'mongoose';

const versionHistorySchema = new mongoose.Schema({
    version: { type: Number, required: true },
    bodyHtml: String,
    pdfUrl: String,
    pdfFileName: String,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    changedAt: { type: Date, default: Date.now },
    changeNotes: String,
}, { _id: false });

export const OFFER_PLACEHOLDERS = Object.freeze([
    '{{candidateName}}', '{{candidateEmail}}', '{{position}}', '{{department}}',
    '{{salary}}', '{{salaryWords}}', '{{startDate}}', '{{companyName}}',
    '{{reportingManager}}', '{{location}}', '{{benefits}}', '{{offerExpiryDate}}',
    '{{currentDate}}',
]);

const offerLetterTemplateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    bodyHtml: { type: String, required: true },
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    versionHistory: [versionHistorySchema],
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

offerLetterTemplateSchema.index({ organizationId: 1, isDefault: 1 });

const offerLetterSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    candidateId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Candidate',
        required: true,
        index: true,
    },
    jobPostingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Recruitment' },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OfferLetterTemplate' },
    templateVersion: { type: Number, default: 1 },
    version: { type: Number, default: 1 },
    versionHistory: [versionHistorySchema],
    position: String,
    department: String,
    salary: Number,
    currency: { type: String, default: 'INR' },
    benefits: [String],
    startDate: Date,
    expiryDate: Date,
    bodyHtml: String,
    pdfUrl: String,
    pdfFileName: String,
    status: {
        type: String,
        enum: ['Draft', 'PendingApproval', 'Approved', 'Sent', 'Viewed', 'Accepted', 'Declined', 'Expired', 'Cancelled'],
        default: 'Draft',
        index: true,
    },
    approvalInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalInstance' },
    portalToken: { type: String, sparse: true, index: true },
    portalTokenExpiresAt: Date,
    sentAt: Date,
    viewedAt: Date,
    respondedAt: Date,
    responseNotes: String,
    signature: {
        type: { type: String, enum: ['acknowledgment', 'drawn', 'typed', 'vendor'], default: 'acknowledgment' },
        data: String,
        signedAt: Date,
        ipAddress: String,
        vendorRef: String,
    },
    esignProvider: { type: String, default: 'internal' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    activityFeed: [{
        action: String,
        description: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

offerLetterSchema.index({ organizationId: 1, candidateId: 1, version: -1 });

const bgvCheckSchema = new mongoose.Schema({
    checkType: {
        type: String,
        enum: ['employment', 'education', 'address', 'reference', 'criminal', 'identity', 'other'],
        required: true,
    },
    label: String,
    status: {
        type: String,
        enum: [
            'Not Started',
            'Pending Employee Submission',
            'Draft Saved',
            'Submitted',
            'Under HR Review',
            'Additional Information Required',
            'Resubmitted',
            'Verification In Progress',
            'Verified',
            'Rejected',
            'Initiated',
            'In Progress',
            'Clear',
            'Discrepancy',
            'Failed',
            'Waived',
            'Information Requested',
            'Pending Review'
        ],
        default: 'Not Started',
    },
    mandatory: { type: Boolean, default: true },
    vendorRef: String,
    resultSummary: String,
    resultDocumentUrl: String,
    initiatedAt: Date,
    completedAt: Date,
    notes: String,
    // Employee submission fields
    documents: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        url: String,
        name: String,
        type: String,
        uploadedAt: { type: Date, default: Date.now },
        uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        ocrStatus: { type: String, enum: ['Pending', 'Processed', 'Failed'], default: 'Pending' },
        ocrData: mongoose.Schema.Types.Mixed,
        ocrProcessedAt: Date,
        matchStatus: { type: String, enum: ['Pending', 'Matched', 'Not Matched'], default: 'Pending' },
        matchScore: Number,
        matchProcessedAt: Date,
    }],
    submittedAt: Date,
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    employeeNotes: String,
    // HR review fields
    hrNotes: String,
    verifiedAt: Date,
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedVerifier: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    // Information request fields
    infoRequest: String,
    infoRequestedAt: Date,
    infoRequestedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    infoResponse: String,
    infoRespondedAt: Date,
    infoRespondedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    // Internal notes (HR only)
    internalNotes: [{
        content: String,
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        addedByName: String,
        addedAt: { type: Date, default: Date.now },
    }],
    // Verification data specific to check type
    verificationData: mongoose.Schema.Types.Mixed,
    // Reference check specific
    references: [{
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        name: String,
        company: String,
        designation: String,
        relationship: String,
        phone: String,
        email: String,
        addedAt: { type: Date, default: Date.now },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        contactStatus: { type: String, enum: ['Pending', 'Contacted', 'Verified', 'Rejected'], default: 'Pending' },
        contactNotes: String,
        contactUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        contactUpdatedAt: Date,
        updatedAt: Date,
        updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    }],
    // Criminal verification specific
    declarationAccepted: { type: Boolean, default: false },
    declarationAcceptedAt: Date,
    declarationAcceptedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    // Timeline tracking
    lastUpdated: Date,
}, { _id: true });

const backgroundVerificationCaseSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    subjectType: {
        type: String,
        enum: ['candidate', 'employee'],
        default: 'employee',
    },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    onboardingWorkflowId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingWorkflow' },
    vendor: { type: String, default: 'manual' },
    vendorCaseId: String,
    overallStatus: {
        type: String,
        enum: [
            'Not Started',
            'In Progress',
            'Partially Clear',
            'Clear',
            'Failed',
            'Waived',
            'Pending Employee Submission',
            'Submitted',
            'Under HR Review',
            'Verification In Progress'
        ],
        default: 'Not Started',
        index: true,
    },
    checks: [bgvCheckSchema],
    initiatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    assignedHr: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    dueDate: Date,
    priority: { type: String, enum: ['Low', 'Normal', 'High', 'Critical'], default: 'Normal' },
    completedAt: Date,
    // Timeline tracking
    timeline: [{
        milestone: String,
        timestamp: { type: Date, default: Date.now },
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        actorName: String,
    }],
    // SLA tracking
    slaBreached: { type: Boolean, default: false },
    slaBreachedAt: Date,
    // Approval workflow
    approvalId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalInstance' },
    approvalStatus: { type: String, enum: ['Pending', 'Approved', 'Rejected'], default: 'Pending' },
    // Waiver
    waivedAt: Date,
    waivedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    waiverReason: String,
    activityFeed: [{
        action: String,
        description: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        actorName: String,
        metadata: mongoose.Schema.Types.Mixed,
        createdAt: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

backgroundVerificationCaseSchema.index({ organizationId: 1, employeeId: 1 });
backgroundVerificationCaseSchema.index({ organizationId: 1, candidateId: 1 });

const lifecycleLetterTemplateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    letterType: {
        type: String,
        required: true,
        index: true,
    },
    category: {
        type: String,
        enum: ['onboarding', 'employment', 'offboarding', 'compliance', 'custom'],
        default: 'employment',
    },
    name: { type: String, required: true, trim: true },
    description: String,
    bodyHtml: { type: String, required: true },
    headerHtml: String,
    footerHtml: String,
    customPlaceholders: [{
        key: String,
        label: String,
        defaultValue: String,
    }],
    workflowTriggers: [{
        event: String,
        featureKey: String,
        stageKey: String,
        enabled: { type: Boolean, default: true },
    }],
    featureKey: String,
    watermarkText: String,
    includeSignatureBlock: { type: Boolean, default: true },
    includeQrPlaceholder: { type: Boolean, default: false },
    includePageNumbers: { type: Boolean, default: true },
    passwordProtected: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: false },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft',
    },
    version: { type: Number, default: 1 },
    versionHistory: [versionHistorySchema],
    clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleLetterTemplate' },
    publishedAt: Date,
    isDefault: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

lifecycleLetterTemplateSchema.index({ organizationId: 1, letterType: 1, status: 1 });

const lifecycleGeneratedLetterSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleLetterTemplate' },
    templateVersion: Number,
    letterType: { type: String, required: true, index: true },
    category: String,
    title: String,
    bodyHtml: String,
    renderedHtml: String,
    pdfUrl: String,
    pdfFileName: String,
    documentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Document' },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    workflowId: { type: mongoose.Schema.Types.ObjectId },
    workflowType: { type: String, enum: ['onboarding', 'offboarding', 'recruitment', null] },
    status: {
        type: String,
        enum: ['Draft', 'PendingApproval', 'Approved', 'Rejected', 'Published', 'Sent', 'Viewed', 'Acknowledged', 'Expired', 'Cancelled'],
        default: 'Draft',
        index: true,
    },
    approvalInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalInstance' },
    sentAt: Date,
    viewedAt: Date,
    acknowledgedAt: Date,
    deliveryStatus: {
        type: String,
        enum: ['Pending', 'Delivered', 'Failed', 'Bounced'],
        default: 'Pending',
    },
    placeholderSnapshot: mongoose.Schema.Types.Mixed,
    version: { type: Number, default: 1 },
    versionHistory: [versionHistorySchema],
    bulkBatchId: String,
    triggerEvent: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    activityFeed: [{
        action: String,
        description: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        createdAt: { type: Date, default: Date.now },
    }],
}, { timestamps: true });

lifecycleGeneratedLetterSchema.index({ organizationId: 1, employeeId: 1, letterType: 1 });
lifecycleGeneratedLetterSchema.index({ organizationId: 1, status: 1, createdAt: -1 });

export const LIFECYCLE_LETTER_TYPES = Object.freeze({
    onboarding: ['offer_letter', 'appointment_letter', 'joining_letter', 'internship_letter', 'nda', 'confidentiality_agreement', 'it_policy_ack'],
    employment: ['employment_verification', 'salary_certificate', 'bonafide_certificate', 'promotion_letter', 'transfer_letter', 'increment_letter', 'confirmation_letter'],
    offboarding: ['experience_letter', 'relieving_letter', 'service_certificate', 'resignation_acceptance', 'termination_letter', 'retirement_letter', 'no_due_certificate', 'exit_acknowledgement'],
    compliance: ['compliance_letter', 'custom'],
});

export const LIFECYCLE_LETTER_PLACEHOLDERS = Object.freeze([
    '{{employeeName}}', '{{employeeId}}', '{{employeeEmail}}', '{{department}}', '{{designation}}',
    '{{managerName}}', '{{companyName}}', '{{companyAddress}}', '{{joiningDate}}', '{{exitDate}}',
    '{{lastWorkingDate}}', '{{noticePeriodDays}}', '{{salary}}', '{{salaryWords}}', '{{currentDate}}',
    '{{position}}', '{{location}}', '{{fnfAmount}}', '{{assetsList}}', '{{workflowStage}}',
    '{{signatureBlock}}', '{{qrCode}}', '{{pageNumber}}', '{{logo}}',
]);

export const OfferLetterTemplate = mongoose.model('OfferLetterTemplate', offerLetterTemplateSchema);
export const OfferLetter = mongoose.model('OfferLetter', offerLetterSchema);
export const BackgroundVerificationCase = mongoose.model('BackgroundVerificationCase', backgroundVerificationCaseSchema);
export const LifecycleLetterTemplate = mongoose.model('LifecycleLetterTemplate', lifecycleLetterTemplateSchema);
export const LifecycleGeneratedLetter = mongoose.model('LifecycleGeneratedLetter', lifecycleGeneratedLetterSchema);

export { bgvCheckSchema, versionHistorySchema };
