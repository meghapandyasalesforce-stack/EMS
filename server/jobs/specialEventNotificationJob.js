import cron from 'node-cron';
import { DateTime } from 'luxon';
import Calendar from '../models/calendar.model.js';
import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';
import logger from '../helpers/logger.js';
import { getEffectiveTimezone } from '../helpers/organizationTimezoneService.js';
import {
  getTodayPartsInTimezone,
  getCalendarMonthDay,
  isOrgMorningNotifyWindow,
  matchesMonthDay,
  resolveMorningNotifyTimezone,
} from '../helpers/celebrationDateHelper.js';

/** Once-per-org-per-day guard (in-memory; resets on process restart within the morning window only). */
const processedOrgDays = new Set();

/**
 * Send holiday notification
 */
const sendHolidayNotification = async (holiday, organizationId) => {
  try {
    await notify({
      type: 'holiday',
      organizationId,
      data: { holiday },
      isBroadcast: true,
    });

    logger.info('Holiday notification sent', {
      holidayName: holiday.name,
      organizationId,
    });
  } catch (error) {
    logger.error('Error sending holiday notification', {
      error: error.message,
      holidayName: holiday.name,
      organizationId,
    });
  }
};

/**
 * Send birthday notification
 */
const sendBirthdayNotification = async (employee, organizationId) => {
  try {
    await notify({
      type: 'birthday',
      organizationId,
      data: { employee },
      isBroadcast: true,
    });

    logger.info('Birthday notification sent', {
      employeeName: `${employee.name} ${employee.lastName || ''}`,
      organizationId,
    });
  } catch (error) {
    logger.error('Error sending birthday notification', {
      error: error.message,
      employeeId: employee._id,
      organizationId,
    });
  }
};

/**
 * Send work anniversary notification
 */
const sendWorkAnniversaryNotification = async (employee, yearsOfService, organizationId) => {
  try {
    await notify({
      type: 'work_anniversary',
      organizationId,
      data: { employee, years: yearsOfService },
      isBroadcast: true,
    });

    logger.info('Work anniversary notification sent', {
      employeeName: `${employee.name} ${employee.lastName || ''}`,
      yearsOfService,
      organizationId,
    });
  } catch (error) {
    logger.error('Error sending work anniversary notification', {
      error: error.message,
      employeeId: employee._id,
      organizationId,
    });
  }
};

/**
 * Check and send holiday notifications for one org (org-local calendar day).
 */
const checkHolidayNotificationsForOrg = async (organizationId, timezone, today) => {
  try {
    const calendars = await Calendar.find({
      organizationId,
      year: today.year,
    });

    for (const calendar of calendars) {
      const todayHolidays = (calendar.holidays || []).filter((holiday) => {
        if (holiday.isActive === false) return false;
        if (!holiday.date) return false;
        const parts = getCalendarMonthDay(holiday.date, timezone);
        if (!parts) return false;
        // Compare month/day; year on calendar document already scoped the query
        return parts.month === today.month && parts.day === today.day;
      });

      for (const holiday of todayHolidays) {
        await sendHolidayNotification(holiday, organizationId);
      }
    }
  } catch (error) {
    logger.error('Error in holiday notification check', {
      error: error.message,
      organizationId,
    });
  }
};

/**
 * Check and send birthday notifications for one org (dateOfBirth month/day in org TZ).
 */
const checkBirthdayNotificationsForOrg = async (organizationId, timezone, today) => {
  try {
    const birthdayEmployees = await Employee.find({
      organizationId,
      status: 'active',
      dateOfBirth: { $exists: true, $ne: null },
    }).select('_id name lastName dateOfBirth organizationId');

    for (const employee of birthdayEmployees) {
      if (matchesMonthDay(employee.dateOfBirth, today.month, today.day, timezone)) {
        await sendBirthdayNotification(employee, organizationId);
      }
    }

    logger.info('Birthday notifications check completed', {
      organizationId,
      totalBirthdays: birthdayEmployees.filter((e) =>
        matchesMonthDay(e.dateOfBirth, today.month, today.day, timezone)
      ).length,
    });
  } catch (error) {
    logger.error('Error in birthday notification check', {
      error: error.message,
      organizationId,
    });
  }
};

/**
 * Check and send work anniversary notifications for one org (joiningDate in org TZ).
 */
const checkWorkAnniversaryNotificationsForOrg = async (organizationId, timezone, today) => {
  try {
    const employees = await Employee.find({
      organizationId,
      status: 'active',
      joiningDate: { $exists: true, $ne: null },
    }).select('_id name lastName joiningDate organizationId');

    let totalAnniversaries = 0;

    for (const employee of employees) {
      if (!matchesMonthDay(employee.joiningDate, today.month, today.day, timezone)) {
        continue;
      }

      const joinLocal = DateTime.fromJSDate(new Date(employee.joiningDate), { zone: timezone });
      if (!joinLocal.isValid || joinLocal.year >= today.year) continue;

      const yearsOfService = today.year - joinLocal.year;
      if (yearsOfService < 1) continue;

      await sendWorkAnniversaryNotification(employee, yearsOfService, organizationId);
      totalAnniversaries += 1;
    }

    logger.info('Work anniversary notifications check completed', {
      organizationId,
      totalAnniversaries,
    });
  } catch (error) {
    logger.error('Error in work anniversary notification check', {
      error: error.message,
      organizationId,
    });
  }
};

/**
 * Process holiday / birthday / anniversary for one org during 9:00–9:59 AM local time.
 */
export async function processSpecialEventNotificationsForOrg(organizationId, refDate = new Date()) {
  const effectiveTimezone = await getEffectiveTimezone(organizationId);
  const timezone = resolveMorningNotifyTimezone(effectiveTimezone);
  if (!isOrgMorningNotifyWindow(timezone, refDate)) return;

  const today = getTodayPartsInTimezone(timezone, refDate);
  const orgDayKey = `${organizationId}:${today.dateKey}:special`;
  if (processedOrgDays.has(orgDayKey)) return;
  processedOrgDays.add(orgDayKey);

  try {
    logger.info('Running special event notifications for org', {
      organizationId,
      timezone,
      today: today.dateKey,
    });

    await checkHolidayNotificationsForOrg(organizationId, timezone, today);
    await checkBirthdayNotificationsForOrg(organizationId, timezone, today);
    await checkWorkAnniversaryNotificationsForOrg(organizationId, timezone, today);
  } catch (error) {
    processedOrgDays.delete(orgDayKey);
    throw error;
  }
}

export async function runSpecialEventNotificationCheck(refDate = new Date()) {
  try {
    const organizations = await Organization.find({ isActive: { $ne: false } })
      .select('_id')
      .lean();

    for (const org of organizations) {
      try {
        await processSpecialEventNotificationsForOrg(org._id, refDate);
      } catch (error) {
        logger.error('Special event notification failed for org', {
          organizationId: org._id,
          error: error.message,
        });
      }
    }
  } catch (error) {
    logger.error('Special event notification check failed', { error: error.message });
  }
}

/**
 * Legacy wrappers kept for callers/tests — now org-timezone aware via the morning runner.
 */
export const checkHolidayNotifications = async () => {
  await runSpecialEventNotificationCheck();
};

export const checkBirthdayNotifications = async () => {
  await runSpecialEventNotificationCheck();
};

export const checkWorkAnniversaryNotifications = async () => {
  await runSpecialEventNotificationCheck();
};

/**
 * Schedule special event jobs: every minute; each org only fires at 9:00–9:59 AM local time.
 * Fixes UTC-server cron (e.g. 9:45 UTC ≈ 3:15 PM IST) delivering in the afternoon.
 */
export const scheduleSpecialEventNotificationJobs = () => {
  cron.schedule('* * * * *', async () => {
    await runSpecialEventNotificationCheck();
  });

  logger.info('Special event notification jobs scheduled (9:00–9:59 AM org local time)');
};

export default {
  scheduleSpecialEventNotificationJobs,
  checkHolidayNotifications,
  checkBirthdayNotifications,
  checkWorkAnniversaryNotifications,
  runSpecialEventNotificationCheck,
  processSpecialEventNotificationsForOrg,
};
