/**
 * Isolated notification event registry for Birthday & Work Anniversary v2 feature.
 * Does NOT modify notificationEventRegistry.js or existing event types.
 */

import { registerEvent } from './notificationManager.js';
import { formatCelebrationDateLabel } from './celebrationDateHelper.js';
import {
  resolveCelebrationNotificationRecipients,
  resolveWishNotificationRecipient,
} from './celebrationRecipientHelper.js';

const employeeFullName = (employee) =>
  `${employee?.name || ''} ${employee?.lastName || ''}`.trim();

const celebrationEventUrl = (metadata) =>
  metadata?.celebrationEventId ? `/celebrations/${metadata.celebrationEventId}` : '/celebrations';

registerEvent({
  type: 'celebration_birthday_upcoming',
  defaultTitle: '🎂 Upcoming Birthday',
  defaultType: 'birthday',
  defaultPriority: 'low',
  isBroadcast: false,
  recipientResolver: async ({ employee, organizationId }) =>
    resolveCelebrationNotificationRecipients(employee, organizationId),
  messageBuilder: ({ employee, targetMonth, targetDay }) => {
    const dateLabel = formatCelebrationDateLabel(targetMonth, targetDay);
    return `${employeeFullName(employee)}'s birthday is on ${dateLabel}, in 7 days.`;
  },
  metadataBuilder: ({ employee, targetMonth, targetDay, eventKey, celebrationEventId, year }) => ({
    employeeId: employee._id,
    employeeName: employeeFullName(employee),
    eventType: 'celebration_birthday_upcoming',
    source: 'celebration_v2',
    eventKey,
    targetMonth,
    targetDay,
    year,
    celebrationEventId,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});

registerEvent({
  type: 'celebration_birthday_today',
  defaultTitle: '🎉 Today is Birthday!',
  defaultType: 'birthday',
  defaultPriority: 'medium',
  isBroadcast: false,
  recipientResolver: async ({ employee, organizationId }) =>
    resolveCelebrationNotificationRecipients(employee, organizationId),
  messageBuilder: ({ employee }) => {
    const name = employeeFullName(employee);
    return `Send your wishes to ${name.split(' ')[0] || name}.`;
  },
  metadataBuilder: ({ employee, eventKey, celebrationEventId, year }) => ({
    employeeId: employee._id,
    employeeName: employeeFullName(employee),
    eventType: 'celebration_birthday_today',
    source: 'celebration_v2',
    eventKey,
    year,
    celebrationEventId,
    url: celebrationEventUrl({ celebrationEventId }),
    title: `🎉 Today is ${employeeFullName(employee)}'s Birthday!`,
  }),
});

registerEvent({
  type: 'celebration_anniversary_upcoming',
  defaultTitle: '🎉 Upcoming Work Anniversary',
  defaultType: 'anniversary',
  defaultPriority: 'low',
  isBroadcast: false,
  recipientResolver: async ({ employee, organizationId }) =>
    resolveCelebrationNotificationRecipients(employee, organizationId),
  messageBuilder: ({ employee, targetMonth, targetDay }) => {
    const dateLabel = formatCelebrationDateLabel(targetMonth, targetDay);
    return `${employeeFullName(employee)}'s work anniversary is on ${dateLabel}.`;
  },
  metadataBuilder: ({ employee, targetMonth, targetDay, eventKey, celebrationEventId, year }) => ({
    employeeId: employee._id,
    employeeName: employeeFullName(employee),
    eventType: 'celebration_anniversary_upcoming',
    source: 'celebration_v2',
    eventKey,
    targetMonth,
    targetDay,
    year,
    celebrationEventId,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});

registerEvent({
  type: 'celebration_anniversary_today',
  defaultTitle: '🎉 Work Anniversary',
  defaultType: 'anniversary',
  defaultPriority: 'medium',
  isBroadcast: false,
  recipientResolver: async ({ employee, organizationId }) =>
    resolveCelebrationNotificationRecipients(employee, organizationId),
  messageBuilder: ({ employee, completedYears }) =>
    `${employeeFullName(employee)} completes ${completedYears} year${completedYears === 1 ? '' : 's'} with the organization today!`,
  metadataBuilder: ({ employee, completedYears, eventKey, celebrationEventId, year }) => ({
    employeeId: employee._id,
    employeeName: employeeFullName(employee),
    eventType: 'celebration_anniversary_today',
    source: 'celebration_v2',
    eventKey,
    year,
    completedYears,
    celebrationEventId,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});

registerEvent({
  type: 'celebration_birthday_wish',
  defaultTitle: '💬 Birthday Wish',
  defaultType: 'birthday',
  defaultPriority: 'medium',
  isBroadcast: false,
  recipientResolver: async ({ subjectEmployeeId, organizationId }) => {
    const recipient = await resolveWishNotificationRecipient(subjectEmployeeId, organizationId);
    return recipient ? [recipient] : [];
  },
  messageBuilder: ({ commenterName, comment }) =>
    `${commenterName} sent you a birthday wish: "${comment}"`,
  metadataBuilder: ({ celebrationEventId, commenterEmployeeId, subjectEmployeeId, comment }) => ({
    celebrationEventId,
    commenterEmployeeId,
    subjectEmployeeId,
    comment,
    eventType: 'celebration_birthday_wish',
    source: 'celebration_v2',
    isPrivateWish: true,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});

registerEvent({
  type: 'celebration_anniversary_wish',
  defaultTitle: '💬 Anniversary Wish',
  defaultType: 'anniversary',
  defaultPriority: 'medium',
  isBroadcast: false,
  recipientResolver: async ({ subjectEmployeeId, organizationId }) => {
    const recipient = await resolveWishNotificationRecipient(subjectEmployeeId, organizationId);
    return recipient ? [recipient] : [];
  },
  messageBuilder: ({ commenterName, comment }) =>
    `${commenterName} sent you an anniversary wish: "${comment}"`,
  metadataBuilder: ({ celebrationEventId, commenterEmployeeId, subjectEmployeeId, comment }) => ({
    celebrationEventId,
    commenterEmployeeId,
    subjectEmployeeId,
    comment,
    eventType: 'celebration_anniversary_wish',
    source: 'celebration_v2',
    isPrivateWish: true,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});

registerEvent({
  type: 'celebration_marriage_anniversary_upcoming',
  defaultTitle: '💍 Upcoming Marriage Anniversary',
  defaultType: 'marriage_anniversary',
  defaultPriority: 'low',
  isBroadcast: false,
  recipientResolver: async ({ employee, organizationId }) =>
    resolveCelebrationNotificationRecipients(employee, organizationId),
  messageBuilder: ({ employee, targetMonth, targetDay }) => {
    const dateLabel = formatCelebrationDateLabel(targetMonth, targetDay);
    return `${employeeFullName(employee)}'s marriage anniversary is on ${dateLabel}, in 7 days.`;
  },
  metadataBuilder: ({ employee, targetMonth, targetDay, eventKey, celebrationEventId, year }) => ({
    employeeId: employee._id,
    employeeName: employeeFullName(employee),
    eventType: 'celebration_marriage_anniversary_upcoming',
    source: 'celebration_v2',
    eventKey,
    targetMonth,
    targetDay,
    year,
    celebrationEventId,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});

registerEvent({
  type: 'celebration_marriage_anniversary_today',
  defaultTitle: '💍 Today is Marriage Anniversary!',
  defaultType: 'marriage_anniversary',
  defaultPriority: 'medium',
  isBroadcast: false,
  recipientResolver: async ({ employee, organizationId }) =>
    resolveCelebrationNotificationRecipients(employee, organizationId),
  messageBuilder: ({ employee }) => {
    const name = employeeFullName(employee);
    return `Today is ${name}'s marriage anniversary. Send your wishes!`;
  },
  metadataBuilder: ({ employee, eventKey, celebrationEventId, year }) => ({
    employeeId: employee._id,
    employeeName: employeeFullName(employee),
    eventType: 'celebration_marriage_anniversary_today',
    source: 'celebration_v2',
    eventKey,
    year,
    celebrationEventId,
    url: celebrationEventUrl({ celebrationEventId }),
    title: `💍 Today is ${employeeFullName(employee)}'s Marriage Anniversary!`,
  }),
});

registerEvent({
  type: 'celebration_marriage_anniversary_wish',
  defaultTitle: '💬 Marriage Anniversary Wish',
  defaultType: 'marriage_anniversary',
  defaultPriority: 'medium',
  isBroadcast: false,
  recipientResolver: async ({ subjectEmployeeId, organizationId }) => {
    const recipient = await resolveWishNotificationRecipient(subjectEmployeeId, organizationId);
    return recipient ? [recipient] : [];
  },
  messageBuilder: ({ commenterName, comment }) =>
    `${commenterName} sent you a marriage anniversary wish: "${comment}"`,
  metadataBuilder: ({ celebrationEventId, commenterEmployeeId, subjectEmployeeId, comment }) => ({
    celebrationEventId,
    commenterEmployeeId,
    subjectEmployeeId,
    comment,
    eventType: 'celebration_marriage_anniversary_wish',
    source: 'celebration_v2',
    isPrivateWish: true,
    url: celebrationEventUrl({ celebrationEventId }),
  }),
});
