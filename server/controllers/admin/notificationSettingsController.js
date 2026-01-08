import NotificationSettings from '../../models/notificationSettings.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import { getOrganizationId, addOrganizationFilter } from '../../helpers/organizationHelper.js';
import logger from '../../helpers/logger.js';

// Get notification settings for current user
export const getNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get organizationId from request
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }

    // Find settings with organizationId filter
    const query = addOrganizationFilter(req, { user: userId });
    let settings = await NotificationSettings.findOne(query);
    
    // Create default settings if none exist
    if (!settings) {
      settings = await NotificationSettings.create({
        organizationId: organizationId,
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
    logger.error('Get notification settings error', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?._id || req.employee?._id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get notification settings',
      error: error.message
    });
  }
};

// Update notification settings
export const updateNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get organizationId from request
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }

    const updates = req.body;

    // Remove user and organizationId fields from updates to prevent unauthorized changes
    delete updates.user;
    delete updates.organizationId;

    // Find and update with organizationId filter
    const query = addOrganizationFilter(req, { user: userId });
    const settings = await NotificationSettings.findOneAndUpdate(
      query,
      { 
        $set: { ...updates, organizationId: organizationId }
      },
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Notification settings updated successfully',
      settings
    });
  } catch (error) {
    logger.error('Update notification settings error', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?._id || req.employee?._id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to update notification settings',
      error: error.message
    });
  }
};

// Reset notification settings to default
export const resetNotificationSettings = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    // Get organizationId from request
    const organizationId = getOrganizationId(req);
    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'Organization ID is required',
        code: 'MISSING_ORGANIZATION_ID'
      });
    }

    const defaultSettings = {
      organizationId: organizationId,
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

    // Find and update with organizationId filter
    const query = addOrganizationFilter(req, { user: userId });
    const settings = await NotificationSettings.findOneAndUpdate(
      query,
      defaultSettings,
      { new: true, upsert: true }
    );

    res.json({
      success: true,
      message: 'Notification settings reset to default',
      settings
    });
  } catch (error) {
    logger.error('Reset notification settings error', { 
      error: error.message, 
      stack: error.stack,
      userId: req.user?._id || req.employee?._id
    });
    res.status(500).json({
      success: false,
      message: 'Failed to reset notification settings',
      error: error.message
    });
  }
};

// Get notification settings for all users (admin only)
export const getAllNotificationSettings = async (req, res) => {
  try {
    // Filter by organizationId for multi-tenancy
    const query = addOrganizationFilter(req);
    const settings = await NotificationSettings.find(query)
      .populate('user', 'name email role')
      .sort({ updatedAt: -1 });

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    logger.error('Get all notification settings error', { 
      error: error.message, 
      stack: error.stack
    });
    res.status(500).json({
      success: false,
      message: 'Failed to get all notification settings',
      error: error.message
    });
  }
};
