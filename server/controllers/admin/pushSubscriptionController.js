import PushSubscription from '../../models/pushSubscription.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';
import {
  sendPushNotification,
  createPushPayload,
  resolvePushIdentityIds,
} from '../../helpers/pushNotificationService.js';

/**
 * Get VAPID public key for client subscription
 */
export const getVapidPublicKey = (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    
    if (!publicKey || !privateKey) {
      return res.status(503).json({ 
        success: false, 
        message: 'Push notifications not configured. Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY on the server.' 
      });
    }

    res.json({ 
      success: true,
      publicKey: publicKey
    });
  } catch (error) {
    logger.error('Error getting VAPID public key', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Subscribe user to push notifications
 */
export const subscribe = async (req, res) => {
  try {
    let userId = req.user?._id || req.employee?._id;
    let userType = req.user ? 'User' : 'Employee';
    const { subscription } = req.body;
    let organizationId = req.user?.organizationId || req.employee?.organizationId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    // Prefer linked User._id when an employee has a user account so sends (which often
    // normalize to User ids) find this device. Delivery also expands identities as a backup.
    if (userType === 'Employee') {
      const employee = await Employee.findById(userId).select('userId organizationId').lean();
      if (employee?.userId) {
        userId = employee.userId;
        userType = 'User';
      }
      if (!organizationId && employee?.organizationId) {
        organizationId = employee.organizationId;
      }
    }

    // PushSubscription collection requires organizationId (multi-tenancy)
    if (!organizationId) {
      if (req.user?._id) {
        const user = await User.findById(req.user._id).select('organizationId').lean();
        organizationId = user?.organizationId;
      } else if (req.employee?._id) {
        const employee = await Employee.findById(req.employee._id).select('organizationId').lean();
        organizationId = employee?.organizationId;
      }
    }

    if (!organizationId) {
      return res.status(400).json({
        success: false,
        message: 'OrganizationId is required to save push subscription'
      });
    }

    if (!subscription || !subscription.endpoint || !subscription.keys) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid subscription object' 
      });
    }

    // Upsert by endpoint: one browser endpoint can only belong to one account.
    // Reassign when the same device switches users, or refresh keys for the same user.
    const existing = await PushSubscription.findOne({ endpoint: subscription.endpoint });

    if (existing) {
      existing.userId = userId;
      existing.userType = userType;
      existing.organizationId = organizationId;
      existing.keys = {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      };
      existing.userAgent = req.get('User-Agent');
      await existing.save();

      logger.info(`Push subscription updated for user ${userId} (${userType})`);
      return res.json({
        success: true,
        message: 'Subscription updated successfully'
      });
    }

    await PushSubscription.create({
      organizationId,
      userId,
      userType,
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      },
      userAgent: req.get('User-Agent')
    });

    logger.info(`Push subscription created for user ${userId} (${userType})`);
    res.json({
      success: true,
      message: 'Subscription saved successfully'
    });
  } catch (error) {
    logger.error('Error saving push subscription', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

/**
 * Unsubscribe user from push notifications
 */
export const unsubscribe = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    const { endpoint } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const identityIds = await resolvePushIdentityIds(userId);
    const result = await PushSubscription.deleteMany({
      userId: { $in: identityIds.length ? identityIds : [userId] },
      ...(endpoint ? { endpoint } : {})
    });

    logger.info(`Push subscription removed for user ${userId}: ${result.deletedCount} subscriptions`);
    res.json({ 
      success: true, 
      message: 'Unsubscribed successfully',
      deletedCount: result.deletedCount
    });
  } catch (error) {
    logger.error('Error removing push subscription', { error: error.message, stack: error.stack });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Get user's push subscription status
 */
export const getSubscriptionStatus = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const identityIds = await resolvePushIdentityIds(userId);
    const subscriptions = await PushSubscription.find({
      userId: { $in: identityIds.length ? identityIds : [userId] },
    }).select('endpoint createdAt userType');

    res.json({
      success: true,
      subscribed: subscriptions.length > 0,
      subscriptionCount: subscriptions.length,
      subscriptions: subscriptions
    });
  } catch (error) {
    logger.error('Error getting subscription status', { error: error.message });
    res.status(500).json({ 
      success: false, 
      message: error.message 
    });
  }
};

/**
 * Send a test push notification to the current user
 */
export const sendTestPush = async (req, res) => {
  try {
    const userId = req.user?._id || req.employee?._id;
    const userType = req.user ? 'User' : 'Employee';
    const organizationId =
      req.user?.organizationId ||
      req.employee?.organizationId ||
      req.organizationId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated',
      });
    }

    if (!organizationId) {
      if (req.user?._id) {
        const user = await User.findById(req.user._id).select('organizationId').lean();
        organizationId = user?.organizationId;
      } else if (req.employee?._id) {
        const employee = await Employee.findById(req.employee._id).select('organizationId').lean();
        organizationId = employee?.organizationId;
      }
    }

    const payload = createPushPayload(
      'Push notifications are working! You will receive alerts here.',
      'announcement',
      { test: true }
    );

    const result = await sendPushNotification(userId, userType, payload, organizationId);

    if (result.reason === 'VAPID_NOT_CONFIGURED') {
      return res.status(503).json({
        success: false,
        message: 'Push notifications not configured on server. Set VAPID keys and restart backend.',
        sent: 0,
        failed: 0,
      });
    }

    if (result.reason === 'NO_SUBSCRIPTION') {
      return res.status(404).json({
        success: false,
        message: 'No push subscription found. Enable push notifications first.',
        sent: 0,
        failed: 0,
      });
    }

    if (result.sent === 0 && result.failed === 0) {
      return res.status(500).json({
        success: false,
        message: 'Push notification could not be sent.',
        sent: 0,
        failed: 0,
      });
    }

    if (result.sent === 0) {
      return res.status(502).json({
        success: false,
        message: 'Push delivery failed. Check server logs for details.',
        sent: result.sent,
        failed: result.failed,
      });
    }

    res.json({
      success: true,
      message: 'Test push notification sent',
      sent: result.sent,
      failed: result.failed,
      devices: result.devices || [],
    });
  } catch (error) {
    logger.error('Error sending test push', { error: error.message, stack: error.stack });
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

