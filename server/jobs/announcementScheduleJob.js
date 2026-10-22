import cron from 'node-cron';
import Notification from '../models/notification.model.js';
import { deliverBroadcastChannels } from '../helpers/notificationService.js';
import logger from '../helpers/logger.js';

/**
 * Publish announcements whose scheduledFor time has passed.
 */
export async function processScheduledAnnouncements() {
  const due = await Notification.find({
    isBroadcast: true,
    type: 'announcement',
    broadcastStatus: 'scheduled',
    scheduledFor: { $lte: new Date() },
  }).limit(50);

  for (const item of due) {
    try {
      item.broadcastStatus = 'sent';
      const when = item.scheduledFor;
      item.scheduledFor = null;
      await item.save();
      await deliverBroadcastChannels(item, item.organizationId, 'announcement', {
        priority: item.priority,
      });
      logger.info('Scheduled announcement published', {
        notificationId: item._id,
        scheduledFor: when,
      });
    } catch (error) {
      logger.error('Failed to publish scheduled announcement', {
        notificationId: item._id,
        error: error.message,
      });
    }
  }

  return due.length;
}

export function scheduleAnnouncementJobs() {
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledAnnouncements();
    } catch (error) {
      logger.error('Announcement schedule cron error', { error: error.message });
    }
  });
  logger.info('Announcement schedule job registered (every minute)');
}

export default {
  scheduleAnnouncementJobs,
  processScheduledAnnouncements,
};
