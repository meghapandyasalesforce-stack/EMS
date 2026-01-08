/**
 * Attendance Rule Audit Trail Model
 * Tracks all changes to attendance rules for compliance and dispute resolution
 */

import mongoose from "mongoose";

const attendanceRuleAuditSchema = new mongoose.Schema({
    organizationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Organization',
        required: true,
        index: true
    },
    ruleId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'AttendanceRule',
        required: true,
        index: true
    },
    action: {
        type: String,
        enum: ['created', 'updated', 'deactivated', 'activated', 'deleted'],
        required: true
    },
    changedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    changedByRole: {
        type: String,
        enum: ['admin', 'hr', 'executive'],
        required: true
    },
    // Store full rule snapshot before change
    previousState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Store full rule snapshot after change
    newState: {
        type: mongoose.Schema.Types.Mixed,
        default: null
    },
    // Track specific field changes
    fieldChanges: [{
        field: String,
        oldValue: mongoose.Schema.Types.Mixed,
        newValue: mongoose.Schema.Types.Mixed
    }],
    // Reason for change
    changeReason: {
        type: String,
        trim: true
    },
    // IP address of changer
    ipAddress: {
        type: String
    },
    // User agent
    userAgent: {
        type: String
    },
    // Metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, {
    timestamps: true
});

// Indexes for efficient queries
attendanceRuleAuditSchema.index({ organizationId: 1, createdAt: -1 });
attendanceRuleAuditSchema.index({ ruleId: 1, createdAt: -1 });
attendanceRuleAuditSchema.index({ changedBy: 1, createdAt: -1 });
attendanceRuleAuditSchema.index({ action: 1, createdAt: -1 });

// TTL index for data retention (default: 7 years for compliance)
// Can be configured via environment variable
const retentionDays = parseInt(process.env.ATTENDANCE_AUDIT_RETENTION_DAYS || '2555'); // 7 years
if (retentionDays > 0) {
    attendanceRuleAuditSchema.index(
        { createdAt: 1 },
        { expireAfterSeconds: retentionDays * 24 * 60 * 60 }
    );
}

const AttendanceRuleAudit = mongoose.model("AttendanceRuleAudit", attendanceRuleAuditSchema, "attendanceRuleAudits");

export default AttendanceRuleAudit;

