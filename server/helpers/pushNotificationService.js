import webpush from 'web-push';
import PushSubscription from '../models/pushSubscription.model.js';
import logger from './logger.js';

// Configure VAPID details
const configureVAPID = () => {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || 'mailto:admin@example.com';

  if (!publicKey || !privateKey) {
    logger.warn('VAPID keys not configured. Push notifications will not work.');
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
};

// Initialize VAPID configuration
const vapidConfigured = configureVAPID();

/**
 * Send push notification to a specific user
 * @param {String|ObjectId} userId - User ID
 * @param {String} userType - 'User' or 'Employee'
 * @param {Object} payload - Notification payload
 * @returns {Promise<Object>} - { sent: number, failed: number }
 */
export const sendPushNotification = async (userId, userType, payload) => {
  if (!vapidConfigured) {
    logger.warn('VAPID not configured, skipping push notification');
    return { sent: 0, failed: 0 };
  }

  try {
    const subscriptions = await PushSubscription.find({ 
      userId, 
      userType 
    });

    if (subscriptions.length === 0) {
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

    // Remove failed subscriptions (expired or invalid)
    if (failed > 0) {
      const failedIndices = results
        .map((r, i) => r.status === 'rejected' ? i : -1)
        .filter(i => i !== -1);
      
      const failedSubscriptions = failedIndices.map(i => subscriptions[i]._id);
      await PushSubscription.deleteMany({ _id: { $in: failedSubscriptions } });
      
      logger.info(`Removed ${failed} invalid push subscriptions`);
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
 * @returns {Promise<Object>} - { sent: number, failed: number }
 */
export const sendBroadcastPushNotification = async (payload) => {
  if (!vapidConfigured) {
    logger.warn('VAPID not configured, skipping broadcast push notification');
    return { sent: 0, failed: 0 };
  }

  try {
    const subscriptions = await PushSubscription.find();
    
    if (subscriptions.length === 0) {
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

    // Remove failed subscriptions
    if (failed > 0) {
      const failedIndices = results
        .map((r, i) => r.status === 'rejected' ? i : -1)
        .filter(i => i !== -1);
      
      const failedSubscriptions = failedIndices.map(i => subscriptions[i]._id);
      await PushSubscription.deleteMany({ _id: { $in: failedSubscriptions } });
      
      logger.info(`Removed ${failed} invalid push subscriptions from broadcast`);
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
    'general': 'Notification',
    'system': 'System Notification',
    'break': 'Break Alert',
    'announcement': 'Announcement'
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
    default:
      return `${baseUrl}/notifications`;
  }
};

/**
 * Create push notification payload
 */
export const createPushPayload = (message, type = 'general', metadata = {}) => {
  return {
    title: getNotificationTitle(type),
    body: message,
    icon: '/logo192.png',
    badge: '/logo192.png',
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

