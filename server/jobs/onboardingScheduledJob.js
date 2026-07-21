import cron from 'node-cron';
import logger from '../helpers/logger.js';
import { activateScheduledWorkflows } from '../services/onboardingService.js';

export async function processScheduledOnboarding() {
    try {
        const activated = await activateScheduledWorkflows();
        if (activated > 0) {
            logger.info('Scheduled onboarding workflows activated', { count: activated });
        }
        return activated;
    } catch (err) {
        logger.error('Scheduled onboarding job failed', { error: err.message });
        return 0;
    }
}

export function scheduleOnboardingJobs() {
    // Check every hour for workflows due to start on joining date
    cron.schedule('0 * * * *', async () => {
        await processScheduledOnboarding();
    });
    logger.info('Onboarding scheduled-start job registered (hourly)');
}

export default { scheduleOnboardingJobs, processScheduledOnboarding };
