import NotificationSettings from '../../models/notificationSettings.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';

// Get notification settings for current user
export const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    
    let settings = await NotificationSettings.findOne({ user: userId });
    
    // Create default settings if none exist
    if (!settings) {
      settings = await NotificationSettings.create({
        user: userId,
        emailNotifications: true,
        taskNotifications: {
          enabled: true,
          taskCreated: true,
          taskUpdated: true,
          taskCompleted: true,
          notifyAdmins: true,
          notifyManagers: true,
          notifyProjectManagers: true
        },
        generalNotifications: {
          enabled: true,
          systemUpdates: true,
          announcements: true
        },
        pushNotifications: true,
        frequency: 'immediate'
      });
    }

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Update notification settings
export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    const updates = req.body;

    // Remove user field from updates to prevent unauthorized changes
    delete updates.user;

    const settings = await NotificationSettings.findOneAndUpdate(
      { user: userId },
      { $set: updates },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Reset notification settings to default
export const resetNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;

    const defaultSettings = {
      user: userId,
      emailNotifications: true,
      taskNotifications: {
        enabled: true,
        taskCreated: true,
        taskUpdated: true,
        taskCompleted: true,
        notifyAdmins: true,
        notifyManagers: true,
        notifyProjectManagers: true
      },
      generalNotifications: {
        enabled: true,
        systemUpdates: true,
        announcements: true
      },
      pushNotifications: true,
      frequency: 'immediate'
    };

    const settings = await NotificationSettings.findOneAndUpdate(
      { user: userId },
      defaultSettings,
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Notification settings reset to default',
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

// Get notification settings for all users (admin only)
export const getAllNotificationSettings = async (req, res) => {
  try {
    const settings = await NotificationSettings.find()
      .populate('user', 'name email role')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
