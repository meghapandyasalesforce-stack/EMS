import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  // Organization reference (multi-tenancy)
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true
  },
  recipient: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'recipientType',
    required: false // Now optional
  },
  recipientType: {
    type: String,
    enum: ['User', 'Employee'],
    default: 'User'
  },
  sender: { 
    type: mongoose.Schema.Types.ObjectId, 
    refPath: 'senderType',
    required: false
  },
  senderType: {
    type: String,
    enum: ['User', 'Employee'],
    default: 'User'
  },
  message: { 
    type: String, 
    required: true 
  },
  type: {
    type: String,
    enum: [
      'task_update',
      'task_created',
      'task_assigned',
      'task_completed',
      'general',
      'system',
      'break',
      'announcement',
      'leave_request',
      'leave_manager_approved',
      'leave_approved',
      'leave_rejected',
      'leave',
      'approval_request',
      'approval_approved',
      'approval_rejected',
      'attendance',
      'attendance_penalty',
      'attendance_error',
      'new_employee',
      'special_event',
      'payroll',
      'holiday',
      'birthday',
      'anniversary',
      'marriage_anniversary',
      'celebration_birthday_upcoming',
      'celebration_birthday_today',
      'celebration_birthday_wish',
      'celebration_anniversary_upcoming',
      'celebration_anniversary_today',
      'celebration_anniversary_wish',
      'celebration_marriage_anniversary_upcoming',
      'celebration_marriage_anniversary_today',
      'celebration_marriage_anniversary_wish',
      'onboarding',
      'engagement',
      'document_request'
    ],
    default: 'general'
  },
  relatedEntity: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'relatedEntityType'
  },
  relatedEntityType: {
    type: String,
    enum: ['Task', 'Project', 'Employee']
  },
  isBroadcast: {
    type: Boolean,
    default: false
  },
  /** draft / scheduled = not delivered yet; sent = live broadcast */
  broadcastStatus: {
    type: String,
    enum: ['draft', 'scheduled', 'sent'],
    default: 'sent',
    index: true,
  },
  /** When broadcastStatus is scheduled, deliver at this time (UTC). */
  scheduledFor: {
    type: Date,
    default: null,
    index: true,
  },
  isRead: {
    type: Boolean,
    default: false
  },
  // Per-user read state for shared broadcasts (never flip shared isRead for everyone)
  readReceipts: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userType: {
      type: String,
      enum: ['User', 'Employee'],
      default: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // Per-user hide for broadcasts — does not delete the shared document
  hiddenBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true
    },
    userType: {
      type: String,
      enum: ['User', 'Employee'],
      default: 'User'
    },
    hiddenAt: {
      type: Date,
      default: Date.now
    }
  }],
  priority: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
},{ timestamps: true });

// Index for efficient queries
notificationSchema.index({ recipient: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ isBroadcast: 1, createdAt: -1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ 'readReceipts.userId': 1 });
notificationSchema.index({ 'hiddenBy.userId': 1 });

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;