import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { synchronizeOnboardingWorkflows } from '../services/onboardingService.js';
import { synchronizeOffboardingWorkflows } from '../services/offboardingService.js';
import { processAllDocumentExpiry } from '../services/lifecycleDocumentHubService.js';
import { processExitInterviewReminders } from '../services/lifecycleExitInterviewService.js';
import { processScheduledLifecycleReports } from '../services/lifecycleReportsService.js';
import Organization from '../models/organization.model.js';

export async function processScheduledOnboarding() {
    try {
        const result = await synchronizeOnboardingWorkflows();
        if (result.tasksOverdue || result.remindersSent || result.workflowsCompleted) {
            logger.info('Onboarding workflows synchronized', result);
        }
        return result;
    } catch (err) {
        logger.error('Scheduled onboarding job failed', { error: err.message });
        return { workflowsChecked: 0, tasksOverdue: 0, remindersSent: 0, workflowsCompleted: 0 };
    }
}

export async function processScheduledOffboarding() {
    try {
        const result = await synchronizeOffboardingWorkflows();
        if (result.tasksOverdue || result.remindersSent || result.workflowsCompleted) {
            logger.info('Offboarding workflows synchronized', result);
        }
        return result;
    } catch (err) {
        logger.error('Scheduled offboarding job failed', { error: err.message });
        return { workflowsChecked: 0, tasksOverdue: 0, remindersSent: 0, workflowsCompleted: 0 };
    }
}

export async function processScheduledDocumentExpiry() {
    try {
        const result = await processAllDocumentExpiry();
        if (result.expired || result.reminders) {
            logger.info('Document expiry job completed', result);
        }
        return result;
    } catch (err) {
        logger.error('Document expiry job failed', { error: err.message });
        return { expired: 0, reminders: 0, renewalPending: 0, orgs: 0 };
    }
}

export async function processScheduledExitInterviewReminders() {
    try {
        const orgIds = await Organization.distinct('_id');
        let sent = 0;
        for (const organizationId of orgIds) {
            const result = await processExitInterviewReminders(organizationId);
            sent += result.sent || 0;
        }
        if (sent) logger.info('Exit interview reminders sent', { sent });
        return { sent };
    } catch (err) {
        logger.error('Exit interview reminder job failed', { error: err.message });
        return { sent: 0 };
    }
}

export async function processScheduledLifecycleReportDelivery() {
    try {
        const result = await processScheduledLifecycleReports();
        if (result.processed) {
            logger.info('Scheduled lifecycle reports processed', result);
        }
        return result;
    } catch (err) {
        logger.error('Scheduled lifecycle reports job failed', { error: err.message });
        return { processed: 0, checked: 0 };
    }
}

export function scheduleOnboardingJobs() {
    // Reconcile both independent employee-lifecycle workflow types hourly.
    cron.schedule('0 * * * *', async () => {
        await Promise.all([
            processScheduledOnboarding(),
            processScheduledOffboarding(),
            processScheduledDocumentExpiry(),
            processScheduledExitInterviewReminders(),
            processScheduledLifecycleReportDelivery(),
        ]);
    });
    logger.info('Employee lifecycle automation job registered (hourly)');
}

export default { scheduleOnboardingJobs, processScheduledOnboarding, processScheduledOffboarding };
