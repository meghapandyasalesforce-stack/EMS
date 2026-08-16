import cron from 'node-cron';
import { Survey, SurveyResponse, PulseProgram } from '../models/engagement.model.js';
import Employee from '../models/employee.model.js';
import { notify } from '../helpers/notificationManager.js';
import '../helpers/notificationEventRegistry.js';
import { buildAnonymousHash, surveyMatchesEmployee } from '../helpers/engagementHelper.js';
import { processActionPlanReminders } from '../controllers/engagement/actionPlanController.js';
import { processLifecycleEngagementSurveys } from '../helpers/engagementLifecycleHelper.js';
import { generatePulseOccurrence } from '../controllers/engagement/pulseProgramController.js';
import logger from '../helpers/logger.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const resolveSurveyRecipients = async (survey) => {
    const employees = await Employee.find({
        organizationId: survey.organizationId,
        status: 'active'
    })
        .select('_id department assignedRole')
        .lean();

    return employees.filter((e) => surveyMatchesEmployee(survey, e));
};

const getNonRespondents = async (survey, employees) => {
    if (!employees.length) return [];

    const responses = await SurveyResponse.find({
        organizationId: survey.organizationId,
        surveyId: survey._id
    })
        .select('employeeId respondentHash')
        .lean();

    const respondedEmployeeIds = new Set(
        responses.filter((r) => r.employeeId).map((r) => String(r.employeeId))
    );
    const respondedHashes = new Set(
        responses.filter((r) => r.respondentHash).map((r) => r.respondentHash)
    );

    return employees.filter((emp) => {
        if (survey.anonymous) {
            const hash = buildAnonymousHash(survey.organizationId, emp._id, 'survey');
            return !respondedHashes.has(hash);
        }
        return !respondedEmployeeIds.has(String(emp._id));
    });
};

/**
 * Close expired Active surveys and send reminders / closing notices.
 */
export const processEngagementSurveyJobs = async () => {
    const now = new Date();

    // Expiry: Active surveys past endDate → Closed
    const expired = await Survey.find({
        status: 'Active',
        endDate: { $lt: now }
    }).select('_id organizationId title');

    for (const survey of expired) {
        await Survey.updateOne({ _id: survey._id }, { $set: { status: 'Closed' } });
        logger.info('Engagement survey auto-closed', {
            surveyId: survey._id,
            organizationId: survey.organizationId
        });
    }

    // Reminders / closing notices for Active surveys with reminderEnabled
    const activeSurveys = await Survey.find({
        status: 'Active',
        reminderEnabled: { $ne: false },
        startDate: { $lte: now },
        endDate: { $gte: now }
    });

    for (const survey of activeSurveys) {
        try {
            const daysBefore = Number(survey.reminderDaysBefore ?? 2);
            const msLeft = new Date(survey.endDate).getTime() - now.getTime();
            const daysLeft = msLeft / MS_PER_DAY;

            const employees = await resolveSurveyRecipients(survey);
            const nonRespondents = await getNonRespondents(survey, employees);
            if (!nonRespondents.length) continue;

            const recipientIds = nonRespondents.map((e) => e._id);

            // Closing soon (within 1 day)
            if (daysLeft <= 1 && daysLeft > 0) {
                const alreadySent =
                    survey.lastClosingNoticeAt &&
                    now.getTime() - new Date(survey.lastClosingNoticeAt).getTime() < MS_PER_DAY;
                if (!alreadySent) {
                    await notify({
                        type: 'engagement.survey.closing',
                        organizationId: survey.organizationId,
                        data: { survey, recipients: recipientIds.map((id) => id.toString()) }
                    });
                    survey.lastClosingNoticeAt = now;
                    await survey.save();
                }
                continue;
            }

            // Reminder window
            if (daysLeft <= daysBefore && daysLeft > 1) {
                const alreadySent =
                    survey.lastReminderAt &&
                    now.getTime() - new Date(survey.lastReminderAt).getTime() < MS_PER_DAY;
                if (!alreadySent) {
                    await notify({
                        type: 'engagement.survey.reminder',
                        organizationId: survey.organizationId,
                        data: { survey, recipients: recipientIds.map((id) => id.toString()) }
                    });
                    survey.lastReminderAt = now;
                    await survey.save();
                }
            }
        } catch (error) {
            logger.error('Engagement survey reminder failed', {
                surveyId: survey._id,
                error: error.message
            });
        }
    }
};

/**
 * Process active Pulse Programs: generate occurrences when due.
 * Idempotent — safe to run multiple times.
 */
const processPulsePrograms = async () => {
    const now = new Date();

    const duePrograms = await PulseProgram.find({
        status: 'Active',
        nextRunAt: { $lte: now }
    });

    for (const program of duePrograms) {
        try {
            await generatePulseOccurrence(program);
        } catch (error) {
            logger.error('Pulse occurrence generation failed', {
                programId: program._id,
                error: error.message
            });
            // Record the error but don't crash the loop
            try {
                program.lastGenerationError = error.message;
                await program.save();
            } catch (_) { /* swallow save errors on error path */ }
        }
    }
};

export const scheduleEngagementSurveyJobs = () => {
    // Every hour
    cron.schedule('15 * * * *', async () => {
        try {
            await processEngagementSurveyJobs();
        } catch (error) {
            logger.error('Engagement survey job error', { error: error.message });
        }
        try {
            await processPulsePrograms();
        } catch (error) {
            logger.error('Pulse program job error', { error: error.message });
        }
        try {
            await processActionPlanReminders();
        } catch (error) {
            logger.error('Action plan reminder job error', { error: error.message });
        }
        try {
            await processLifecycleEngagementSurveys();
        } catch (error) {
            logger.error('Lifecycle engagement job error', { error: error.message });
        }
    });
    logger.info('Engagement survey reminder/expiry + pulse + lifecycle jobs scheduled');
};
