import webpush from 'web-push';
import mongoose from 'mongoose';
import PushSubscription from '../models/pushSubscription.model.js';
import User from '../models/user.model.js';
import Employee from '../models/employee.model.js';
import NotificationSettings from '../models/notificationSettings.model.js';
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
 * Resolve all linked identity IDs for push lookup.
 * Subscriptions may be stored under Employee._id while sends use User._id (or vice versa).
 */
export async function resolvePushIdentityIds(userId) {
  if (!userId) return [];
  const primary = userId.toString();
  const ids = new Set([primary]);

  try {
    const [asEmployee, linkedByUser, asUser] = await Promise.all([
      Employee.findById(primary).select('_id userId').lean(),
      Employee.findOne({ userId: primary }).select('_id userId').lean(),
      User.findById(primary).select('_id').lean(),
    ]);

    if (asEmployee) {
      ids.add(asEmployee._id.toString());
      if (asEmployee.userId) ids.add(asEmployee.userId.toString());
    }
    if (linkedByUser) {
      ids.add(linkedByUser._id.toString());
      if (linkedByUser.userId) ids.add(linkedByUser.userId.toString());
    }
    if (asUser) {
      ids.add(asUser._id.toString());
    }
  } catch (error) {
    logger.warn('Failed to resolve push identity ids', {
      userId: primary,
      error: error.message,
    });
  }

  return [...ids];
}

/**
 * Whether push is allowed for this person (checks settings under User and Employee ids).
 * Default is enabled when no settings document exists.
 */
export async function isPushEnabledForUser(userId) {
  if (!userId) return false;
  try {
    const identityIds = await resolvePushIdentityIds(userId);
    const settings = await NotificationSettings.findOne({
      user: { $in: identityIds.length ? identityIds : [userId] },
    }).select('pushNotifications').lean();
    return !settings || settings.pushNotifications !== false;
  } catch (error) {
    logger.warn('isPushEnabledForUser failed — allowing push', {
      userId: userId?.toString?.() || userId,
      error: error.message,
    });
    return true;
  }
}

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

/** Normalize org id for reliable PushSubscription queries (ObjectId vs string mismatches). */
const normalizeOrgId = (organizationId) => {
  if (!organizationId) return null;
  const raw = organizationId._id || organizationId;
  const asString = raw?.toString?.() || String(raw);
  if (!mongoose.Types.ObjectId.isValid(asString)) return null;
  return new mongoose.Types.ObjectId(asString);
};

/**
 * Keep push `data` small and JSON-safe. Spreading full leave/employee docs
 * can exceed FCM size limits or break JSON.stringify — test pushes stay small,
 * so they work while real events fail.
 */
const buildSafePushData = (metadata = {}, type, clickPath) => {
  const data = {
    type,
    url: clickPath,
  };

  for (const [key, value] of Object.entries(metadata || {})) {
    if (value == null) continue;
    if (key === 'url') continue;

    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      data[key] = value;
      continue;
    }
    if (value instanceof Date) {
      data[key] = value.toISOString();
      continue;
    }
    if (typeof value === 'object') {
      if (value._bsontype === 'ObjectId' || value.constructor?.name === 'ObjectId') {
        data[key] = value.toString();
        continue;
      }
      if (typeof value.toString === 'function' && mongoose.Types.ObjectId.isValid(value.toString())) {
        // Likely an ObjectId-like value
        const asStr = value.toString();
        if (/^[a-fA-F0-9]{24}$/.test(asStr)) {
          data[key] = asStr;
        }
      }
    }
  }

  if (metadata.notificationId != null) {
    data.notificationId = metadata.notificationId.toString?.() || String(metadata.notificationId);
  }

  return data;
};

const findSubscriptionsForOrganization = async (organizationId) => {
  const orgOid = normalizeOrgId(organizationId);
  if (!orgOid) return [];

  let subscriptions = await PushSubscription.find({ organizationId: orgOid });

  // Fallback for legacy rows stored with a string organizationId
  if (subscriptions.length === 0) {
    subscriptions = await PushSubscription.find({
      $expr: { $eq: [{ $toString: '$organizationId' }, orgOid.toString()] },
    });
  }

  return subscriptions;
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
    const identityIds = await resolvePushIdentityIds(userId);
    if (identityIds.length === 0) {
      return { sent: 0, failed: 0, reason: 'NO_SUBSCRIPTION' };
    }

    const orgOid = normalizeOrgId(organizationId);
    let query = { userId: { $in: identityIds } };
    if (orgOid) {
      query.organizationId = orgOid;
    }
    let subscriptions = await PushSubscription.find(query);

    if (subscriptions.length === 0 && orgOid) {
      subscriptions = await PushSubscription.find({ userId: { $in: identityIds } });
    }

    logger.info('Push subscriptions found for userId', {
      userId,
      identityIds,
      subscriptionCount: subscriptions.length,
      userTypes: subscriptions.map(s => s.userType)
    });

    if (subscriptions.length === 0) {
      logger.warn('No push subscriptions found for user', { userId, identityIds });
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
    return { sent: 0, failed: 0, reason: 'VAPID_NOT_CONFIGURED' };
  }

  try {
    const orgOid = normalizeOrgId(organizationId);
    if (!orgOid) {
      logger.warn('Broadcast push skipped — invalid organizationId', { organizationId });
      return { sent: 0, failed: 0, reason: 'INVALID_ORG' };
    }

    const subscriptions = await findSubscriptionsForOrganization(orgOid);

    logger.info('Broadcast push subscriptions resolved', {
      organizationId: orgOid.toString(),
      subscriptionCount: subscriptions.length,
      devices: subscriptions.map((s) => ({
        userId: s.userId?.toString?.(),
        userType: s.userType,
        isMobile: /Android|iPhone|iPad|Mobile/i.test(s.userAgent || ''),
      })),
    });

    if (subscriptions.length === 0) {
      logger.warn('No push subscriptions found for organization', {
        organizationId: orgOid.toString(),
      });
      return { sent: 0, failed: 0, reason: 'NO_SUBSCRIPTION' };
    }

    const results = await Promise.allSettled(
      subscriptions.map((subscription) => {
        const subscriptionObj = {
          endpoint: subscription.endpoint,
          keys: {
            p256dh: subscription.keys.p256dh,
            auth: subscription.keys.auth,
          },
        };

        return webpush.sendNotification(
          subscriptionObj,
          JSON.stringify(payload),
          PUSH_SEND_OPTIONS
        );
      })
    );

    const sent = results.filter((r) => r.status === 'fulfilled').length;
    const failed = results.filter((r) => r.status === 'rejected').length;

    if (failed > 0) {
      const failedIndices = [];
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          const statusCode = result.reason?.statusCode;
          logger.error('Broadcast push delivery failed', {
            endpoint: subscriptions[index]?.endpoint,
            userId: subscriptions[index]?.userId?.toString?.(),
            statusCode,
            error: result.reason?.message || String(result.reason),
          });
          if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
            failedIndices.push(index);
          }
        }
      });

      if (failedIndices.length > 0) {
        const failedSubscriptions = failedIndices.map((i) => subscriptions[i]._id);
        await PushSubscription.deleteMany({ _id: { $in: failedSubscriptions } });
        logger.info(`Removed ${failedIndices.length} invalid push subscriptions from broadcast`);
      }
    }

    logger.info(`Broadcast push notification sent: ${sent} successful, ${failed} failed`);
    return { sent, failed };
  } catch (error) {
    logger.error('Error sending broadcast push notification', {
      error: error.message,
      stack: error.stack,
    });
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
    'punch_out': 'Attendance Update',
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
    'marriage_anniversary': 'Marriage Anniversary 💍',
    'attendance': 'Attendance Update',
    'attendance_regularization': 'Attendance Regularization',
    'attendance_regularization_request': 'Attendance Regularization Request',
    'attendance_regularization_approved': 'Attendance Regularization Approved',
    'attendance_regularization_rejected': 'Attendance Regularization Rejected',
    'onboarding': 'Onboarding Update',
    'celebration_birthday_upcoming': 'Upcoming Birthday',
    'celebration_birthday_today': 'Birthday Today',
    'celebration_anniversary_upcoming': 'Upcoming Work Anniversary',
    'celebration_anniversary_today': 'Work Anniversary Today',
    'celebration_marriage_anniversary_upcoming': 'Upcoming Marriage Anniversary',
    'celebration_marriage_anniversary_today': 'Marriage Anniversary Today',
    'celebration_birthday_wish': 'Birthday Wish',
    'celebration_anniversary_wish': 'Anniversary Wish',
    'celebration_marriage_anniversary_wish': 'Marriage Anniversary Wish',
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
      return '/employee/calendar';
    case 'birthday':
    case 'anniversary':
    case 'marriage_anniversary':
    case 'celebration_birthday_upcoming':
    case 'celebration_birthday_today':
    case 'celebration_anniversary_upcoming':
    case 'celebration_anniversary_today':
    case 'celebration_marriage_anniversary_upcoming':
    case 'celebration_marriage_anniversary_today':
    case 'celebration_birthday_wish':
    case 'celebration_anniversary_wish':
    case 'celebration_marriage_anniversary_wish':
      if (metadata.celebrationEventId) {
        return `/celebrations/${metadata.celebrationEventId}`;
      }
      return '/celebrations';
    case 'announcement':
    case 'general':
    case 'system':
      if (metadata?.url) return metadata.url;
      if (metadata?.oneOnOneId || metadata?.type === 'one_on_one') {
        return metadata.oneOnOneId
          ? `/one-on-one?meetingId=${metadata.oneOnOneId}`
          : '/one-on-one';
      }
      return '/notifications';
    default:
      if (metadata?.url) return metadata.url;
      if (metadata?.oneOnOneId) {
        return `/one-on-one?meetingId=${metadata.oneOnOneId}`;
      }
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
  const notificationId =
    metadata.notificationId?.toString?.() || metadata.notificationId || Date.now();
  const uniqueTag = `${type}-${notificationId}`;
  const typeTitle = metadata.title || getNotificationTitle(type);
  const bodyText = message || typeTitle;
  const clickPath = toAppPath(metadata.url, type, metadata);

  // Never send localhost/http icon URLs — Android Chrome often fails to show the
  // notification when the icon cannot be fetched from the phone. The service worker
  // always falls back to same-origin /logo192.png.
  const isUnreachableFromPhone =
    !origin ||
    /^http:\/\//i.test(origin) ||
    /localhost|127\.0\.0\.1/i.test(origin);

  const payload = {
    title: 'Paarsiv',
    body: typeTitle && typeTitle !== bodyText ? `${typeTitle} — ${bodyText}` : bodyText,
    data: buildSafePushData(metadata, type, clickPath),
    tag: uniqueTag,
    renotify: true,
    // requireInteraction is unreliable on Android; keep false for mobile delivery
    requireInteraction: false,
    vibrate: [200, 100, 200],
  };

  if (!isUnreachableFromPhone) {
    payload.icon = `${origin}/logo192.png`;
    payload.badge = `${origin}/logo192.png`;
  }

  return payload;
};

