import webpush from 'web-push';
import PushSubscription from '../models/pushSubscription.model.js';
import logger from './logger.js';

// Configure VAPID details

let vapidConfigured = false;

const ensureVAPID = () => {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject =
    process.env.VAPID_SUBJECT ||
    process.env.VAPID_EMAIL ||
    'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  vapidConfigured = true;
  return true;
};

export const sendPushNotification = async (userId, userType, payload, organizationId) => {
  if (!ensureVAPID()) {
    logger.warn('VAPID not configured, skipping push notification');
    return { sent: 0, failed: 0, reason: 'VAPID_NOT_CONFIGURED' };
  }
/**
 * Send push notification to a specific user
 * @param {String|ObjectId} userId - User ID
 * @param {String} userType - 'User' or 'Employee'
 * @param {Object} payload - Notification payload
 * @param {String} organizationId - Organization ID to filter subscriptions
 * @returns {Promise<Object>} - { sent: number, failed: number }
 */

  logger.info('sendPushNotification called', {
    userId,
    userType,
    payloadType: payload.data?.type,
    payloadTitle: payload.notification?.title,
    organizationId
  });

  try {
    // Query by userId and organizationId to ensure we find subscriptions for the correct organization
    const query = { userId };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    const subscriptions = await PushSubscription.find(query);

    logger.info('Push subscriptions found for userId', {
      userId,
      subscriptionCount: subscriptions.length,
      userTypes: subscriptions.map(s => s.userType)
    });

    if (subscriptions.length === 0) {
      logger.warn('No push subscriptions found for user', { userId });
      return { sent: 0, failed: 0, reason: 'NO_SUBSCRIPTION' };
    }

    const results = await Promise.allSettled(
      subscriptions.map(subscription => {
        const subscriptionObj = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        };

        return webpush.sendNotification(
          subscriptionObj,
          JSON.stringify(payload)
        );
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    // Log failures and only remove expired/invalid subscriptions (410/404)
    if (failed > 0) {
      const failedIndices = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const statusCode = result.reason?.statusCode;
          logger.error('Push notification delivery failed', {
            userId,
            userType,
            endpoint: subscriptions[index]?.endpoint,
            statusCode,
            error: result.reason?.message || String(result.reason),
          });
          if (statusCode === 404 || statusCode === 410) {
            failedIndices.push(index);
          }
        }
      });

      if (failedIndices.length > 0) {
        const failedSubscriptions = failedIndices.map(i => subscriptions[i]._id);
        await PushSubscription.deleteMany({ _id: { $in: failedSubscriptions } });
        logger.info(`Removed ${failedIndices.length} invalid push subscriptions`);
      }
    }

    logger.info(`Push notification sent: ${sent} successful, ${failed} failed`);
    return { sent, failed };
  } catch (error) {
    logger.error('Error sending push notification', { error: error.message, stack: error.stack });
    return { sent: 0, failed: 0 };
  }
};

/**
 * Send broadcast push notification to all subscribers
 * @param {Object} payload - Notification payload
 * @param {String} organizationId - Organization ID to filter subscriptions
 * @returns {Promise<Object>} - { sent: number, failed: number }
 */
export const sendBroadcastPushNotification = async (payload, organizationId) => {
  if (!ensureVAPID()) {
    logger.warn('VAPID not configured, skipping broadcast push notification');
    return { sent: 0, failed: 0 };
  }

  try {
    const subscriptions = await PushSubscription.find({ organizationId });
    
    if (subscriptions.length === 0) {
      logger.warn('No push subscriptions found for organization', { organizationId });
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map(subscription => {
        const subscriptionObj = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth
          }
        };

        return webpush.sendNotification(
          subscriptionObj,
          JSON.stringify(payload)
        );
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;

    if (failed > 0) {
      const failedIndices = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const statusCode = result.reason?.statusCode;
          logger.error('Broadcast push delivery failed', {
            endpoint: subscriptions[index]?.endpoint,
            statusCode,
            error: result.reason?.message || String(result.reason),
          });
          if (statusCode === 404 || statusCode === 410) {
            failedIndices.push(index);
          }
        }
      });

      if (failedIndices.length > 0) {
        const failedSubscriptions = failedIndices.map(i => subscriptions[i]._id);
        await PushSubscription.deleteMany({ _id: { $in: failedSubscriptions } });
        logger.info(`Removed ${failedIndices.length} invalid push subscriptions from broadcast`);
      }
    }

    logger.info(`Broadcast push notification sent: ${sent} successful, ${failed} failed`);
    return { sent, failed };
  } catch (error) {
    logger.error('Error sending broadcast push notification', { error: error.message, stack: error.stack });
    return { sent: 0, failed: 0 };
  }
};

/**
 * Get notification title based on type
 */
const getNotificationTitle = (type) => {
  const titles = {
    'task_update': 'Task Updated',
    'task_created': 'New Task',
    'task_completed': 'Task Completed',
    'task': 'New Task',
    'general': 'Notification',
    'system': 'System Notification',
    'break': 'Break Alert',
    'announcement': 'Announcement',
    'leave': 'Leave Update',
    'leave_request': 'New Leave Request',
    'leave_approved': 'Leave Approved',
    'leave_rejected': 'Leave Rejected',
    'leave_manager_approved': 'Leave Approved by Manager',
    'payroll': 'Payroll Update',
    'new_employee': 'New Employee Joined 🎉',
    'holiday': 'Holiday Notice',
    'birthday': 'Birthday Celebration 🎂',
    'anniversary': 'Work Anniversary 🎉',
    'attendance': 'Attendance Update',
  };
  return titles[type] || 'Notification';
};

/**
 * Get notification URL based on type and metadata
 */
const getNotificationUrl = (type, metadata) => {
  const baseUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  
  switch (type) {
    case 'task_update':
    case 'task_created':
    case 'task_completed':
      return metadata.taskId ? `${baseUrl}/tasks/${metadata.taskId}` : `${baseUrl}/tasks`;
    case 'break':
      return `${baseUrl}/admin/dashboard`;
    case 'announcement':
      return `${baseUrl}/notifications`;
    case 'leave':
      return `${baseUrl}/employee/leave-attendance`;
    case 'payroll':
      return `${baseUrl}/employee/payroll`;
    case 'new_employee':
      return `${baseUrl}/admin/employees`;
    default:
      return `${baseUrl}/notifications`;
  }
};

/**
 * Create push notification payload
 */
export const createPushPayload = (message, type = 'general', metadata = {}) => {
  return {
    title: metadata.title || getNotificationTitle(type),
    body: message,
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    data: {
      url: getNotificationUrl(type, metadata),
      notificationId: metadata.notificationId,
      type: type,
      ...metadata
    },
    tag: type,
    requireInteraction: type === 'announcement' || type === 'system',
    vibrate: type === 'announcement' ? [200, 100, 200] : [200]
  };
};

