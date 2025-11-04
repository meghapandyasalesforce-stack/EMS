import Notification from '../models/notification.model.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import Project from '../models/project.model.js';
import NotificationSettings from '../models/notificationSettings.model.js';

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
      console.error('Project not found for task notification');
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

    // Create notifications for each recipient
    const notificationPromises = Array.from(recipients).map(recipientId => {
      return Notification.create({
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

    console.log(`Task ${updateType} notification sent to ${recipients.size} recipients`);
  } catch (error) {
    console.error('Error sending task update notification:', error);
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
    const notificationPromises = recipientIds.map(recipientId => {
      return Notification.create({
        recipient: recipientId,
        sender: sender._id,
        message,
        type,
        metadata
      });
    });

    await Promise.all(notificationPromises);
    console.log(`Notification sent to ${recipientIds.length} recipients`);
  } catch (error) {
    console.error('Error sending notification to users:', error);
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
    await Notification.create({
      sender: sender._id,
      message,
      type,
      isBroadcast: true,
      metadata
    });
    console.log('Broadcast notification sent');
  } catch (error) {
    console.error('Error sending broadcast notification:', error);
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
    console.error('Error marking notification as read:', error);
  }
};

/**
 * Get unread notification count for user
 * @param {String} userId - User ID
 * @returns {Number} Unread count
 */
export const getUnreadNotificationCount = async (userId) => {
  try {
    const count = await Notification.countDocuments({
      $or: [
        { recipient: userId, isRead: false },
        { isBroadcast: true, isRead: false }
      ]
    });
    return count;
  } catch (error) {
    console.error('Error getting unread notification count:', error);
    return 0;
  }
};
