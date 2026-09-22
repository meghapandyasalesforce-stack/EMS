/**
 * Reminder job for upcoming one-on-one meetings.
 * Runs every 5 minutes; notifies participants ~30 minutes before start.
 */

import cron from 'node-cron';
import { OneOnOne } from '../models/oneOnOne.model.js';
import {
    ACTIVE_MEETING_STATUSES,
    displayName,
    formatMeetingWhen,
    notifyMeetingParticipants
} from '../helpers/oneOnOneHelper.js';
import logger from '../helpers/logger.js';

const REMINDER_WINDOW_MINUTES = 30;
const REMINDER_TOLERANCE_MINUTES = 5;

const parseMeetingStart = (meeting) => {
    const date = meeting.scheduledDate ? new Date(meeting.scheduledDate) : null;
    if (!date || Number.isNaN(date.getTime())) return null;

    if (meeting.scheduledTime && /^\d{1,2}:\d{2}/.test(meeting.scheduledTime)) {
        const [hh, mm] = meeting.scheduledTime.split(':').map((n) => parseInt(n, 10));
        date.setHours(hh || 0, mm || 0, 0, 0);
    }
    return date;
};

export const processOneOnOneReminders = async () => {
    const now = new Date();
    const windowStart = new Date(now.getTime() + (REMINDER_WINDOW_MINUTES - REMINDER_TOLERANCE_MINUTES) * 60 * 1000);
    const windowEnd = new Date(now.getTime() + (REMINDER_WINDOW_MINUTES + REMINDER_TOLERANCE_MINUTES) * 60 * 1000);

    // Broad date filter for today ±1 day, then precise time check in JS
    const dayStart = new Date(now);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(now);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(23, 59, 59, 999);

    const meetings = await OneOnOne.find({
        status: { $in: [...ACTIVE_MEETING_STATUSES] },
        scheduledDate: { $gte: dayStart, $lte: dayEnd }
    })
        .populate('managerId', 'name lastName')
        .populate('employeeId', 'name lastName')
        .lean();

    let sent = 0;

    for (const meeting of meetings) {
        const alreadyReminded = (meeting.reminders || []).some((r) => r.type === 'Notification');
        if (alreadyReminded) continue;

        const start = parseMeetingStart(meeting);
        if (!start) continue;
        if (start < windowStart || start > windowEnd) continue;

        const { label } = formatMeetingWhen(meeting);
        const managerName = displayName(meeting.managerId);
        const employeeName = displayName(meeting.employeeId);

        try {
            await notifyMeetingParticipants({
                recipientIds: [meeting.managerId?._id || meeting.managerId],
                sender: meeting.employeeId,
                message: `Reminder: your meeting with ${employeeName} is scheduled for ${label}.`,
                organizationId: meeting.organizationId,
                meetingId: meeting._id,
                extraMetadata: { action: 'reminder' }
            });
            await notifyMeetingParticipants({
                recipientIds: [meeting.employeeId?._id || meeting.employeeId],
                sender: meeting.managerId,
                message: `Reminder: your meeting with ${managerName} is scheduled for ${label}.`,
                organizationId: meeting.organizationId,
                meetingId: meeting._id,
                extraMetadata: { action: 'reminder' }
            });

            await OneOnOne.updateOne(
                { _id: meeting._id },
                { $push: { reminders: { sentAt: new Date(), type: 'Notification' } } }
            );
            sent += 1;
        } catch (err) {
            logger.error('One-on-one reminder failed', {
                meetingId: meeting._id,
                error: err.message
            });
        }
    }

    if (sent > 0) {
        logger.info('One-on-one reminders sent', { count: sent });
    }
};

export const scheduleOneOnOneReminderJobs = () => {
    cron.schedule('*/5 * * * *', async () => {
        try {
            await processOneOnOneReminders();
        } catch (error) {
            logger.error('One-on-one reminder job error', { error: error.message });
        }
    });
    logger.info('One-on-one reminder jobs scheduled (every 5 minutes)');
};

export default {
    scheduleOneOnOneReminderJobs,
    processOneOnOneReminders
};
