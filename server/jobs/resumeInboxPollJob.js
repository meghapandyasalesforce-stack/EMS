/**
 * Resume Inbox poll cron — imports resumes from configured recruitment mailboxes.
 * Does not touch outbound email / leave / notification queues.
 */
import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { pollAllResumeInboxes } from '../services/resumeInboxService.js';

export async function processResumeInboxPoll() {
    const result = await pollAllResumeInboxes();
    if (result.imported > 0 || result.duplicates > 0 || result.failed > 0 || result.errors > 0) {
        logger.info('Resume Inbox poll tick', result);
    }
    return result;
}

/**
 * Schedule every 5 minutes. Works without Redis.
 */
export function scheduleResumeInboxPollJobs() {
    cron.schedule('*/5 * * * *', async () => {
        try {
            await processResumeInboxPoll();
        } catch (error) {
            logger.error('Resume Inbox poll cron error', { error: error.message });
        }
    });
    logger.info('Resume Inbox poll job scheduled (every 5 minutes)');
}

export default {
    processResumeInboxPoll,
    scheduleResumeInboxPollJobs,
};
