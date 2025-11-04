import mongoose from 'mongoose';

const notificationSettingsSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  emailNotifications: {
    type: Boolean,
    default: true
  },
  taskNotifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    taskCreated: {
      type: Boolean,
      default: true
    },
    taskUpdated: {
      type: Boolean,
      default: true
    },
    taskCompleted: {
      type: Boolean,
      default: true
    },
    notifyAdmins: {
      type: Boolean,
      default: true
    },
    notifyManagers: {
      type: Boolean,
      default: true
    },
    notifyProjectManagers: {
      type: Boolean,
      default: true
    }
  },
  generalNotifications: {
    enabled: {
      type: Boolean,
      default: true
    },
    systemUpdates: {
      type: Boolean,
      default: true
    },
    announcements: {
      type: Boolean,
      default: true
    }
  },
  pushNotifications: {
    type: Boolean,
    default: true
  },
  frequency: {
    type: String,
    enum: ['immediate', 'hourly', 'daily', 'weekly'],
    default: 'immediate'
  }
}, { timestamps: true });

// Ensure one settings document per user
notificationSettingsSchema.index({ user: 1 }, { unique: true });

const NotificationSettings = mongoose.model('NotificationSettings', notificationSettingsSchema);

export default NotificationSettings;
