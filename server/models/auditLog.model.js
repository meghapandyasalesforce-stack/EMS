import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema({
    // Organization reference (multi-tenancy)
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Employee'
    },
    action: {
        type: String,
        required: true,
        enum: [
            'Create', 'Read', 'Update', 'Delete', 'Login', 'Logout',
            'Export', 'Import', 'Approve', 'Reject', 'Download', 'Upload'
        ]
    },
    entityType: {
        type: String,
        required: true,
        enum: [
            'Employee', 'Payroll', 'Leave', 'Attendance', 'Project',
            'Task', 'Expense', 'Performance Review', 'Goal', 'Report',
            'User', 'Organization', 'Document', 'Notification', 'Other',
            'Onboarding', 'Offboarding', 'LifecycleSettings', 'LifecycleTemplate',
            'LifecycleForm', 'Offer', 'Clearance', 'Exit Interview', 'F&F', 'Asset Return',
        ]
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId
    },
    entityName: {
        type: String
    },
    // Changes tracking
    changes: {
        before: mongoose.Schema.Types.Mixed,
        after: mongoose.Schema.Types.Mixed,
        fields: [String]
    },
    // Request details
    ipAddress: {
        type: String
    },
    userAgent: {
        type: String
    },
    requestMethod: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']
    },
    requestPath: {
        type: String
    },
    // Result
    status: {
        type: String,
        enum: ['Success', 'Failed', 'Error'],
        default: 'Success'
    },
    errorMessage: {
        type: String
    },
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed
    }
}, {
    timestamps: true
});

// Indexes for efficient querying
auditLogSchema.index({ organizationId: 1, createdAt: -1 });
auditLogSchema.index({ userId: 1, createdAt: -1 });
auditLogSchema.index({ employeeId: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ status: 1 });

// TTL index to auto-delete logs older than 2 years (optional)
// auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 63072000 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema, "auditlogs");
export default AuditLog;

