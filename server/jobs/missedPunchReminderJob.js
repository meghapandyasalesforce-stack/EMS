import cron from 'node-cron';
import { DateTime } from 'luxon';
import Organization from '../models/organization.model.js';
import Employee from '../models/employee.model.js';
import Attendance from '../models/attendance.model.js';
import Leave from '../models/leave.model.js';
import Calendar from '../models/calendar.model.js';
import MissedPunchReminderLog from '../models/missedPunchReminderLog.model.js';
import logger from '../helpers/logger.js';
import { getCachedEffectiveTimezone } from '../helpers/orgContextCache.js';
import { resolveMorningNotifyTimezone } from '../helpers/celebrationDateHelper.js';
import { isRedisConnected } from '../config/redis.js';
import { queueNotificationEmail } from '../helpers/emailQueue.js';
import { sendNotificationEmail } from '../helpers/emailSender.js';
import {
    buildAttendancePeriodFilter,
    parseDateKeyInTimezone,
    resolveAttendanceDateKey,
} from '../helpers/attendanceDayHelper.js';
import {
    buildWorkingDayKeyFn,
    collectMissedPunchDateKeys,
    isMissedPunchReminderSendHour,
    leaveMapsForEmployee,
    resolveMissedPunchReminderStage,
    buildMissedPunchReminderEmail,
} from '../helpers/missedPunchReminderHelper.js';

function regularizationUrl() {
    const base = (process.env.FRONTEND_URL || process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/$/, '');
    return `${base}/my-attendance-regularization`;
}

async function deliverReminderEmail({ email, subject, message, html }) {
    if (isRedisConnected()) {
        const job = await queueNotificationEmail(email, subject, message, html);
        if (job) return;
    }
    await sendNotificationEmail(email, subject, message, html);
}

async function claimSend({ organizationId, employeeId, monthKey, stage, missedDateKeys }) {
    try {
        await MissedPunchReminderLog.create({
            organizationId,
            employeeId,
            monthKey,
            stage,
            missedDateKeys,
            sentAt: new Date(),
        });
        return true;
    } catch (error) {
        if (error?.code === 11000) return false;
        throw error;
    }
}

async function releaseClaim({ organizationId, employeeId, monthKey, stage }) {
    await MissedPunchReminderLog.deleteOne({ organizationId, employeeId, monthKey, stage });
}

function groupByEmployee(rows, idField) {
    const grouped = new Map();
    for (const row of rows) {
        const id = row?.[idField] ? String(row[idField]) : '';
        if (!id) continue;
        if (!grouped.has(id)) grouped.set(id, []);
        grouped.get(id).push(row);
    }
    return grouped;
}

export async function processMissedPunchRemindersForOrg(organizationId, now = new Date()) {
    const effectiveTimezone = await getCachedEffectiveTimezone(organizationId);
    const timezone = resolveMorningNotifyTimezone(effectiveTimezone);
    const nowInOrg = DateTime.fromJSDate(now, { zone: timezone });

    if (!isMissedPunchReminderSendHour(nowInOrg, timezone)) {
        return { stage: null, sent: 0, skipped: 0 };
    }

    const stageInfo = resolveMissedPunchReminderStage(nowInOrg, timezone);
    if (!stageInfo.stage || !stageInfo.walkEndKey) {
        return { stage: stageInfo.stage, sent: 0, skipped: 0 };
    }

    const year = Number(stageInfo.monthStartKey.slice(0, 4));
    const periodStart = parseDateKeyInTimezone(stageInfo.monthStartKey, timezone).startOf('day').toJSDate();
    const periodEnd = parseDateKeyInTimezone(stageInfo.walkEndKey, timezone).endOf('day').toJSDate();

    const [employees, attendanceRows, leaves, calendar] = await Promise.all([
        Employee.find({
            organizationId,
            status: 'active',
            active: { $ne: false },
            email: { $exists: true, $nin: [null, ''] },
        }).select('name email joiningDate lastWorkingDate terminationDate').lean(),
        Attendance.find({
            organizationId,
            clockIn: { $ne: null },
            ...buildAttendancePeriodFilter({
                startDateKey: stageInfo.monthStartKey,
                endDateKey: stageInfo.walkEndKey,
                periodStart,
                periodEnd,
            }),
        }).select('userId attendanceDateKey date clockIn').lean(),
        Leave.find({
            organizationId,
            status: 'approved',
            startDate: { $lte: periodEnd },
            endDate: { $gte: periodStart },
        }).select('employee leaveType startDate endDate duration isHalfDay').lean(),
        Calendar.findOne({ organizationId, year }).lean(),
    ]);

    const isWorkingDayKeyFn = buildWorkingDayKeyFn(calendar, timezone);
    const punchesByEmployee = new Map();
    for (const row of attendanceRows) {
        const key = resolveAttendanceDateKey(row, timezone);
        const employeeId = row?.userId ? String(row.userId) : '';
        if (!key || !employeeId) continue;
        if (!punchesByEmployee.has(employeeId)) punchesByEmployee.set(employeeId, new Set());
        punchesByEmployee.get(employeeId).add(key);
    }
    const leavesByEmployee = groupByEmployee(leaves, 'employee');

    let sent = 0;
    let skipped = 0;

    for (const employee of employees) {
        const email = String(employee.email || '').trim();
        if (!email) {
            skipped += 1;
            continue;
        }

        const employeeId = String(employee._id);
        const { paidLeaveByDay, lopByDay } = leaveMapsForEmployee(
            leavesByEmployee.get(employeeId) || [],
            stageInfo.monthStartKey,
            stageInfo.walkEndKey,
            timezone,
            isWorkingDayKeyFn
        );
        const missedDateKeys = collectMissedPunchDateKeys({
            monthStartKey: stageInfo.monthStartKey,
            walkEndKey: stageInfo.walkEndKey,
            joiningDate: employee.joiningDate,
            lastWorkingDate: employee.lastWorkingDate,
            terminationDate: employee.terminationDate,
            timezone,
            isWorkingDayKeyFn,
            punchedDateKeys: punchesByEmployee.get(employeeId) || new Set(),
            paidLeaveByDay,
            lopByDay,
        });

        if (!missedDateKeys.length) {
            skipped += 1;
            continue;
        }

        const claimed = await claimSend({
            organizationId,
            employeeId: employee._id,
            monthKey: stageInfo.monthKey,
            stage: stageInfo.stage,
            missedDateKeys,
        });
        if (!claimed) {
            skipped += 1;
            continue;
        }

        const { subject, message, html } = buildMissedPunchReminderEmail({
            employeeName: employee.name,
            stage: stageInfo.stage,
            missedDateKeys,
            monthLabel: stageInfo.monthLabel,
            timezone,
            regularizationUrl: regularizationUrl(),
        });

        try {
            await deliverReminderEmail({ email, subject, message, html });
            sent += 1;
        } catch (error) {
            await releaseClaim({
                organizationId,
                employeeId: employee._id,
                monthKey: stageInfo.monthKey,
                stage: stageInfo.stage,
            });
            logger.error('Missed punch reminder email failed', {
                organizationId,
                employeeId,
                stage: stageInfo.stage,
                error: error.message,
            });
        }
    }

    if (sent) {
        logger.info('Missed punch reminders sent', {
            organizationId,
            stage: stageInfo.stage,
            monthKey: stageInfo.monthKey,
            sent,
        });
    }

    return { stage: stageInfo.stage, sent, skipped };
}

export async function processMissedPunchReminders(now = new Date()) {
    const organizations = await Organization.find({}).select('_id').lean();
    let sent = 0;
    for (const org of organizations) {
        try {
            const result = await processMissedPunchRemindersForOrg(org._id, now);
            sent += result.sent || 0;
        } catch (error) {
            logger.error('Missed punch reminder job failed for organization', {
                organizationId: org._id,
                error: error.message,
            });
        }
    }
    return { sent, organizations: organizations.length };
}

export function scheduleMissedPunchReminderJobs() {
    // Hourly. Each org sends only at 09:00–11:59 local time, and only on the
    // 7-day and 5-day dates before month end. The log blocks a second send.
    cron.schedule('15 * * * *', async () => {
        try {
            await processMissedPunchReminders(new Date());
        } catch (error) {
            logger.error('Missed punch reminder job failed', { error: error.message });
        }
    });

    logger.info('Missed punch reminder job scheduled (7-day notice and 5-day LOP reminder, 09:00–11:59 org local time)');
}
