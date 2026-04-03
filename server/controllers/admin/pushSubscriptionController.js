import PushSubscription from '../../models/pushSubscription.model.js';
import User from '../../models/user.model.js';
import Employee from '../../models/employee.model.js';
import logger from '../../helpers/logger.js';

/**
 * Get VAPID public key for client subscription
 */
export const getVapidPublicKey = (req, res) => {
  try {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    
    if (!publicKey) {
      return res.status(503).json({ 
        success: false, 
        message: 'Push notifications not configured' 
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
    const userId = req.user?._id || req.employee?._id;
    const userType = req.user ? 'User' : 'Employee';
    const { subscription } = req.body;
    let organizationId = req.user?.organizationId || req.employee?.organizationId;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
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

    // Check if subscription already exists
    const existing = await PushSubscription.findOne({
      userId,
      userType,
      endpoint: subscription.endpoint
    });

    if (existing) {
      // Update existing subscription
      existing.keys = {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth
      };
      existing.organizationId = organizationId;
      existing.userAgent = req.get('User-Agent');
      await existing.save();

      return res.json({ 
        success: true, 
        message: 'Subscription updated successfully' 
      });
    }

    // Create new subscription
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
    const userType = req.user ? 'User' : 'Employee';
    const { endpoint } = req.body;

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const result = await PushSubscription.deleteMany({
      userId,
      userType,
      ...(endpoint ? { endpoint } : {})
    });

    logger.info(`Push subscription removed for user ${userId} (${userType}): ${result.deletedCount} subscriptions`);
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
    const userType = req.user ? 'User' : 'Employee';

    if (!userId) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not authenticated' 
      });
    }

    const subscriptions = await PushSubscription.find({
      userId,
      userType
    }).select('endpoint createdAt');

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

