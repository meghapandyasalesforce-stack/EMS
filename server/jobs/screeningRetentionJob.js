/**
 * Auto-delete candidates who failed resume screening past retention date.
 */
import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { processScreeningRetention } from '../services/resumeScreeningService.js';

export async function runScreeningRetentionJob() {
    const result = await processScreeningRetention();
    if (result.deleted > 0 || result.errors > 0) {
        logger.info('Resume screening retention tick', result);
    }
    return result;
}

export function scheduleScreeningRetentionJobs() {
    // Daily at 02:15
    cron.schedule('15 2 * * *', async () => {
        try {
            await runScreeningRetentionJob();
        } catch (error) {
            logger.error('Resume screening retention cron error', { error: error.message });
        }
    });
    logger.info('Resume screening retention job scheduled (daily 02:15)');
}

export default {
    runScreeningRetentionJob,
    scheduleScreeningRetentionJobs,
};
