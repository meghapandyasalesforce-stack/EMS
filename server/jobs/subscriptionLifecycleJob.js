/**
 * Daily job: renewal reminders and expire paid plans past subscriptionEndDate.
 */

import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { processSubscriptionLifecycle } from '../services/subscriptionLifecycleService.js';

export const scheduleSubscriptionLifecycleJobs = () => {
  cron.schedule('15 6 * * *', async () => {
    try {
      await processSubscriptionLifecycle();
    } catch (error) {
      logger.error('Subscription lifecycle job failed', { error: error.message });
    }
  });
  logger.info('Subscription lifecycle job scheduled (daily 06:15)');
};

export default scheduleSubscriptionLifecycleJobs;
