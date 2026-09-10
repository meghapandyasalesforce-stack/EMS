import cron from 'node-cron';
import { DateTime } from 'luxon';
import Organization from '../models/organization.model.js';
import CelebrationNotificationLog from '../models/celebrationNotificationLog.model.js';
import { notify } from '../helpers/notificationManager.js';
import '../helpers/celebrationEventRegistry.js';
import {
  getTodayPartsInTimezone,
  getDatePartsDaysFromToday,
  matchesMonthDay,
  calculateCompletedYears,
  calculateMarriageCompletedYears,
  buildCelebrationEventKey,
  hasReachedOrgNineAm,
} from '../helpers/celebrationDateHelper.js';
import { loadCelebrationEmployees } from '../helpers/celebrationRecipientHelper.js';
import { ensureCelebrationEvent } from '../helpers/celebrationEventService.js';
import { getEffectiveTimezone } from '../helpers/organizationTimezoneService.js';
import logger from '../helpers/logger.js';

const processedOrgDays = new Set();

/**
 * Record notification dispatch — returns false if already processed (idempotent).
 */
async function claimNotificationSlot(organizationId, eventKey, payload) {
  try {
    await CelebrationNotificationLog.create({
      organizationId,
      eventKey,
      ...payload,
    });
    return true;
  } catch (error) {
    if (error?.code === 11000) return false;
    throw error;
  }
}

async function sendCelebrationNotification({
  type,
  organizationId,
  employee,
  data,
  eventKey,
  notificationKind,
  year,
  celebrationEventId,
}) {
  const claimed = await claimNotificationSlot(organizationId, eventKey, {
    employeeId: employee._id,
    notificationKind,
    year,
    celebrationEventId,
  });
  if (!claimed) {
    logger.debug('Celebration notification already sent', { eventKey, organizationId });
    return;
  }

  try {
    await notify({
      type,
      organizationId,
      title: data.title,
      data: {
        ...data,
        employee,
        eventKey,
        year,
        celebrationEventId,
      },
    });
  } catch (error) {
    await CelebrationNotificationLog.deleteOne({ organizationId, eventKey });
    throw error;
  }

  logger.info('Celebration notification sent', {
    type,
    eventKey,
    organizationId,
    employeeId: employee._id,
  });
}

async function processBirthdaysForOrg(organizationId, timezone, today, inSevenDays) {
  const employees = await loadCelebrationEmployees(organizationId);

  for (const employee of employees) {
    if (!employee.birthDate) continue;

    const empId = employee._id.toString();

    // Upcoming birthday — exactly 7 days before
    if (matchesMonthDay(employee.birthDate, inSevenDays.month, inSevenDays.day, timezone)) {
      const eventKey = buildCelebrationEventKey('birthday-upcoming', empId, inSevenDays.year);
      const eventDate = DateTime.fromObject(
        { year: inSevenDays.year, month: inSevenDays.month, day: inSevenDays.day },
        { zone: timezone }
      ).startOf('day').toJSDate();

      const event = await ensureCelebrationEvent({
        organizationId,
        employee,
        type: 'birthday',
        eventYear: inSevenDays.year,
        eventKey: buildCelebrationEventKey('birthday-event', empId, inSevenDays.year),
        eventDate,
      });

      await sendCelebrationNotification({
        type: 'celebration_birthday_upcoming',
        organizationId,
        employee,
        eventKey,
        notificationKind: 'birthday_upcoming',
        year: inSevenDays.year,
        celebrationEventId: event._id,
        data: {
          targetMonth: inSevenDays.month,
          targetDay: inSevenDays.day,
          title: '🎂 Upcoming Birthday',
        },
      });
    }

    // Birthday today
    if (matchesMonthDay(employee.birthDate, today.month, today.day, timezone)) {
      const eventKey = buildCelebrationEventKey('birthday-today', empId, today.year);
      const eventDate = DateTime.fromObject(
        { year: today.year, month: today.month, day: today.day },
        { zone: timezone }
      ).startOf('day').toJSDate();

      const event = await ensureCelebrationEvent({
        organizationId,
        employee,
        type: 'birthday',
        eventYear: today.year,
        eventKey: buildCelebrationEventKey('birthday-event', empId, today.year),
        eventDate,
      });

      await sendCelebrationNotification({
        type: 'celebration_birthday_today',
        organizationId,
        employee,
        eventKey,
        notificationKind: 'birthday_today',
        year: today.year,
        celebrationEventId: event._id,
        data: {
          title: `🎉 Today is ${employee.name} ${employee.lastName || ''}'s Birthday!`.trim(),
        },
      });
    }
  }
}

async function processAnniversariesForOrg(organizationId, timezone, today, inSevenDays) {
  const employees = await loadCelebrationEmployees(organizationId);

  for (const employee of employees) {
    if (!employee.joiningDate) continue;

    const empId = employee._id.toString();
    const completedYearsToday = calculateCompletedYears(
      employee.joiningDate,
      today.year,
      timezone
    );

    // Upcoming anniversary — exactly 7 days before
    if (matchesMonthDay(employee.joiningDate, inSevenDays.month, inSevenDays.day, timezone)) {
      const upcomingYears = calculateCompletedYears(
        employee.joiningDate,
        inSevenDays.year,
        timezone
      );
      if (upcomingYears < 1) continue;

      const eventKey = buildCelebrationEventKey('anniversary-upcoming', empId, inSevenDays.year);
      const eventDate = DateTime.fromObject(
        { year: inSevenDays.year, month: inSevenDays.month, day: inSevenDays.day },
        { zone: timezone }
      ).startOf('day').toJSDate();

      const event = await ensureCelebrationEvent({
        organizationId,
        employee,
        type: 'anniversary',
        eventYear: inSevenDays.year,
        eventKey: buildCelebrationEventKey('anniversary-event', empId, inSevenDays.year),
        eventDate,
        completedYears: upcomingYears,
      });

      await sendCelebrationNotification({
        type: 'celebration_anniversary_upcoming',
        organizationId,
        employee,
        eventKey,
        notificationKind: 'anniversary_upcoming',
        year: inSevenDays.year,
        celebrationEventId: event._id,
        data: {
          targetMonth: inSevenDays.month,
          targetDay: inSevenDays.day,
          title: '🎉 Upcoming Work Anniversary',
        },
      });
    }

    // Anniversary today
    if (
      matchesMonthDay(employee.joiningDate, today.month, today.day, timezone) &&
      completedYearsToday >= 1
    ) {
      const eventKey = buildCelebrationEventKey('anniversary-today', empId, today.year);
      const eventDate = DateTime.fromObject(
        { year: today.year, month: today.month, day: today.day },
        { zone: timezone }
      ).startOf('day').toJSDate();

      const event = await ensureCelebrationEvent({
        organizationId,
        employee,
        type: 'anniversary',
        eventYear: today.year,
        eventKey: buildCelebrationEventKey('anniversary-event', empId, today.year),
        eventDate,
        completedYears: completedYearsToday,
      });

      await sendCelebrationNotification({
        type: 'celebration_anniversary_today',
        organizationId,
        employee,
        eventKey,
        notificationKind: 'anniversary_today',
        year: today.year,
        celebrationEventId: event._id,
        data: {
          completedYears: completedYearsToday,
          title: '🎉 Work Anniversary',
        },
      });
    }
  }
}

async function processMarriageAnniversariesForOrg(organizationId, timezone, today, inSevenDays) {
  const employees = await loadCelebrationEmployees(organizationId);

  for (const employee of employees) {
    const weddingDate = employee.anniversaryDate || employee.marriageDate;
    if (!weddingDate) continue;
    if (employee.maritalStatus && employee.maritalStatus !== 'Married') continue;
    if (employee.showMarriageAnniversary === false) continue;

    const empId = employee._id.toString();
    const completedYearsToday = calculateMarriageCompletedYears(
      weddingDate,
      today.year,
      timezone
    );

    // Upcoming marriage anniversary — exactly 7 days before
    if (matchesMonthDay(weddingDate, inSevenDays.month, inSevenDays.day, timezone)) {
      const upcomingYears = calculateMarriageCompletedYears(
        weddingDate,
        inSevenDays.year,
        timezone
      );
      if (upcomingYears < 1) continue;

      const eventKey = buildCelebrationEventKey('marriage-anniversary-upcoming', empId, inSevenDays.year);
      const eventDate = DateTime.fromObject(
        { year: inSevenDays.year, month: inSevenDays.month, day: inSevenDays.day },
        { zone: timezone }
      ).startOf('day').toJSDate();

      const event = await ensureCelebrationEvent({
        organizationId,
        employee,
        type: 'marriage_anniversary',
        eventYear: inSevenDays.year,
        eventKey: buildCelebrationEventKey('marriage-anniversary-event', empId, inSevenDays.year),
        eventDate,
        completedYears: upcomingYears,
      });

      await sendCelebrationNotification({
        type: 'celebration_marriage_anniversary_upcoming',
        organizationId,
        employee,
        eventKey,
        notificationKind: 'marriage_anniversary_upcoming',
        year: inSevenDays.year,
        celebrationEventId: event._id,
        data: {
          targetMonth: inSevenDays.month,
          targetDay: inSevenDays.day,
          title: '💍 Upcoming Marriage Anniversary',
        },
      });
    }

    // Marriage anniversary today
    if (
      matchesMonthDay(weddingDate, today.month, today.day, timezone) &&
      completedYearsToday >= 1
    ) {
      const eventKey = buildCelebrationEventKey('marriage-anniversary-today', empId, today.year);
      const eventDate = DateTime.fromObject(
        { year: today.year, month: today.month, day: today.day },
        { zone: timezone }
      ).startOf('day').toJSDate();

      const event = await ensureCelebrationEvent({
        organizationId,
        employee,
        type: 'marriage_anniversary',
        eventYear: today.year,
        eventKey: buildCelebrationEventKey('marriage-anniversary-event', empId, today.year),
        eventDate,
        completedYears: completedYearsToday,
      });

      await sendCelebrationNotification({
        type: 'celebration_marriage_anniversary_today',
        organizationId,
        employee,
        eventKey,
        notificationKind: 'marriage_anniversary_today',
        year: today.year,
        celebrationEventId: event._id,
        data: {
          completedYears: completedYearsToday,
          title: `💍 Today is ${employee.name} ${employee.lastName || ''}'s Marriage Anniversary!`.trim(),
        },
      });
    }
  }
}

export async function processCelebrationNotificationsForOrg(organizationId, refDate = new Date()) {
  const timezone = await getEffectiveTimezone(organizationId);
  if (!hasReachedOrgNineAm(timezone, refDate)) return;

  const today = getTodayPartsInTimezone(timezone, refDate);
  const orgDayKey = `${organizationId}:${today.dateKey}`;
  if (processedOrgDays.has(orgDayKey)) return;
  processedOrgDays.add(orgDayKey);

  try {
    const inSevenDays = getDatePartsDaysFromToday(timezone, 7, refDate);

    logger.info('Running celebration notification job for org', {
      organizationId,
      timezone,
      today: today.dateKey,
      inSevenDays: inSevenDays.dateKey,
    });

    await processBirthdaysForOrg(organizationId, timezone, today, inSevenDays);
    await processAnniversariesForOrg(organizationId, timezone, today, inSevenDays);
    await processMarriageAnniversariesForOrg(organizationId, timezone, today, inSevenDays);
  } catch (error) {
    processedOrgDays.delete(orgDayKey);
    throw error;
  }
}

export async function runCelebrationNotificationCheck(refDate = new Date()) {
  try {
    const organizations = await Organization.find({ isActive: { $ne: false } })
      .select('_id timezone')
      .lean();

    for (const org of organizations) {
      try {
        await processCelebrationNotificationsForOrg(org._id, refDate);
      } catch (error) {
        logger.error('Celebration notification failed for org', {
          organizationId: org._id,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Celebration notification check failed', { error: error.message });
  }
}

 * Schedule isolated Birthday & Anniversary notifications from 9:00 AM org local time.
 * If the server starts after 9:00, it still sends once for that day (no duplicates).
 */
export const scheduleCelebrationNotificationJobs = () => {
  cron.schedule('* * * * *', async () => {
    await runCelebrationNotificationCheck();
  });

  logger.info('Celebration notification jobs scheduled (from 9:00 AM org local time)');
};

export default {
  scheduleCelebrationNotificationJobs,
  runCelebrationNotificationCheck,
  processCelebrationNotificationsForOrg,
};
