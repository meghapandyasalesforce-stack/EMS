import mongoose from "mongoose";

const documentSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: String,
    category: {
        type: String,
        enum: ['Employee', 'Company', 'Policy', 'Contract', 'Certificate', 
               'Training', 'Compliance', 'Financial', 'Legal', 'Other'],
        required: true
    },
    type: {
        type: String,
        enum: ['PDF', 'Word', 'Excel', 'Image', 'Video', 'Other'],
        required: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileName: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number, // in bytes
        required: true
    },
    mimeType: String,
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    relatedTo: {
        type: String,
        enum: ['Employee', 'Department', 'Project', 'Policy', 'Course', 'General'],
        default: 'General'
    },
    relatedId: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: 'relatedToModel'
    },
    relatedToModel: {
        type: String,
        enum: ['Employee', 'Department', 'Project', 'CompanyPolicy', 'Course', null]
    },
    accessLevel: {
        type: String,
        enum: ['Public', 'Department', 'Role', 'Specific', 'Private'],
        default: 'Private'
    },
    allowedDepartments: [String],
    allowedRoles: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Role'
    }],
    allowedEmployees: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    }],
    version: {
        type: Number,
        default: 1
    },
    previousVersions: [{
        fileUrl: String,
        fileName: String,
        version: Number,
        uploadedAt: Date,
        uploadedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Employee'
        },
        fileSize: Number,
        mimeType: String,
        comments: String,
        rejectionReason: String,
    }],
    tags: [String],
    expiryDate: Date,
    requiresAcknowledgment: {
        type: Boolean,
        default: false
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // HR Approval fields for employee-uploaded documents
    approvalStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Withdrawn'],
        default: 'Pending'
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    approvedAt: Date,
    rejectionReason: String,
    requiresApproval: {
        type: Boolean,
        default: false // Set to true for employee-uploaded documents
    },
    downloadCount: {
        type: Number,
        default: 0
    },
    lastAccessedAt: Date,
    metadata: {
        author: String,
        keywords: [String],
        language: String,
        /** Human-facing ID from job upload (PAN, Aadhar, etc.) */
        documentNumber: String,
        additionalInfo: mongoose.Schema.Types.Mixed,
    },
    /** Job-details / onboarding uploads (Offer letter, degree, etc.) — single active row per type per employee */
    employeeJobDocumentType: {
        type: String,
        enum: ['OFFER_LETTER', 'AADHAR_CARD', 'PAN_CARD', 'GUARANTOR_FORM', 'DEGREE_CERTIFICATE', 'OTHER'],
        required: false
    },
    /** Lifecycle document hub — links to LIFECYCLE_DOCUMENT_CATALOG */
    catalogKey: {
        type: String,
        index: true,
    },
    hubCategory: {
        type: String,
        enum: ['Identity', 'Education', 'Experience', 'Address', 'Employment', 'Financial', 'Compliance', 'Medical', 'Assets', 'Custom', null],
    },
    verificationStatus: {
        type: String,
        enum: ['Pending', 'Approved', 'Rejected', 'Expired', 'Renewal Pending'],
        default: 'Pending',
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
    },
    verifiedAt: Date,
    verificationRemarks: String,
    renewalReminderSentAt: Date,
    expiryReminderSentAt: Date,
    workflowAssignment: {
        workflowId: { type: mongoose.Schema.Types.ObjectId },
        workflowType: { type: String, enum: ['onboarding', 'offboarding', null] },
        stageKey: String,
        featureKey: String,
        templateId: { type: mongoose.Schema.Types.ObjectId },
        departments: [String],
        employeeTypes: [String],
    },
    verificationHistory: [{
        status: String,
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        verifiedAt: { type: Date, default: Date.now },
        remarks: String,
        comments: String,
    }],
    /** OCR-ready metadata — provider integration deferred to future phase */
    ocrMetadata: {
        provider: { type: String, enum: ['google_vision', 'azure_ocr', 'aws_textract', 'manual', null], default: null },
        status: { type: String, enum: ['pending', 'processed', 'failed', 'skipped', null], default: null },
        jobId: String,
        processedAt: Date,
        extractedFields: mongoose.Schema.Types.Mixed,
        confidence: Number,
    },
}, {
    timestamps: true
});

const documentRequestSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true
    },
    documentType: {
        type: String,
        enum: ['Pay Slip', 'Tax Document', 'Employment Letter', 'Experience Certificate', 
               'Salary Certificate', 'NOC', 'Other'],
        required: true
    },
    description: String,
    status: {
        type: String,
        enum: ['Pending', 'In Progress', 'Ready', 'Delivered', 'Rejected'],
        default: 'Pending'
    },
    priority: {
        type: String,
        enum: ['Low', 'Medium', 'High', 'Urgent'],
        default: 'Medium'
    },
    requestedDate: {
        type: Date,
        default: Date.now
    },
    requiredBy: Date,
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document'
    },
    deliveredAt: Date,
    notes: String
}, {
    timestamps: true
});

// Indexes
documentSchema.index({ organizationId: 1, category: 1 });
documentSchema.index({ organizationId: 1, relatedTo: 1, relatedId: 1 });
documentSchema.index({ organizationId: 1, expiryDate: 1 });
documentSchema.index({ organizationId: 1, catalogKey: 1 });
documentSchema.index({ organizationId: 1, hubCategory: 1 });
documentSchema.index({ organizationId: 1, verificationStatus: 1 });
documentSchema.index({ organizationId: 1, 'workflowAssignment.stageKey': 1 });
documentRequestSchema.index({ organizationId: 1, requestedBy: 1, status: 1 });
documentRequestSchema.index({ organizationId: 1, status: 1 });

export const Document = mongoose.model('Document', documentSchema);
export const DocumentRequest = mongoose.model('DocumentRequest', documentRequestSchema);

