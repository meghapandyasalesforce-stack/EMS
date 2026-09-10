import { DateTime } from 'luxon';
import CelebrationEvent from '../models/celebrationEvent.model.js';
import {
  buildCelebrationEventKey,
  getTodayPartsInTimezone,
  daysUntilMonthDay,
  calculateCompletedYears,
  calculateMarriageCompletedYears,
} from './celebrationDateHelper.js';
import {
  resolveCelebrationEventViewers,
  canViewCelebrationEvent,
} from './celebrationRecipientHelper.js';
import { getEffectiveTimezone } from './organizationTimezoneService.js';

export async function ensureCelebrationEvent({
  organizationId,
  employee,
  type,
  eventYear,
  eventKey,
  eventDate,
  completedYears,
}) {
  const viewers = await resolveCelebrationEventViewers(employee, organizationId);

  let event = await CelebrationEvent.findOne({ organizationId, eventKey });
  if (event) return event;

  try {
    event = await CelebrationEvent.create({
      organizationId,
      employeeId: employee._id,
      type,
      eventDate,
      eventYear,
      eventKey,
      completedYears: completedYears ?? null,
      eligibleViewerIds: viewers,
      status: 'active',
    });
    return event;
  } catch (error) {
    if (error?.code === 11000) {
      return CelebrationEvent.findOne({ organizationId, eventKey });
    }
    throw error;
  }
}

/**
 * Create (or return) today's birthday event so colleagues can wish
 * even if the 9:00 AM scheduler has not produced the event yet.
 */
export async function openTodayBirthdayEvent(organizationId, employee, viewerId) {
  const timezone = await getEffectiveTimezone(organizationId);
  const daysUntil = daysUntilMonthDay(employee.birthDate, timezone);
  if (daysUntil !== 0) {
    const error = new Error('Wishes open on their birthday');
    error.statusCode = 400;
    throw error;
  }

  const today = getTodayPartsInTimezone(timezone);
  const eventDate = DateTime.fromObject(
    { year: today.year, month: today.month, day: today.day },
    { zone: timezone }
  ).startOf('day').toJSDate();

  const event = await ensureCelebrationEvent({
    organizationId,
    employee,
    type: 'birthday',
    eventYear: today.year,
    eventKey: buildCelebrationEventKey('birthday-event', employee._id.toString(), today.year),
    eventDate,
  });

  if (viewerId && !canViewCelebrationEvent(event, viewerId)) {
    event.eligibleViewerIds = [...(event.eligibleViewerIds || []), viewerId];
    await event.save();
  }

  return event;
}

/**
 * Create (or return) today's work anniversary event so colleagues can wish
 * even if the 9:00 AM scheduler has not produced the event yet.
 */
export async function openTodayAnniversaryEvent(organizationId, employee, viewerId) {
  if (!employee.joiningDate) {
    const error = new Error('Joining date not set');
    error.statusCode = 400;
    throw error;
  }
  const timezone = await getEffectiveTimezone(organizationId);
  const daysUntil = daysUntilMonthDay(employee.joiningDate, timezone);
  if (daysUntil !== 0) {
    const error = new Error('Wishes open on their work anniversary');
    error.statusCode = 400;
    throw error;
  }

  const today = getTodayPartsInTimezone(timezone);
  const completedYears = calculateCompletedYears(employee.joiningDate, today.year, timezone);
  if (completedYears < 1) {
    const error = new Error('Work anniversary requires at least 1 completed year');
    error.statusCode = 400;
    throw error;
  }

  const eventDate = DateTime.fromObject(
    { year: today.year, month: today.month, day: today.day },
    { zone: timezone }
  ).startOf('day').toJSDate();

  const event = await ensureCelebrationEvent({
    organizationId,
    employee,
    type: 'anniversary',
    eventYear: today.year,
    eventKey: buildCelebrationEventKey('anniversary-event', employee._id.toString(), today.year),
    eventDate,
    completedYears,
  });

  if (viewerId && !canViewCelebrationEvent(event, viewerId)) {
    event.eligibleViewerIds = [...(event.eligibleViewerIds || []), viewerId];
    await event.save();
  }

  return event;
}

/**
 * Create (or return) today's marriage anniversary event so colleagues can wish
 * even if the 9:00 AM scheduler has not produced the event yet.
 */
export async function openTodayMarriageAnniversaryEvent(organizationId, employee, viewerId) {
  const weddingDate = employee.anniversaryDate || employee.contactDetails?.anniversaryDate || employee.personalDetails?.anniversaryDate || employee.marriageDate;
  if (!weddingDate) {
    const error = new Error('Anniversary date not set');
    error.statusCode = 400;
    throw error;
  }
  const maritalStatus = employee.maritalStatus || employee.contactDetails?.maritalStatus || employee.personalDetails?.maritalStatus;
  if (maritalStatus && String(maritalStatus).trim().toLowerCase() !== 'married') {
    const error = new Error('Marital status is not married');
    error.statusCode = 400;
    throw error;
  }
  if (employee.showMarriageAnniversary === false) {
    const error = new Error('Marriage anniversary is marked private');
    error.statusCode = 400;
    throw error;
  }
  const timezone = await getEffectiveTimezone(organizationId);
  const daysUntil = daysUntilMonthDay(weddingDate, timezone);
  if (daysUntil !== 0) {
    const error = new Error('Wishes open on their marriage anniversary');
    error.statusCode = 400;
    throw error;
  }

  const today = getTodayPartsInTimezone(timezone);
  const completedYears = calculateMarriageCompletedYears(weddingDate, today.year, timezone);
  if (completedYears < 1) {
    const error = new Error('Marriage anniversary requires at least 1 completed year');
    error.statusCode = 400;
    throw error;
  }

  const eventDate = DateTime.fromObject(
    { year: today.year, month: today.month, day: today.day },
    { zone: timezone }
  ).startOf('day').toJSDate();

  const event = await ensureCelebrationEvent({
    organizationId,
    employee,
    type: 'marriage_anniversary',
    eventYear: today.year,
    eventKey: buildCelebrationEventKey('marriage-anniversary-event', employee._id.toString(), today.year),
    eventDate,
    completedYears,
  });

  if (viewerId && !canViewCelebrationEvent(event, viewerId)) {
    event.eligibleViewerIds = [...(event.eligibleViewerIds || []), viewerId];
    await event.save();
  }

  return event;
}
