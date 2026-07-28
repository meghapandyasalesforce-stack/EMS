/**
 * Centralized Notification Manager
 * Single entry point for all application notifications
 * Uses event registry pattern for scalable, maintainable notification handling
 */

import logger from './logger.js';
import { sendNotification, sendBroadcastNotification } from './notificationService.js';
import { getCachedEffectiveTimezone } from './orgContextCache.js';

// Event registry - maps event types to their configuration and handlers
const eventRegistry = new Map();

/**
 * Register a new event type
 * @param {Object} config - Event configuration
 * @param {string} config.type - Event type identifier (e.g., 'leave_applied')
 * @param {string} config.defaultTitle - Default notification title
 * @param {string} config.defaultType - Default notification type for the model
 * @param {string} config.defaultPriority - Default priority (low, medium, high)
 * @param {Function} config.recipientResolver - Function to resolve recipients
 * @param {Function} config.messageBuilder - Function to build notification message
 * @param {Function} config.metadataBuilder - Function to build metadata
 * @param {boolean} config.isBroadcast - Whether this is a broadcast event
 */
export const registerEvent = (config) => {
  const {
    type,
    defaultTitle,
    defaultType = 'general',
    defaultPriority = 'medium',
    recipientResolver,
    messageBuilder,
    metadataBuilder,
    isBroadcast = false
  } = config;

  eventRegistry.set(type, {
    type,
    defaultTitle,
    defaultType,
    defaultPriority,
    recipientResolver,
    messageBuilder,
    metadataBuilder,
    isBroadcast
  });

  logger.info('Event registered in notification manager', { type });
};

/**
 * Get event configuration by type
 * @param {string} eventType - Event type
 * @returns {Object|null} Event configuration or null if not found
 */
const getEventConfig = (eventType) => {
  return eventRegistry.get(eventType) || null;
};

/**
 * Resolve recipients for an event
 * @param {Object} eventConfig - Event configuration
 * @param {Object} eventData - Event data
 * @returns {Promise<Array>} Array of recipient IDs
 */
const resolveRecipients = async (eventConfig, eventData) => {
  if (eventConfig.recipientResolver) {
    return await eventConfig.recipientResolver(eventData);
  }
  return eventData.recipients || [];
};

/**
 * Build notification message
 * @param {Object} eventConfig - Event configuration
 * @param {Object} eventData - Event data
 * @returns {string} Notification message
 */
const buildMessage = (eventConfig, eventData) => {
  if (eventConfig.messageBuilder) {
    return eventConfig.messageBuilder(eventData);
  }
  return eventData.message || eventConfig.defaultTitle;
};

/**
 * Build notification metadata
 * @param {Object} eventConfig - Event configuration
 * @param {Object} eventData - Event data
 * @returns {Object} Metadata object
 */
const buildMetadata = (eventConfig, eventData) => {
  if (eventConfig.metadataBuilder) {
    return eventConfig.metadataBuilder(eventData);
  }
  return eventData.data || eventData.metadata || {};
};

/**
 * Deduplicate recipients
 * @param {Array} recipients - Array of recipient IDs
 * @returns {Array} Deduplicated array
 */
const deduplicateRecipients = (recipients) => {
  return [...new Set(recipients.map(r => r.toString()))];
};

const resolveSender = ({ senderId, senderType, data = {} }) => {
  if (senderId) {
    return { senderId, senderType: senderType || 'User' };
  }
  if (data.employee?._id) {
    return { senderId: data.employee._id, senderType: 'Employee' };
  }
  if (data.sender?._id) {
    return {
      senderId: data.sender._id,
      senderType: data.senderType || data.sender.constructor?.modelName || 'User'
    };
  }
  return { senderId: null, senderType: null };
};

/**
 * Main notification function - single entry point for all notifications
 * @param {Object} params - Notification parameters
 * @param {string} params.type - Event type (must be registered)
 * @param {Array} params.recipients - Recipient IDs (optional if recipientResolver is configured)
 * @param {string} params.title - Notification title (optional, uses default if not provided)
 * @param {string} params.message - Notification message (optional, uses messageBuilder if not provided)
 * @param {string} params.priority - Notification priority (optional, uses default if not provided)
 * @param {Object} params.data - Additional data for message/metadata builders
 * @param {Object} params.metadata - Additional metadata (optional, uses metadataBuilder if not provided)
 * @param {string} params.organizationId - Organization ID (required)
 * @param {string} params.senderId - Sender ID (optional)
 * @param {string} params.senderType - Sender type (optional)
 * @returns {Promise<Object>} Result object with success status and details
 */
export const notify = async (params) => {
  const {
    type,
    recipients: providedRecipients,
    title,
    message: providedMessage,
    priority,
    data = {},
    metadata: providedMetadata,
    organizationId,
    senderId,
    senderType
  } = params;

  try {
    // Validate event type
    const eventConfig = getEventConfig(type);
    if (!eventConfig) {
      logger.error('Unknown event type in notification manager', { type });
      throw new Error(`Unknown event type: ${type}. Event must be registered first.`);
    }

    // Validate organizationId
    if (!organizationId) {
      logger.error('OrganizationId missing in notification manager', { type });
      throw new Error('OrganizationId is required for notifications');
    }

    // Configure SSOT — skip lifecycle notifications when the related feature is disabled
    try {
      const { resolveNotificationFeatureKey } = await import('../constants/lifecycleNotificationFeatureMap.js');
      const featureKey = resolveNotificationFeatureKey(type, data);
      if (featureKey) {
        const { isOrgFeatureEnabled } = await import('../services/lifecycleConfigService.js');
        const enabled = await isOrgFeatureEnabled(organizationId, featureKey);
        if (!enabled) {
          logger.info('Skipping notification — feature disabled in Configure', { type, featureKey, organizationId });
          return { success: true, notified: 0, skipped: true, reason: 'FEATURE_DISABLED', featureKey };
        }
      }
    } catch (gateError) {
      logger.warn('Lifecycle notification feature gate check failed; continuing', {
        type,
        error: gateError.message,
      });
    }

    logger.info('Processing notification event', { type, organizationId, hasData: !!data, dataKeys: Object.keys(data) });

    // Resolve recipients
    const resolvedRecipients = await resolveRecipients(eventConfig, { ...data, recipients: providedRecipients, organizationId });
    const recipients = deduplicateRecipients(resolvedRecipients);

    logger.info('Recipients resolved', { type, recipientCount: recipients.length, recipients });

    if (!eventConfig.isBroadcast && recipients.length === 0) {
      logger.warn('No recipients found for notification', { type });
      return { success: true, notified: 0, message: 'No recipients to notify' };
    }

    // Resolve org timezone so message builders don't use the server process TZ
    const timezone = await getCachedEffectiveTimezone(organizationId);
    const eventData = { ...data, organizationId, timezone };

    // Build message and metadata
    const message = providedMessage || buildMessage(eventConfig, eventData);
    const metadata = buildMetadata(eventConfig, { ...eventData, metadata: providedMetadata });
    const notificationTitle = title || eventConfig.defaultTitle;
    const notificationPriority = priority || eventConfig.defaultPriority;
    const { senderId: resolvedSenderId, senderType: resolvedSenderType } = resolveSender({
      senderId,
      senderType,
      data
    });

    logger.info('Sending notifications', { type, recipientCount: recipients.length, isBroadcast: eventConfig.isBroadcast });

    // Send notifications
    if (eventConfig.isBroadcast) {
      const sender = senderId
        ? { _id: senderId, organizationId, constructor: { modelName: senderType || 'User' } }
        : { _id: null, organizationId, constructor: { modelName: 'User' } };

      await sendBroadcastNotification(
        sender,
        message,
        eventConfig.defaultType,
        {
          ...metadata,
          title: notificationTitle,
          priority: notificationPriority,
          organizationId
        }
      );
    } else {
      for (const recipientId of recipients) {
        try {
          await sendNotification({
            userId: recipientId,
            title: notificationTitle,
            message,
            type: eventConfig.defaultType,
            priority: notificationPriority,
            metadata,
            organizationId,
            senderId: resolvedSenderId,
            senderType: resolvedSenderType
          });
        } catch (error) {
          logger.error('Error sending notification to recipient', { type, recipientId, error: error.message });
        }
      }
    }

    logger.info('Notification event processed successfully', {
      type,
      recipientCount: eventConfig.isBroadcast ? 'broadcast' : recipients.length,
      isBroadcast: eventConfig.isBroadcast
    });

    return {
      success: true,
      notified: eventConfig.isBroadcast ? 'broadcast' : recipients.length
    };
  } catch (error) {
    logger.error('Error in notification manager', {
      type,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }
};

/**
 * Get all registered event types
 * @returns {Array<string>} Array of registered event types
 */
export const getRegisteredEventTypes = () => {
  return Array.from(eventRegistry.keys());
};

/**
 * Check if an event type is registered
 * @param {string} type - Event type
 * @returns {boolean} Whether the event is registered
 */
export const isEventRegistered = (type) => {
  return eventRegistry.has(type);
};

export default {
  notify,
  registerEvent,
  getRegisteredEventTypes,
  isEventRegistered
};
