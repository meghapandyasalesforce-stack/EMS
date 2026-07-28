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
      'onboarding'
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
  isRead: {
    type: Boolean,
    default: false
  },
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

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;