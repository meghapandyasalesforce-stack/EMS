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

// WebSocket notification service (lazy import to avoid circular dependencies)
let wsNotificationService = null;
const getWebSocketService = async () => {
  if (!wsNotificationService) {
    try {
      wsNotificationService = await import('../config/websocket.js');
    } catch (error) {
      logger.warn('WebSocket service not available', { error: error.message });
    }
  }
  return wsNotificationService;
};

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

    const notifications = await Promise.all(notificationPromises);

    // Send notifications via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        notifications.forEach(notification => {
          const recipientId = notification.recipient.toString();
          wsService.sendNotificationToUser(recipientId, notification.toObject ? notification.toObject() : notification);
        });
      }
    } catch (wsError) {
      logger.warn('Error sending notifications via WebSocket', {
        error: wsError.message,
        taskId: task._id
      });
    }

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
    
    // Send notifications via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        notifications.forEach(notification => {
          const recipientId = notification.recipient.toString();
          wsService.sendNotificationToUser(recipientId, notification.toObject ? notification.toObject() : notification);
        });
      }
    } catch (wsError) {
      logger.warn('Error sending notifications via WebSocket', {
        error: wsError.message
      });
    }

    logger.info('Notification sent to users', {
      recipientCount: recipientIds.length,
      notificationId: notifications[0]?._id
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
        
        await sendPushNotification(recipientId, 'User', pushPayload, organizationId);
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
    
    const notificationData = {
      organizationId,
      message,
      type,
      isBroadcast: true,
      metadata
    };

    if (sender?._id) {
      notificationData.sender = sender._id;
      notificationData.senderType = senderType;
    }

    const notification = await Notification.create(notificationData);
    
    // Send broadcast notification via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        wsService.sendBroadcastNotification(organizationId.toString(), notification.toObject ? notification.toObject() : notification);
      }
    } catch (wsError) {
      logger.warn('Error sending broadcast notification via WebSocket', {
        error: wsError.message
      });
    }

    logger.info('Broadcast notification sent', {
      notificationId: notification._id,
      message
    });

    // Send push notification to all subscribers
    try {
      const pushPayload = createPushPayload(message, type, {
        ...metadata,
        notificationId: notification._id
      });
      
      await sendBroadcastPushNotification(pushPayload, organizationId);
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
export const sendNotification = async ({
  userId,
  title,
  message,
  type = 'general',
  priority = 'medium',
  metadata = {},
  organizationId = null,
  senderId = null,
  senderType = null
}) => {
  try {
    // Resolve recipient model so notification records and push subscriptions use the
    // correct target type even when organizationId is already provided by the caller.
    let userOrgId = organizationId;
    let recipientType = 'User';

    try {
      const UserModel = (await import('../models/user.model.js')).default;
      const EmployeeModel = (await import('../models/employee.model.js')).default;

      const user = await UserModel.findById(userId).select('organizationId').lean();
      if (user) {
        userOrgId = userOrgId || user.organizationId;
        recipientType = 'User';
      } else {
        const employee = await EmployeeModel.findById(userId).select('organizationId').lean();
        if (employee) {
          userOrgId = userOrgId || employee.organizationId;
          recipientType = 'Employee';
        }
      }
    } catch (error) {
      logger.error('Error getting user/employee for notification', {
        error: error.message,
        userId
      });
    }
    
    if (!userOrgId) {
      logger.error('OrganizationId missing when sending notification', {
        userId,
        message
      });
      throw new Error('OrganizationId is required to send notifications');
    }
    
    const resolvedSenderId = senderId || metadata.senderId || null;
    const resolvedSenderType = senderType || metadata.senderType || 'User';

    const notificationData = {
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
    };

    if (resolvedSenderId) {
      notificationData.sender = resolvedSenderId;
      notificationData.senderType = resolvedSenderType;
    }

    const notification = await Notification.create(notificationData);
    
    logger.info('Notification sent', {
      notificationId: notification._id,
      userId,
      type
    });
    
    // Send notification via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        wsService.sendNotificationToUser(userId.toString(), notification.toObject ? notification.toObject() : notification);
      }
    } catch (wsError) {
      logger.warn('Error sending notification via WebSocket', {
        error: wsError.message,
        userId
      });
    }
    
    // Send push notification if enabled
    try {
      const settings = await NotificationSettings.findOne({ user: userId });
      if (!settings || settings.pushNotifications !== false) {
        const pushPayload = createPushPayload(title ? `${title}: ${message}` : message, type, {
          ...metadata,
          notificationId: notification._id,
          title
        });
        
        await sendPushNotification(userId, recipientType, pushPayload, userOrgId);
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
 * Send break notification to HR, Admin, and CEO when employee goes on break
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
    
    // Get HR employees
    const hrEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { functionalRoles: { $in: ['hr', 'HR'] } },
        { department: { $regex: /hr/i } },
        { jobTitle: { $regex: /hr/i } },
        { position: { $regex: /hr/i } }
      ]
    }).select('_id name lastName').lean();
    
    // Get CEO employees
    const ceoEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { jobTitle: { $regex: /ceo/i } },
        { position: { $regex: /ceo/i } },
        { functionalRoles: { $in: ['ceo', 'CEO'] } }
      ]
    }).select('_id name lastName').lean();
    
    const recipientIds = new Set();
    admins.forEach(admin => recipientIds.add(admin._id.toString()));
    hrEmployees.forEach(hr => recipientIds.add(hr._id.toString()));
    ceoEmployees.forEach(ceo => recipientIds.add(ceo._id.toString()));
    
    if (recipientIds.size === 0) {
      logger.warn('No recipients found to notify about break', {
        employeeId: employee._id,
        organizationId
      });
      return;
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const message = `${employee.name} ${employee.lastName || ''} has started a break at ${time}.`;
    const title = 'Employee Started Break';
    
    // Create notifications for each recipient
    const notificationPromises = Array.from(recipientIds).map(recipientId => {
      return Notification.create({
        organizationId,
        recipient: recipientId,
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
    
    // Send notifications via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        notifications.forEach(notification => {
          const recipientId = notification.recipient.toString();
          wsService.sendNotificationToUser(recipientId, notification.toObject ? notification.toObject() : notification);
        });
      }
    } catch (wsError) {
      logger.warn('Error sending break notifications via WebSocket', {
        error: wsError.message,
        employeeId: employee._id
      });
    }

    logger.info('Break notification sent', {
      recipientCount: recipientIds.size,
      employeeId: employee._id,
      employeeName: employee.name
    });

    // Send push notifications to all recipients
    try {
      for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];
        const recipientId = notification.recipient.toString();
        
        // Check recipient's push notification settings
        const settings = await NotificationSettings.findOne({ user: recipientId });
        if (settings && settings.pushNotifications === false) {
          continue; // Skip if recipient disabled push notifications
        }

        // Determine recipient type
        const isAdmin = admins.some(a => a._id.toString() === recipientId);
        const recipientType = isAdmin ? 'User' : 'Employee';

        // Send push notification
        const pushPayload = createPushPayload(message, 'break', {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          breakTime: new Date(),
          notificationId: notification._id
        });
        
        await sendPushNotification(recipientId, recipientType, pushPayload, organizationId);
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

/**
 * Send break ended notification to HR, Admin, and CEO when employee returns from break
 * @param {Object} employee - Employee object who returned from break
 */
export const sendBreakEndedNotification = async (employee) => {
  try {
    logger.info('sendBreakEndedNotification called', {
      employeeId: employee._id,
      employeeName: employee.name,
      organizationId: employee.organizationId
    });

    // Get organizationId from employee
    const organizationId = employee.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending break ended notification', {
        employeeId: employee._id
      });
      return; // Don't create notifications without organizationId
    }
    
    // Get all admins for this organization
    const admins = await User.find({ role: 'admin', organizationId });
    logger.info('Found admins for break ended notification', {
      adminCount: admins.length,
      organizationId
    });
    
    // Get HR employees
    const hrEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { functionalRoles: { $in: ['hr', 'HR'] } },
        { department: { $regex: /hr/i } },
        { jobTitle: { $regex: /hr/i } },
        { position: { $regex: /hr/i } }
      ]
    }).select('_id name lastName').lean();
    logger.info('Found HR employees for break ended notification', {
      hrCount: hrEmployees.length,
      organizationId
    });
    
    // Get CEO employees
    const ceoEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { jobTitle: { $regex: /ceo/i } },
        { position: { $regex: /ceo/i } },
        { functionalRoles: { $in: ['ceo', 'CEO'] } }
      ]
    }).select('_id name lastName').lean();
    logger.info('Found CEO employees for break ended notification', {
      ceoCount: ceoEmployees.length,
      organizationId
    });
    
    const recipientIds = new Set();
    admins.forEach(admin => recipientIds.add(admin._id.toString()));
    hrEmployees.forEach(hr => recipientIds.add(hr._id.toString()));
    ceoEmployees.forEach(ceo => recipientIds.add(ceo._id.toString()));
    
    logger.info('Total recipients for break ended notification', {
      recipientCount: recipientIds.size,
      organizationId
    });
    
    if (recipientIds.size === 0) {
      logger.warn('No recipients found to notify about break ended', {
        employeeId: employee._id,
        organizationId
      });
      return;
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const message = `${employee.name} ${employee.lastName || ''} has returned from break at ${time}.`;
    const title = 'Employee Returned from Break';
    
    // Create notifications for each recipient
    const notificationPromises = Array.from(recipientIds).map(recipientId => {
      return Notification.create({
        organizationId,
        recipient: recipientId,
        recipientType: 'User',
        sender: employee._id,
        senderType: 'Employee',
        message,
        type: 'break',
        priority: 'medium',
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          breakEndTime: new Date()
        }
      });
    });

    const notifications = await Promise.all(notificationPromises);
    
    // Send notifications via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        notifications.forEach(notification => {
          const recipientId = notification.recipient.toString();
          wsService.sendNotificationToUser(recipientId, notification.toObject ? notification.toObject() : notification);
        });
      }
    } catch (wsError) {
      logger.warn('Error sending break ended notifications via WebSocket', {
        error: wsError.message,
        employeeId: employee._id
      });
    }

    logger.info('Break ended notification sent', {
      recipientCount: recipientIds.size,
      employeeId: employee._id,
      employeeName: employee.name
    });

    // Send push notifications to all recipients
    try {
      for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];
        const recipientId = notification.recipient.toString();
        
        // Check recipient's push notification settings
        const settings = await NotificationSettings.findOne({ user: recipientId });
        if (settings && settings.pushNotifications === false) {
          continue; // Skip if recipient disabled push notifications
        }

        // Determine recipient type - check if it's a User (admin) or Employee (HR/CEO)
        const isAdmin = admins.some(a => a._id.toString() === recipientId);
        const recipientType = isAdmin ? 'User' : 'Employee';

        // Send push notification
        const pushPayload = createPushPayload(message, 'break', {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          breakEndTime: new Date(),
          notificationId: notification._id
        });
        
        await sendPushNotification(recipientId, recipientType, pushPayload, organizationId);
      }
    } catch (pushError) {
      logger.error('Error sending break ended push notifications', {
        error: pushError.message,
        stack: pushError.stack,
        employeeId: employee._id
      });
      // Don't fail the main notification if push fails
    }
  } catch (error) {
    logger.error('Error sending break ended notification', {
      error: error.message,
      stack: error.stack,
      employeeId: employee._id
    });
  }
};

/**
 * Send punch out notification to HR, Admin, and CEO when employee clocks out
 * @param {Object} employee - Employee object who clocked out
 */
export const sendPunchOutNotification = async (employee) => {
  try {
    logger.info('sendPunchOutNotification called', {
      employeeId: employee._id,
      employeeName: employee.name,
      organizationId: employee.organizationId
    });

    // Get organizationId from employee
    const organizationId = employee.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending punch out notification', {
        employeeId: employee._id
      });
      return; // Don't create notifications without organizationId
    }
    
    // Get all admins for this organization
    const admins = await User.find({ role: 'admin', organizationId });
    logger.info('Found admins for punch out notification', {
      adminCount: admins.length,
      organizationId
    });
    
    // Get HR employees
    const hrEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { functionalRoles: { $in: ['hr', 'HR'] } },
        { department: { $regex: /hr/i } },
        { jobTitle: { $regex: /hr/i } },
        { position: { $regex: /hr/i } }
      ]
    }).select('_id name lastName').lean();
    logger.info('Found HR employees for punch out notification', {
      hrCount: hrEmployees.length,
      organizationId
    });
    
    // Get CEO employees
    const ceoEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { jobTitle: { $regex: /ceo/i } },
        { position: { $regex: /ceo/i } },
        { functionalRoles: { $in: ['ceo', 'CEO'] } }
      ]
    }).select('_id name lastName').lean();
    logger.info('Found CEO employees for punch out notification', {
      ceoCount: ceoEmployees.length,
      organizationId
    });
    
    const recipientIds = new Set();
    admins.forEach(admin => recipientIds.add(admin._id.toString()));
    hrEmployees.forEach(hr => recipientIds.add(hr._id.toString()));
    ceoEmployees.forEach(ceo => recipientIds.add(ceo._id.toString()));
    
    logger.info('Total recipients for punch out notification', {
      recipientCount: recipientIds.size,
      organizationId
    });
    
    if (recipientIds.size === 0) {
      logger.warn('No recipients found to notify about punch out', {
        employeeId: employee._id,
        organizationId
      });
      return;
    }

    const time = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const message = `${employee.name} ${employee.lastName || ''} has punched out at ${time}.`;
    const title = 'Employee Punched Out';
    
    // Create notifications for each recipient
    const notificationPromises = Array.from(recipientIds).map(recipientId => {
      return Notification.create({
        organizationId,
        recipient: recipientId,
        recipientType: 'User',
        sender: employee._id,
        senderType: 'Employee',
        message,
        type: 'break',
        priority: 'medium',
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          punchOutTime: new Date()
        }
      });
    });

    const notifications = await Promise.all(notificationPromises);
    
    // Send notifications via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        notifications.forEach(notification => {
          const recipientId = notification.recipient.toString();
          wsService.sendNotificationToUser(recipientId, notification.toObject ? notification.toObject() : notification);
        });
      }
    } catch (wsError) {
      logger.warn('Error sending punch out notifications via WebSocket', {
        error: wsError.message,
        employeeId: employee._id
      });
    }

    logger.info('Punch out notification sent', {
      recipientCount: recipientIds.size,
      employeeId: employee._id,
      employeeName: employee.name
    });

    // Send push notifications to all recipients
    try {
      for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];
        const recipientId = notification.recipient.toString();
        
        // Check recipient's push notification settings
        const settings = await NotificationSettings.findOne({ user: recipientId });
        if (settings && settings.pushNotifications === false) {
          continue; // Skip if recipient disabled push notifications
        }

        // Determine recipient type - check if it's a User (admin) or Employee (HR/CEO)
        const isAdmin = admins.some(a => a._id.toString() === recipientId);
        const recipientType = isAdmin ? 'User' : 'Employee';

        // Send push notification
        const pushPayload = createPushPayload(message, 'punch_out', {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          punchOutTime: new Date(),
          notificationId: notification._id
        });
        
        await sendPushNotification(recipientId, recipientType, pushPayload, organizationId);
      }
    } catch (pushError) {
      logger.error('Error sending punch out push notifications', {
        error: pushError.message,
        stack: pushError.stack,
        employeeId: employee._id
      });
      // Don't fail the main notification if push fails
    }
  } catch (error) {
    logger.error('Error sending punch out notification', {
      error: error.message,
      stack: error.stack,
      employeeId: employee._id
    });
  }
};

/**
 * Send new employee notification to HR, Admin, and CEO when a new employee is created
 * @param {Object} employee - Employee object who was created
 */
export const sendNewEmployeeNotification = async (employee) => {
  try {
    logger.info('sendNewEmployeeNotification called', { employeeId: employee._id, organizationId: employee.organizationId });
    
    // Get organizationId from employee
    const organizationId = employee.organizationId;
    
    if (!organizationId) {
      logger.error('OrganizationId missing when sending new employee notification', {
        employeeId: employee._id
      });
      return; // Don't create notifications without organizationId
    }
    
    // Get all admins for this organization
    const admins = await User.find({ role: 'admin', organizationId });
    
    // Get HR employees
    const hrEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { functionalRoles: { $in: ['hr', 'HR'] } },
        { department: { $regex: /hr/i } },
        { jobTitle: { $regex: /hr/i } },
        { position: { $regex: /hr/i } }
      ]
    }).select('_id name lastName').lean();
    
    // Get CEO employees
    const ceoEmployees = await Employee.find({
      organizationId,
      status: 'active',
      $or: [
        { jobTitle: { $regex: /ceo/i } },
        { position: { $regex: /ceo/i } },
        { functionalRoles: { $in: ['ceo', 'CEO'] } }
      ]
    }).select('_id name lastName').lean();
    
    const recipientIds = new Set();
    admins.forEach(admin => recipientIds.add(admin._id.toString()));
    hrEmployees.forEach(hr => recipientIds.add(hr._id.toString()));
    ceoEmployees.forEach(ceo => recipientIds.add(ceo._id.toString()));
    
    logger.info('New employee notification recipients', {
      adminCount: admins.length,
      hrCount: hrEmployees.length,
      ceoCount: ceoEmployees.length,
      totalRecipients: recipientIds.size
    });
    
    if (recipientIds.size === 0) {
      logger.warn('No recipients found to notify about new employee', {
        employeeId: employee._id,
        organizationId
      });
      return;
    }

    const message = `Welcome ${employee.name} ${employee.lastName || ''} to Paarsiv Technologies Private Limited. We wish you a successful and rewarding journey with us!`;
    
    // Create notifications for each recipient
    const notificationPromises = Array.from(recipientIds).map(recipientId => {
      return Notification.create({
        organizationId,
        recipient: recipientId,
        recipientType: 'User',
        sender: employee._id,
        senderType: 'Employee',
        message,
        type: 'new_employee',
        priority: 'medium',
        metadata: {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          employeeEmail: employee.email
        }
      });
    });

    const notifications = await Promise.all(notificationPromises);
    
    // Send notifications via WebSocket
    try {
      const wsService = await getWebSocketService();
      if (wsService) {
        notifications.forEach(notification => {
          const recipientId = notification.recipient.toString();
          wsService.sendNotificationToUser(recipientId, notification.toObject ? notification.toObject() : notification);
        });
      }
    } catch (wsError) {
      logger.warn('Error sending new employee notifications via WebSocket', {
        error: wsError.message,
        employeeId: employee._id
      });
    }

    // Send push notifications to all recipients
    try {
      logger.info('Starting push notification sending', { notificationCount: notifications.length });
      
      for (let i = 0; i < notifications.length; i++) {
        const notification = notifications[i];
        const recipientId = notification.recipient.toString();
        
        logger.info('Processing recipient for push', { recipientId, index: i });
        
        // Check recipient's push notification settings
        const settings = await NotificationSettings.findOne({ user: recipientId });
        if (settings && settings.pushNotifications === false) {
          logger.info('Push disabled for recipient', { recipientId });
          continue; // Skip if recipient disabled push notifications
        }

        // Determine recipient type
        const isAdmin = admins.some(a => a._id.toString() === recipientId);
        const recipientType = isAdmin ? 'User' : 'Employee';

        logger.info('Sending push notification', { recipientId, recipientType, type: 'new_employee' });

        // Send push notification
        const pushPayload = createPushPayload(message, 'new_employee', {
          employeeId: employee._id,
          employeeName: `${employee.name} ${employee.lastName || ''}`,
          employeeEmail: employee.email,
          notificationId: notification._id
        });
        
        const result = await sendPushNotification(recipientId, recipientType, pushPayload, organizationId);
        logger.info('Push notification result', { recipientId, result });
      }
      
      logger.info('Completed push notification sending');
    } catch (pushError) {
      logger.error('Error sending new employee push notifications', {
        error: pushError.message,
        stack: pushError.stack,
        employeeId: employee._id
      });
      // Don't fail the main notification if push fails
    }
  } catch (error) {
    logger.error('Error sending new employee notification', {
      error: error.message,
      stack: error.stack,
      employeeId: employee._id
    });
  }
};