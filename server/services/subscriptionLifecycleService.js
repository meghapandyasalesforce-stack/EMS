/**
 * Daily subscription lifecycle:
 * - email ~3 days before subscriptionEndDate
 * - expire paid plans once subscriptionEndDate has passed
 */

import Organization from '../models/organization.model.js';
import {
  sendRenewalReminderEmail,
  sendSubscriptionExpiredEmail,
} from '../helpers/subscriptionEmail.js';
import logger from '../helpers/logger.js';

const PAID = ['basic', 'premium', 'enterprise'];

const sameInstant = (a, b) => {
  if (!a || !b) return false;
  return new Date(a).getTime() === new Date(b).getTime();
};

export const processSubscriptionLifecycle = async () => {
  const now = new Date();
  const inThreeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  const reminders = await Organization.find({
    deletedAt: null,
    subscriptionPlan: { $in: PAID },
    subscriptionStatus: 'active',
    subscriptionEndDate: { $gt: now, $lte: inThreeDays },
  });

  let reminded = 0;
  for (const org of reminders) {
    if (sameInstant(org.billingRenewalReminderFor, org.subscriptionEndDate)) continue;
    await sendRenewalReminderEmail(org);
    org.billingRenewalReminderFor = org.subscriptionEndDate;
    await org.save();
    reminded += 1;
  }

  const overdue = await Organization.find({
    deletedAt: null,
    subscriptionPlan: { $in: PAID },
    subscriptionStatus: { $in: ['active', 'past_due'] },
    subscriptionEndDate: { $ne: null, $lt: now },
  });

  let expired = 0;
  for (const org of overdue) {
    org.subscriptionStatus = 'expired';
    const alreadyNotified = sameInstant(org.billingExpiredNoticeFor, org.subscriptionEndDate);
    if (!alreadyNotified) {
      org.billingExpiredNoticeFor = org.subscriptionEndDate;
    }
    await org.save();
    if (!alreadyNotified) {
      await sendSubscriptionExpiredEmail(org);
    }
    expired += 1;
  }

  logger.info('Subscription lifecycle processed', {
    reminded,
    expired,
  });

  return { reminded, expired };
};

export default processSubscriptionLifecycle;
