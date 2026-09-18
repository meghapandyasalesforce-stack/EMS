import mongoose from 'mongoose';

/**
 * Cross-tenant audit trail for SaaS platform control-panel actions.
 * organizationId is optional (e.g. plan catalog edits, operator management).
 */
const platformAuditLogSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Organization',
      index: true,
      default: null,
    },
    operatorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    operatorEmail: {
      type: String,
      trim: true,
      lowercase: true,
    },
    action: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    entityType: {
      type: String,
      required: true,
      enum: ['Organization', 'SubscriptionPlan', 'User', 'PlatformOperator', 'Other'],
      default: 'Organization',
    },
    entityId: {
      type: mongoose.Schema.Types.ObjectId,
    },
    summary: {
      type: String,
      trim: true,
    },
    before: mongoose.Schema.Types.Mixed,
    after: mongoose.Schema.Types.Mixed,
    ipAddress: String,
    userAgent: String,
  },
  { timestamps: true }
);

platformAuditLogSchema.index({ createdAt: -1 });
platformAuditLogSchema.index({ organizationId: 1, createdAt: -1 });

const PlatformAuditLog = mongoose.model('PlatformAuditLog', platformAuditLogSchema, 'platform_audit_logs');

export default PlatformAuditLog;
