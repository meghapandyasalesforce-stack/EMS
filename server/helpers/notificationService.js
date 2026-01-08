import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import Project from '../models/project.model.js';
import NotificationSettings from '../models/notificationSettings.model.js';
import logger from './logger.js';
import { 
  sendPushNotification, 
  sendBroadcastPushNotification,
  createPushPayload 
} from './pushNotificationService.js';

/**
 * Send task update notification to relevant stakeholders
 * @param {Object} task - The updated task
 * @param {Object} employee - The employee who updated the task
 * @param {String} updateType - Type of update (created, updated, completed)
 * @param {Object} oldTask - Previous task state (for updates)
 */
export const sendTaskUpdateNotification = async (task, employee, updateType = 'updated', oldTask = null) => {
  try {
    // Get project details with populated members
    const project = await Project.findById(task.project)
      .populate('projectLeader', 'name email')
      .populate('projectMembers', 'name email');

    if (!project) {
      logger.error('Project not found for task notification', {
        projectId: task.project,
        taskId: task._id
      });
      return;
    }

    // Get all admins
    const admins = await User.find({ role: 'admin', isActive: true });

    // Get employee's manager
    const employeeData = await Employee.findById(employee._id).select('manager');
    let managerId = null;
    if (employeeData && employeeData.manager) {
      managerId = employeeData.manager.toString();
    }

    // Prepare notification recipients based on notification settings
    const recipients = new Set();

    // Get notification settings for each potential recipient and add them if enabled
    const potentialRecipients = {
      admins: admins.map(admin => admin._id.toString()),
      manager: managerId ? [managerId] : [],
      projectLeader: project.projectLeader ? [project.projectLeader._id.toString()] : []
    };

    // Add admins if notifications are enabled for them
    for (const adminId of potentialRecipients.admins) {
      const settings = await NotificationSettings.findOne({ user: adminId });
      if (!settings || settings.taskNotifications?.enabled !== false) {
        recipients.add(adminId);
      }
    }

    // Add manager if notifications are enabled for managers
    if (managerId) {
      const settings = await NotificationSettings.findOne({ user: managerId });
      if (settings && settings.taskNotifications?.notifyManagers === true) {
        recipients.add(managerId);
      }
    }

    // Add project leader if notifications are enabled for project managers
    if (project.projectLeader) {
      const projectLeaderId = project.projectLeader._id.toString();
      const settings = await NotificationSettings.findOne({ user: projectLeaderId });
      if (settings && settings.taskNotifications?.notifyProjectManagers === true) {
        recipients.add(projectLeaderId);
      }
    }

    // Create notification message based on update type
    let message = '';
    let priority = 'medium';
    let notificationType = 'task_update';

    switch (updateType) {
      case 'created':
        message = `${employee.name} created a new task "${task.taskDescription}" in project "${project.name}"`;
        notificationType = 'task_created';
        priority = 'low';
        break;
      case 'completed':
        message = `🎉 ${employee.name} completed task "${task.taskDescription}" in project "${project.name}"`;
        notificationType = 'task_completed';
        priority = 'high';
        break;
      case 'updated':
        let changes = [];
        if (oldTask) {
          if (oldTask.taskDescription !== task.taskDescription) {
            changes.push('description');
          }
          if (oldTask.status !== task.status) {
            changes.push(`status to "${task.status}"`);
          }
          if (oldTask.comments !== task.comments) {
            changes.push('comments');
          }
        }
        
        const changeText = changes.length > 0 ? ` (${changes.join(', ')})` : '';
        message = `${employee.name} updated task "${task.taskDescription}" in project "${project.name}"${changeText}`;
        notificationType = 'task_update';
        priority = task.status === 'Completed' ? 'high' : 'medium';
        break;
      default:
        message = `${employee.name} updated task "${task.taskDescription}" in project "${project.name}"`;
    }

    // Get organizationId from employee or project
    const organizationId = employee.organizationId || project.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending task update notification', {
        employeeId: employee._id,
        projectId: project._id,
        taskId: task._id
      });
      return; // Don't create notifications without organizationId
    }
    
    // Create notifications for each recipient
    const notificationPromises = Array.from(recipients).map(recipientId => {
      return Notification.create({
        organizationId,
        recipient: recipientId,
        sender: employee._id,
        message,
        type: notificationType,
        relatedEntity: task._id,
        relatedEntityType: 'Task',
        priority,
        metadata: {
          projectId: project._id,
          projectName: project.name,
          taskId: task._id,
          taskDescription: task.taskDescription,
          employeeId: employee._id,
          employeeName: employee.name,
          updateType,
          oldStatus: oldTask?.status,
          newStatus: task.status
        }
      });
    });

    await Promise.all(notificationPromises);

    logger.info('Task update notification sent', {
      updateType,
      recipientCount: recipients.size,
      taskId: task._id
    });
  } catch (error) {
    logger.error('Error sending task update notification', {
      error: error.message,
      stack: error.stack,
      taskId: task._id,
      updateType
    });
  }
};

/**
 * Send notification to specific users
 * @param {Array} recipientIds - Array of user IDs
 * @param {Object} sender - Sender user object
 * @param {String} message - Notification message
 * @param {String} type - Notification type
 * @param {Object} metadata - Additional metadata
 */
export const sendNotificationToUsers = async (recipientIds, sender, message, type = 'general', metadata = {}) => {
  try {
    // Determine sender type based on sender model
    const senderType = sender.constructor.modelName === 'Employee' ? 'Employee' : 'User';
    
    // Get organizationId from sender (both User and Employee have organizationId)
    const organizationId = sender.organizationId || sender.organization || metadata.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending notification', {
        senderId: sender._id,
        senderType,
        message
      });
      throw new Error('OrganizationId is required to send notifications');
    }
    
    const notificationPromises = recipientIds.map(recipientId => {
      return Notification.create({
        organizationId,
        recipient: recipientId,
        recipientType: 'User', // Assuming recipients are Users for now
        sender: sender._id,
        senderType: senderType,
        message,
        type,
        metadata
      });
    });

    const notifications = await Promise.all(notificationPromises);
    logger.info('Notification sent to users', {
      recipientCount: recipientIds.length,
      notificationId: notification._id
    });

    // Send push notifications if enabled
    try {
      for (let i = 0; i < recipientIds.length; i++) {
        const recipientId = recipientIds[i];
        const notification = notifications[i];
        
        // Check user's push notification settings
        const settings = await NotificationSettings.findOne({ user: recipientId });
        if (settings && settings.pushNotifications === false) {
          continue; // Skip if user disabled push notifications
        }

        // Send push notification
        const pushPayload = createPushPayload(message, type, {
          ...metadata,
          notificationId: notification._id
        });
        
        await sendPushNotification(recipientId, 'User', pushPayload);
      }
    } catch (pushError) {
      logger.error('Error sending push notifications', {
        error: pushError.message,
        stack: pushError.stack,
        notificationId: notification._id
      });
      // Don't fail the main notification if push fails
    }
  } catch (error) {
    logger.error('Error sending notification to users', {
      error: error.message,
      stack: error.stack,
      recipientIds
    });
  }
};

/**
 * Send broadcast notification to all users
 * @param {Object} sender - Sender user object
 * @param {String} message - Notification message
 * @param {String} type - Notification type
 * @param {Object} metadata - Additional metadata
 */
export const sendBroadcastNotification = async (sender, message, type = 'general', metadata = {}) => {
  try {
    // Determine sender type based on sender model
    const senderType = sender.constructor.modelName === 'Employee' ? 'Employee' : 'User';
    
    // Get organizationId from sender (both User and Employee have organizationId)
    const organizationId = sender.organizationId || sender.organization || metadata.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending broadcast notification', {
        senderId: sender._id,
        senderType,
        message
      });
      throw new Error('OrganizationId is required to send notifications');
    }
    
    const notification = await Notification.create({
      organizationId,
      sender: sender._id,
      senderType: senderType,
      message,
      type,
      isBroadcast: true,
      metadata
    });
    logger.info('Broadcast notification sent', {
      notificationId: notification._id,
      title
    });

    // Send push notification to all subscribers
    try {
      const pushPayload = createPushPayload(message, type, {
        ...metadata,
        notificationId: notification._id
      });
      
      await sendBroadcastPushNotification(pushPayload);
    } catch (pushError) {
      logger.error('Error sending broadcast push notification', {
        error: pushError.message,
        stack: pushError.stack,
        notificationId: notification._id
      });
      // Don't fail the main notification if push fails
    }
  } catch (error) {
    logger.error('Error sending broadcast notification', {
      error: error.message,
      stack: error.stack,
      title
    });
  }
};

/**
 * Mark notification as read
 * @param {String} notificationId - Notification ID
 * @param {String} userId - User ID
 */
export const markNotificationAsRead = async (notificationId, userId) => {
  try {
    await Notification.findOneAndUpdate(
      { _id: notificationId, recipient: userId },
      { isRead: true }
    );
  } catch (error) {
    logger.error('Error marking notification as read', {
      error: error.message,
      stack: error.stack,
      notificationId,
      userId
    });
  }
};

/**
 * Get unread notification count for user
 * @param {String} userId - User ID
 * @returns {Number} Unread count
 */
export const getUnreadNotificationCount = async (userId, organizationId) => {
  try {
    if (!organizationId) {
      logger.error('OrganizationId is required for getUnreadNotificationCount', { userId });
      return 0;
    }

    const count = await Notification.countDocuments({
      organizationId,
      $or: [
        { recipient: userId, isRead: false },
        { isBroadcast: true, isRead: false }
      ]
    });
    return count;
  } catch (error) {
    logger.error('Error getting unread notification count', {
      error: error.message,
      stack: error.stack,
      userId,
      organizationId
    });
    return 0;
  }
};

/**
 * Send notification to a single user
 * @param {Object} params - Notification parameters
 * @param {String} params.userId - User/Employee ID
 * @param {String} params.title - Notification title
 * @param {String} params.message - Notification message
 * @param {String} params.type - Notification type
 * @param {String} params.priority - Notification priority (low, medium, high)
 * @param {Object} params.metadata - Additional metadata
 * @param {String} params.organizationId - Organization ID (optional, will try to get from user)
 */
export const sendNotification = async ({ userId, title, message, type = 'general', priority = 'medium', metadata = {}, organizationId = null }) => {
  try {
    // Get user/employee to determine organizationId
    let userOrgId = organizationId;
    let recipientType = 'User';
    
    if (!userOrgId) {
      try {
        const UserModel = (await import('../models/user.model.js')).default;
        const EmployeeModel = (await import('../models/employee.model.js')).default;
        
        let user = await UserModel.findById(userId).select('organizationId').lean();
        if (user) {
          userOrgId = user.organizationId;
          recipientType = 'User';
        } else {
          const employee = await EmployeeModel.findById(userId).select('organizationId').lean();
          if (employee) {
            userOrgId = employee.organizationId;
            recipientType = 'Employee';
          }
        }
      } catch (error) {
        logger.error('Error getting user/employee for notification', {
          error: error.message,
          userId
        });
      }
    }
    
    if (!userOrgId) {
      logger.error('OrganizationId missing when sending notification', {
        userId,
        message
      });
      throw new Error('OrganizationId is required to send notifications');
    }
    
    // Create notification
    const notification = await Notification.create({
      organizationId: userOrgId,
      recipient: userId,
      recipientType: recipientType,
      message: title ? `${title}: ${message}` : message,
      type,
      priority,
      metadata: {
        ...metadata,
        title: title || message
      }
    });
    
    logger.info('Notification sent', {
      notificationId: notification._id,
      userId,
      type
    });
    
    // Send push notification if enabled
    try {
      const settings = await NotificationSettings.findOne({ user: userId });
      if (!settings || settings.pushNotifications !== false) {
        const pushPayload = createPushPayload(title ? `${title}: ${message}` : message, type, {
          ...metadata,
          notificationId: notification._id,
          title
        });
        
        await sendPushNotification(userId, recipientType, pushPayload);
      }
    } catch (pushError) {
      logger.error('Error sending push notification', {
        error: pushError.message,
        userId,
        notificationId: notification._id
      });
      // Don't fail the main notification if push fails
    }
    
    return notification;
  } catch (error) {
    logger.error('Error sending notification', {
      error: error.message,
      stack: error.stack,
      userId,
      type
    });
    throw error;
  }
};

/**
 * Send break notification to all admins when employee goes on break
 * @param {Object} employee - Employee object who went on break
 */
export const sendBreakNotification = async (employee) => {
  try {
    // Get organizationId from employee
    const organizationId = employee.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending break notification', {
        employeeId: employee._id
      });
      return; // Don't create notifications without organizationId
    }
    
    // Get all admins for this organization
    const admins = await User.find({ role: 'admin', organizationId });
    
    if (admins.length === 0) {
      logger.warn('No admins found to notify about break', {
        employeeId: employee._id,
        organizationId
      });
      return;
    }

    const message = `☕ ${employee.name} ${employee.lastName || ''} is now on break`;
    
    // Create notifications for each admin
    const notificationPromises = admins.map(admin => {
      return Notification.create({
        organizationId,
        recipient: admin._id,
        recipientType: 'User',
        sender: employee._id,
        senderType: 'Employee',
        message,
        type: 'break',
        priority: 'medium',
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          breakTime: new Date()
        }
      });
    });

    const notifications = await Promise.all(notificationPromises);
    logger.info('Break notification sent', {
      adminCount: admins.length,
      employeeId: employee._id,
      employeeName: employee.name
    });

    // Send push notifications to admins
    try {
      for (let i = 0; i < admins.length; i++) {
        const admin = admins[i];
        const notification = notifications[i];
        
        // Check admin's push notification settings
        const settings = await NotificationSettings.findOne({ user: admin._id });
        if (settings && settings.pushNotifications === false) {
          continue; // Skip if admin disabled push notifications
        }

        // Send push notification
        const pushPayload = createPushPayload(message, 'break', {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          breakTime: new Date(),
          notificationId: notification._id
        });
        
        await sendPushNotification(admin._id, 'User', pushPayload);
      }
    } catch (pushError) {
      logger.error('Error sending break push notifications', {
        error: pushError.message,
        stack: pushError.stack,
        employeeId: employee._id
      });
      // Don't fail the main notification if push fails
    }
  } catch (error) {
    logger.error('Error sending break notification', {
      error: error.message,
      stack: error.stack,
      employeeId: employee._id
    });
  }
};