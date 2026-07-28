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

/**
 * Public https origin for notification icons/links.
 * Avoids localhost URLs on mobile (breaks icons/clicks on real devices).
 */
const getPublicOrigin = () => {
  const candidates = [
    process.env.PUBLIC_APP_URL,
    process.env.FRONTEND_URL,
    process.env.CLIENT_URL,
    ...(process.env.ALLOWED_ORIGINS || '').split(','),
  ]
    .map((value) => (value || '').trim().replace(/\/$/, ''))
    .filter(Boolean);

  const httpsPublic = candidates.find(
    (origin) =>
      origin.startsWith('https://') &&
      !/localhost|127\.0\.0\.1/i.test(origin)
  );
  if (httpsPublic) return httpsPublic;

  return candidates[0] || 'http://localhost:5173';
};

const PUSH_SEND_OPTIONS = {
  TTL: 60 * 60 * 24,
  urgency: 'high',
  headers: {
    Urgency: 'high',
  },
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
    payloadTitle: payload.title,
    organizationId
  });

  try {
    // Prefer userId + org filter; if org filter yields nothing, fall back to userId only
    // so devices subscribed under a slightly different org cast still receive pushes.
    let query = { userId };
    if (organizationId) {
      query.organizationId = organizationId;
    }
    let subscriptions = await PushSubscription.find(query);

    if (subscriptions.length === 0 && organizationId) {
      subscriptions = await PushSubscription.find({ userId });
    }

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
          JSON.stringify(payload),
          PUSH_SEND_OPTIONS
        );
      })
    );

    const deviceResults = results.map((result, index) => {
      const sub = subscriptions[index];
      const isMobile = /Android|iPhone|iPad|Mobile/i.test(sub.userAgent || '');
      if (result.status === 'fulfilled') {
        return {
          id: sub._id,
          device: isMobile ? 'mobile' : 'desktop',
          userAgent: sub.userAgent,
          status: 'sent',
          statusCode: result.value?.statusCode || 201,
        };
      }
      const statusCode = result.reason?.statusCode;
      return {
        id: sub._id,
        device: isMobile ? 'mobile' : 'desktop',
        userAgent: sub.userAgent,
        status: 'failed',
        statusCode,
        error: result.reason?.message || String(result.reason),
      };
    });

    const sent = deviceResults.filter(r => r.status === 'sent').length;
    const failed = deviceResults.filter(r => r.status === 'failed').length;

    // Remove expired/invalid subscriptions (404/410) and unauthorized/VAPID mismatch (403)
    if (failed > 0) {
      const failedIndices = [];
      deviceResults.forEach((deviceResult, index) => {
        if (deviceResult.status === 'failed') {
          logger.error('Push notification delivery failed', {
            userId,
            userType,
            endpoint: subscriptions[index]?.endpoint,
            device: deviceResult.device,
            statusCode: deviceResult.statusCode,
            error: deviceResult.error,
          });
          if (
            deviceResult.statusCode === 404 ||
            deviceResult.statusCode === 410 ||
            deviceResult.statusCode === 403
          ) {
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

    logger.info(`Push notification sent: ${sent} successful, ${failed} failed`, {
      devices: deviceResults.map(d => ({ device: d.device, status: d.status, statusCode: d.statusCode })),
    });
    return { sent, failed, devices: deviceResults };
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
          JSON.stringify(payload),
          PUSH_SEND_OPTIONS
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
          if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
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
    'task_assigned': 'Task Assigned',
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
    'attendance_regularization': 'Attendance Regularization',
    'attendance_regularization_request': 'Attendance Regularization Request',
    'attendance_regularization_approved': 'Attendance Regularization Approved',
    'attendance_regularization_rejected': 'Attendance Regularization Rejected',
    'onboarding': 'Onboarding Update',
  };
  return titles[type] || 'Notification';
};

/**
 * Get in-app path for notification click (path-only so SW uses current origin).
 * Avoids hardcoded localhost / wrong host opening the wrong page.
 */
const getNotificationUrl = (type, metadata = {}) => {
  switch (type) {
    case 'task':
    case 'task_update':
    case 'task_created':
    case 'task_assigned':
    case 'task_completed':
      if (metadata.projectId) return `/employee/projects/${metadata.projectId}`;
      return '/employee/projects';
    case 'break':
    case 'punch_out':
    case 'attendance':
      return '/attendance';
    case 'leave_request':
    case 'leave_manager_approved':
      return '/leave-management';
    case 'leave':
    case 'leave_approved':
    case 'leave_rejected':
      return '/employee/leave-attendance';
    case 'payroll':
      return '/employee-payroll';
    case 'new_employee':
      return '/employees';
    case 'attendance_regularization':
    case 'attendance_regularization_request':
      return '/attendance-regularization';
    case 'attendance_regularization_approved':
    case 'attendance_regularization_rejected':
      return '/employee/leave-attendance';
    case 'onboarding':
      return metadata.workflowId
        ? `/onboarding?id=${metadata.workflowId}`
        : '/onboarding';
    case 'holiday':
    case 'birthday':
    case 'anniversary':
      return '/employee/calendar';
    case 'announcement':
    case 'general':
    case 'system':
    default:
      return '/notifications';
  }
};

/** Normalize click target to a same-origin path. */
const toAppPath = (raw, type, metadata) => {
  const fallback = getNotificationUrl(type, metadata);
  const value = (raw || fallback || '/notifications').trim();
  try {
    if (/^https?:\/\//i.test(value)) {
      const parsed = new URL(value);
      return `${parsed.pathname}${parsed.search}` || fallback;
    }
  } catch {
    return fallback;
  }
  return value.startsWith('/') ? value : `/${value}`;
};

/**
 * Create push notification payload
 * Brand as Paarsiv; path-only click URL so the correct page opens on this origin.
 */
export const createPushPayload = (message, type = 'general', metadata = {}) => {
  const origin = getPublicOrigin();
  const icon = `${origin}/logo192.png`;
  const uniqueTag = `${type}-${metadata.notificationId || Date.now()}`;
  const typeTitle = metadata.title || getNotificationTitle(type);
  const bodyText = message || typeTitle;
  const clickPath = toAppPath(metadata.url, type, metadata);

  return {
    title: 'Paarsiv',
    body: typeTitle && typeTitle !== bodyText ? `${typeTitle} — ${bodyText}` : bodyText,
    icon,
    badge: icon,
    data: {
      ...metadata,
      notificationId: metadata.notificationId,
      type,
      url: clickPath,
    },
    tag: uniqueTag,
    renotify: true,
    // requireInteraction is unreliable on Android; keep false for mobile delivery
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };
};

