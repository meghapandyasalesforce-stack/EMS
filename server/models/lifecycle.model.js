import mongoose from 'mongoose';
import {
    lifecycleStageSchema,
    lifecycleReminderRuleSchema,
    lifecycleEscalationRuleSchema,
    lifecycleApprovalBindingSchema,
    lifecycleFormFieldSchema,
} from '../constants/lifecycleSharedSchemas.js';

/** Per-organization lifecycle configuration — single source of tenant config */
const lifecycleSettingsSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        unique: true,
        index: true,
    },
    modules: {
        onboarding: { enabled: { type: Boolean, default: true } },
        offboarding: { enabled: { type: Boolean, default: true } },
    },
    /** featureKey → enabled. Dotted keys are stored encoded (a::b) — see lifecycleConfigService. */
    enabledFeatures: {
        type: mongoose.Schema.Types.Mixed,
        default: () => ({}),
    },
    industryPacks: [{
        packKey: { type: String, required: true },
        enabled: { type: Boolean, default: false },
        installedAt: Date,
    }],
    compliancePacks: [{
        packKey: { type: String, required: true },
        enabled: { type: Boolean, default: false },
        installedAt: Date,
    }],
    defaults: {
        onboardingTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OnboardingTemplate' },
        offboardingTemplateId: { type: mongoose.Schema.Types.ObjectId, ref: 'OffboardingTemplate' },
    },
    /** Bridges legacy org.onboardingSettings */
    onboarding: {
        autoCreateOnEmployeeRegister: { type: Boolean, default: false },
        startWorkflowOnJoiningDate: { type: Boolean, default: true },
    },
    notifications: {
        email: { type: Boolean, default: true },
        inApp: { type: Boolean, default: true },
        push: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        whatsapp: { type: Boolean, default: false },
        teams: { type: Boolean, default: false },
        slack: { type: Boolean, default: false },
        webhook: { type: Boolean, default: false },
    },
    notificationEventChannels: { type: mongoose.Schema.Types.Mixed, default: () => ({}) },
    notificationWebhookUrl: String,
    itTicketingProvider: { type: String, default: 'manual' },
    lifecycleBranding: {
        logoUrl: String,
        primaryColor: String,
        secondaryColor: String,
        accentColor: String,
        emailFromName: String,
        emailFooterHtml: String,
        letterHeaderHtml: String,
        portalWelcomeMessage: String,
        customDomain: String,
    },
    reminders: [lifecycleReminderRuleSchema],
    escalations: [lifecycleEscalationRuleSchema],
    approvals: [lifecycleApprovalBindingSchema],
    documentOverrides: [{
        catalogKey: String,
        enabled: { type: Boolean, default: true },
        mandatory: Boolean,
        approvalRequired: Boolean,
        expiryDays: Number,
        renewalReminderDays: Number,
    }],
    noticePeriodPolicy: {
        enabled: { type: Boolean, default: true },
        defaultNoticeDays: { type: Number, default: 30 },
        probationNoticeDays: { type: Number, default: 15 },
        allowBuyout: { type: Boolean, default: false },
        maxBuyoutDays: { type: Number, default: 0 },
        allowLeaveAdjustment: { type: Boolean, default: true },
        reminderDaysBeforeLwd: { type: [Number], default: [7, 3, 1, 0] },
        escalationDaysAfterOverdue: { type: Number, default: 2 },
        gradePolicies: [{ grade: String, noticeDays: Number }],
        departmentPolicies: [{ department: String, noticeDays: Number }],
        employmentTypePolicies: [{ type: String, noticeDays: Number }],
        breachAlertDays: { type: Number, default: 3 },
    },
    fnfPolicy: {
        enabled: { type: Boolean, default: true },
        includeLeaveEncashment: { type: Boolean, default: true },
        includeBonus: { type: Boolean, default: true },
        includeGratuityEstimate: { type: Boolean, default: false },
        recoveryFromFinalPay: { type: Boolean, default: true },
        approvalRequired: { type: Boolean, default: true },
    },
    bgvPolicy: {
        vendor: { type: String, default: 'manual' },
        defaultChecks: [{ type: String }],
        blockJoiningUntilClear: { type: Boolean, default: false },
    },
    esignProvider: { type: String, default: 'internal' },
    lmsProvider: { type: String, default: 'internal' },
    accessRevocationPolicy: {
        autoRevokeOnLwd: { type: Boolean, default: false },
        providers: mongoose.Schema.Types.Mixed,
    },
    offerPolicy: {
        defaultExpiryDays: { type: Number, default: 7 },
    },
    exitInterviewPolicy: {
        enabled: { type: Boolean, default: true },
        mandatory: { type: Boolean, default: false },
        anonymousAllowed: { type: Boolean, default: true },
        autoSchedule: { type: Boolean, default: true },
        autoScheduleDaysBeforeLwd: { type: Number, default: 7 },
        approvalRequired: { type: Boolean, default: false },
        reminderDaysBefore: { type: [Number], default: [7, 3, 1] },
        feedbackAreas: {
            type: [String],
            default: () => [
                'Manager', 'Team', 'Work Culture', 'Salary', 'Benefits', 'Career Growth',
                'Workload', 'Leadership', 'Company Policies', 'Office Environment',
                'Technology', 'HR Experience', 'Training', 'Suggestions',
            ],
        },
    },
    /** Phase 2.6 — reporting & analytics configuration */
    reportingPolicy: {
        enabled: { type: Boolean, default: true },
        defaultDateRangeDays: { type: Number, default: 90 },
        enabledCategories: { type: [String], default: () => [] },
        allowScheduledReports: { type: Boolean, default: true },
        allowExport: { type: Boolean, default: true },
        retentionDays: { type: Number, default: 365 },
    },
}, { timestamps: true });

/** Custom form definitions — reusable across lifecycle modules */
const formVersionHistorySchema = new mongoose.Schema({
    version: { type: Number, required: true },
    snapshot: mongoose.Schema.Types.Mixed,
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    changedAt: { type: Date, default: Date.now },
    changeNotes: String,
}, { _id: false });

const formAssignmentSchema = new mongoose.Schema({
    stageKey: String,
    templateId: { type: mongoose.Schema.Types.ObjectId },
    templateType: { type: String, enum: ['onboarding', 'offboarding', null] },
    featureKey: String,
    departments: [String],
    employeeTypes: [String],
}, { _id: false });

const lifecycleFormDefinitionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    category: {
        type: String,
        enum: [
            'onboarding', 'offboarding', 'both', 'exit_interview', 'bgv',
            'notice_period', 'fnf', 'compliance', 'employee_profile', 'custom',
        ],
        default: 'onboarding',
        index: true,
    },
    /** @deprecated use category — kept for backward compatibility */
    module: {
        type: String,
        enum: ['onboarding', 'offboarding', 'both'],
        default: 'onboarding',
    },
    featureKey: String,
    stageKey: String,
    assignments: formAssignmentSchema,
    fields: [lifecycleFormFieldSchema],
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft',
        index: true,
    },
    publishedAt: Date,
    isActive: { type: Boolean, default: true },
    version: { type: Number, default: 1 },
    versionHistory: [formVersionHistorySchema],
    clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleFormDefinition' },
    approvalRequired: { type: Boolean, default: false },
    tags: [String],
}, { timestamps: true });

lifecycleFormDefinitionSchema.index({ organizationId: 1, name: 1 }, { unique: true });
lifecycleFormDefinitionSchema.index({ organizationId: 1, category: 1, status: 1 });

const lifecycleFormResponseSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    formDefinitionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'LifecycleFormDefinition',
        required: true,
        index: true,
    },
    formVersion: { type: Number, default: 1 },
    category: String,
    featureKey: String,
    stageKey: String,
    workflowId: { type: mongoose.Schema.Types.ObjectId },
    workflowType: { type: String, enum: ['onboarding', 'offboarding', null] },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee', index: true },
    candidateId: { type: mongoose.Schema.Types.ObjectId, ref: 'Candidate' },
    submittedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    status: {
        type: String,
        enum: ['Draft', 'Submitted', 'Pending Approval', 'Approved', 'Rejected'],
        default: 'Draft',
        index: true,
    },
    responses: mongoose.Schema.Types.Mixed,
    approvalInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalInstance' },
    attachments: [{
        fieldKey: String,
        fileName: String,
        fileUrl: String,
        mimeType: String,
        uploadedAt: { type: Date, default: Date.now },
    }],
    comments: [{
        text: String,
        author: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        createdAt: { type: Date, default: Date.now },
    }],
    activityFeed: [{
        action: String,
        description: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        createdAt: { type: Date, default: Date.now },
    }],
    submittedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    rejectionReason: String,
}, { timestamps: true });

lifecycleFormResponseSchema.index({ organizationId: 1, formDefinitionId: 1, employeeId: 1 });

/** Org-specific document catalog entries (override system defaults) */
const lifecycleDocumentCatalogEntrySchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    catalogKey: { type: String, required: true },
    label: String,
    hubCategory: {
        type: String,
        enum: ['Identity', 'Education', 'Experience', 'Address', 'Employment', 'Financial', 'Compliance', 'Medical', 'Assets', 'Custom'],
        default: 'Custom',
    },
    module: {
        type: String,
        enum: ['onboarding', 'offboarding', 'both'],
        default: 'onboarding',
    },
    featureKey: String,
    enabled: { type: Boolean, default: true },
    mandatory: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: false },
    expiryDays: Number,
    renewalReminderDays: Number,
    versioningEnabled: { type: Boolean, default: true },
    isCustom: { type: Boolean, default: false },
    tags: [String],
    assignments: {
        stageKey: String,
        templateId: { type: mongoose.Schema.Types.ObjectId },
        templateType: { type: String, enum: ['onboarding', 'offboarding', null] },
        featureKey: String,
        departments: [String],
        employeeTypes: [String],
    },
}, { timestamps: true });

lifecycleDocumentCatalogEntrySchema.index({ organizationId: 1, catalogKey: 1 }, { unique: true });

const exitInterviewTemplateSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    interviewType: {
        type: String,
        enum: ['employee_self', 'hr', 'manager', 'skip_level', 'leadership'],
        required: true,
        index: true,
    },
    formDefinitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleFormDefinition' },
    feedbackAreas: [String],
    mandatory: { type: Boolean, default: true },
    anonymousAllowed: { type: Boolean, default: false },
    approvalRequired: { type: Boolean, default: false },
    autoScheduleDaysBeforeLwd: { type: Number, default: 7 },
    assignments: {
        departments: [String],
        employeeTypes: [String],
        resignationReasons: [String],
        terminationTypes: [String],
        stageKey: { type: String, default: 'exit_interview' },
        featureKey: { type: String, default: 'exitInterview' },
    },
    status: {
        type: String,
        enum: ['Draft', 'Published', 'Archived'],
        default: 'Draft',
    },
    version: { type: Number, default: 1 },
    versionHistory: [formVersionHistorySchema],
    clonedFrom: { type: mongoose.Schema.Types.ObjectId, ref: 'ExitInterviewTemplate' },
    publishedAt: Date,
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

exitInterviewTemplateSchema.index({ organizationId: 1, status: 1, interviewType: 1 });

const exitInterviewActionItemSchema = new mongoose.Schema({
    title: { type: String, required: true },
    description: String,
    assignedTo: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    dueDate: Date,
    status: {
        type: String,
        enum: ['Open', 'In Progress', 'Completed', 'Cancelled'],
        default: 'Open',
    },
    completedAt: Date,
    completedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { _id: true });

const exitInterviewSessionSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    offboardingWorkflowId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'OffboardingWorkflow',
        index: true,
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee',
        required: true,
        index: true,
    },
    templateId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExitInterviewTemplate' },
    formDefinitionId: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleFormDefinition' },
    formResponseId: { type: mongoose.Schema.Types.ObjectId, ref: 'LifecycleFormResponse' },
    formVersion: Number,
    interviewType: {
        type: String,
        enum: ['employee_self', 'hr', 'manager', 'skip_level', 'leadership'],
        required: true,
    },
    conductorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
    scheduledDate: Date,
    conductedDate: Date,
    status: {
        type: String,
        enum: ['Draft', 'Scheduled', 'In Progress', 'Submitted', 'Pending Approval', 'Approved', 'Closed', 'Cancelled', 'Overdue'],
        default: 'Draft',
    },
    anonymous: { type: Boolean, default: false },
    responses: mongoose.Schema.Types.Mixed,
    rating: { type: Number, min: 1, max: 5 },
    feedback: String,
    rehireEligible: { type: Boolean, default: null },
    managerComments: String,
    improvementRecommendations: String,
    attachmentDocumentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Document' }],
    actionItems: [exitInterviewActionItemSchema],
    approvalInstanceId: { type: mongoose.Schema.Types.ObjectId, ref: 'ApprovalWorkflowInstance' },
    activityFeed: [{
        action: String,
        description: String,
        actor: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        createdAt: { type: Date, default: Date.now },
    }],
    calendarEventId: String,
}, { timestamps: true });

exitInterviewSessionSchema.index({ organizationId: 1, employeeId: 1, status: 1 });
exitInterviewSessionSchema.index({ organizationId: 1, offboardingWorkflowId: 1 });

/** Phase 2.6 — scheduled lifecycle report definitions */
const lifecycleScheduledReportSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true,
    },
    name: { type: String, required: true, trim: true },
    description: String,
    categories: [{ type: String, required: true }],
    filters: {
        department: String,
        location: String,
        designation: String,
        managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
        dateRangeDays: { type: Number, default: 90 },
    },
    format: {
        type: String,
        enum: ['csv', 'excel', 'pdf'],
        default: 'csv',
    },
    frequency: {
        type: String,
        enum: ['daily', 'weekly', 'monthly', 'custom'],
        default: 'weekly',
    },
    cronExpression: String,
    recipientEmployeeIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Employee' }],
    recipientEmails: [String],
    enabled: { type: Boolean, default: true },
    lastRunAt: Date,
    nextRunAt: Date,
    lastRunStatus: {
        type: String,
        enum: ['Success', 'Failed', 'Skipped'],
    },
    lastRunError: String,
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Employee' },
}, { timestamps: true });

lifecycleScheduledReportSchema.index({ organizationId: 1, enabled: 1, nextRunAt: 1 });

export const LifecycleSettings = mongoose.model('LifecycleSettings', lifecycleSettingsSchema);
export const LifecycleFormDefinition = mongoose.model('LifecycleFormDefinition', lifecycleFormDefinitionSchema);
export const LifecycleFormResponse = mongoose.model('LifecycleFormResponse', lifecycleFormResponseSchema);
export const LifecycleDocumentCatalogEntry = mongoose.model('LifecycleDocumentCatalogEntry', lifecycleDocumentCatalogEntrySchema);
export const ExitInterviewTemplate = mongoose.model('ExitInterviewTemplate', exitInterviewTemplateSchema);
export const ExitInterviewSession = mongoose.model('ExitInterviewSession', exitInterviewSessionSchema);
export const LifecycleScheduledReport = mongoose.model('LifecycleScheduledReport', lifecycleScheduledReportSchema);

export {
    lifecycleStageSchema,
    lifecycleReminderRuleSchema,
    lifecycleEscalationRuleSchema,
    lifecycleApprovalBindingSchema,
    lifecycleFormFieldSchema,
};
