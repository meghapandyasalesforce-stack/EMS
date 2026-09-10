import mongoose from 'mongoose';

const celebrationNotificationLogSchema = new mongoose.Schema({
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
    index: true,
  },
  eventKey: {
    type: String,
    required: true,
  },
  employeeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
  },
  notificationKind: {
    type: String,
    enum: [
      'birthday_upcoming',
      'birthday_today',
      'anniversary_upcoming',
      'anniversary_today',
      'birthday_wish',
      'anniversary_wish',
      'marriage_anniversary_upcoming',
      'marriage_anniversary_today',
      'marriage_anniversary_wish',
    ],
    required: true,
  },
  year: {
    type: Number,
    required: true,
  },
  celebrationEventId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'CelebrationEvent',
  },
  processedAt: {
    type: Date,
    default: Date.now,
  },
}, {
  timestamps: true,
});

celebrationNotificationLogSchema.index({ organizationId: 1, eventKey: 1 }, { unique: true });

export const CelebrationNotificationLog = mongoose.model(
  'CelebrationNotificationLog',
  celebrationNotificationLogSchema
);
export default CelebrationNotificationLog;
