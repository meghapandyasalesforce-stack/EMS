import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import logger from './logger.js';
import { notify } from './notificationManager.js';
import './celebrationEventRegistry.js';
import {
  buildCelebrationEventKey,
  daysUntilMonthDay,
  getCalendarMonthDay,
  getTodayPartsInTimezone,
  calculateCompletedYears,
  calculateMarriageCompletedYears,
} from './celebrationDateHelper.js';
import { getEffectiveTimezone } from './organizationTimezoneService.js';
import { ensureCelebrationEvent } from './celebrationEventService.js';

const NINE_AM_CHECK_INTERVAL_MS = 60 * 1000;
const CELEBRATION_NOTIFICATION_DAYS = new Set([0, 7]);
let schedulerStarted = false;
let lastRunKey = null;

const getEmployeeAnniversaryDate = (employee) => (
  employee.anniversaryDate ||
  employee.contactDetails?.anniversaryDate ||
  employee.personalDetails?.anniversaryDate ||
  employee.marriageDate ||
  null
);

const getEmployeeMaritalStatus = (employee) => (
  employee.maritalStatus ||
  employee.contactDetails?.maritalStatus ||
  employee.personalDetails?.maritalStatus ||
  null
);

const isMarriedOrUnset = (maritalStatus) => {
  if (!maritalStatus) return true;
  return String(maritalStatus).trim().toLowerCase() === 'married';
};

const toDateAtOrgDay = (parts, timezone) => {
  const date = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  return date;
};

const getNotificationType = (eventType, daysUntil) => {
  if (eventType === 'birthday') {
    return daysUntil === 0 ? 'celebration_birthday_today' : 'celebration_birthday_upcoming';
  }
  if (eventType === 'anniversary') {
    return daysUntil === 0 ? 'celebration_anniversary_today' : 'celebration_anniversary_upcoming';
  }
  if (eventType === 'marriage_anniversary') {
    return daysUntil === 0 ? 'celebration_marriage_anniversary_today' : 'celebration_marriage_anniversary_upcoming';
  }
  return null;
};

const notifyForCelebration = async ({ organizationId, employee, eventType, eventYear, eventDate, completedYears, targetMonth, targetDay, eventKey, daysUntil }) => {
  const notificationType = getNotificationType(eventType, daysUntil);
  if (!notificationType) return;

  const event = await ensureCelebrationEvent({
    organizationId,
    employee,
    type: eventType,
    eventYear,
    eventKey,
    eventDate,
    completedYears,
  });

  await notify({
    type: notificationType,
    organizationId,
    data: {
      employee,
      eventKey,
      year: eventYear,
      targetMonth,
      targetDay,
      completedYears,
      celebrationEventId: event?._id,
    },
  });
};

export const runCelebrationNotificationJob = async () => {
  const organizations = await Organization.find({}).select('_id').lean();

  for (const org of organizations) {
    const organizationId = org._id;
    const timezone = await getEffectiveTimezone(organizationId);
    const today = getTodayPartsInTimezone(timezone);

    const employees = await Employee.find({
      status: 'active',
      organizationId,
      $or: [
        { birthDate: { $exists: true, $ne: null } },
        { dateOfBirth: { $exists: true, $ne: null } },
        { dob: { $exists: true, $ne: null } },
        { joiningDate: { $exists: true, $ne: null } },
        { anniversaryDate: { $exists: true, $ne: null } },
        { marriageDate: { $exists: true, $ne: null } },
        { 'contactDetails.anniversaryDate': { $exists: true, $ne: null } },
        { 'personalDetails.anniversaryDate': { $exists: true, $ne: null } },
      ],
    }).select(`
      _id name lastName firstName fullName email organizationId department managerId userId functionalRoles position jobTitle profilePhoto avatar
      birthDate dateOfBirth dob joiningDate anniversaryDate marriageDate maritalStatus spouseName
      showMarriageAnniversary contactDetails personalDetails
    `);

    for (const employee of employees) {
      const birthdayDate = employee.birthDate || employee.dateOfBirth || employee.dob;
      if (birthdayDate) {
        const daysUntil = daysUntilMonthDay(birthdayDate, timezone);
        if (CELEBRATION_NOTIFICATION_DAYS.has(daysUntil)) {
          const parts = getCalendarMonthDay(birthdayDate, timezone);
          await notifyForCelebration({
            organizationId,
            employee,
            eventType: 'birthday',
            eventYear: today.year,
            eventDate: toDateAtOrgDay(today, timezone),
            targetMonth: parts?.month,
            targetDay: parts?.day,
            eventKey: buildCelebrationEventKey(`birthday-${daysUntil === 0 ? 'today' : 'upcoming'}`, employee._id.toString(), today.year),
            daysUntil,
          });
        }
      }

      if (employee.joiningDate) {
        const daysUntil = daysUntilMonthDay(employee.joiningDate, timezone);
        if (CELEBRATION_NOTIFICATION_DAYS.has(daysUntil)) {
          const completedYears = calculateCompletedYears(employee.joiningDate, today.year, timezone);
          if (completedYears >= 1) {
            const parts = getCalendarMonthDay(employee.joiningDate, timezone);
            await notifyForCelebration({
              organizationId,
              employee,
              eventType: 'anniversary',
              eventYear: today.year,
              eventDate: toDateAtOrgDay(today, timezone),
              completedYears,
              targetMonth: parts?.month,
              targetDay: parts?.day,
              eventKey: buildCelebrationEventKey(`anniversary-${daysUntil === 0 ? 'today' : 'upcoming'}`, employee._id.toString(), today.year),
              daysUntil,
            });
          }
        }
      }

      const weddingDate = getEmployeeAnniversaryDate(employee);
      const maritalStatus = getEmployeeMaritalStatus(employee);
      if (weddingDate && isMarriedOrUnset(maritalStatus) && employee.showMarriageAnniversary !== false) {
        const daysUntil = daysUntilMonthDay(weddingDate, timezone);
        if (CELEBRATION_NOTIFICATION_DAYS.has(daysUntil)) {
          const completedYears = calculateMarriageCompletedYears(weddingDate, today.year, timezone);
          if (completedYears >= 1) {
            const parts = getCalendarMonthDay(weddingDate, timezone);
            await notifyForCelebration({
              organizationId,
              employee,
              eventType: 'marriage_anniversary',
              eventYear: today.year,
              eventDate: toDateAtOrgDay(today, timezone),
              completedYears,
              targetMonth: parts?.month,
              targetDay: parts?.day,
              eventKey: buildCelebrationEventKey(`marriage-anniversary-${daysUntil === 0 ? 'today' : 'upcoming'}`, employee._id.toString(), today.year),
              daysUntil,
            });
          }
        }
      }
    }
  }
};

export const startCelebrationNotificationScheduler = () => {
  if (schedulerStarted) return;
  schedulerStarted = true;

  setInterval(async () => {
    const now = new Date();
    const istNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
    const runKey = istNow.toISOString().slice(0, 10);

    if (istNow.getHours() !== 9 || istNow.getMinutes() !== 0 || lastRunKey === runKey) {
      return;
    }

    lastRunKey = runKey;
    try {
      logger.info('Running 9 AM celebration notification scheduler', { runKey });
      await runCelebrationNotificationJob();
    } catch (error) {
      logger.error('Celebration notification scheduler failed', { error: error.message, stack: error.stack });
    }
  }, NINE_AM_CHECK_INTERVAL_MS);

  logger.info('Celebration notification scheduler started');
};

export default startCelebrationNotificationScheduler;
