import cron from 'node-cron';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import Organization from '../models/organization.model.js';
import logger from '../helpers/logger.js';

/**
 * Daily job to calculate leave balances
 * Runs at 2 AM every day
 */
export const scheduleLeaveBalanceJobs = () => {
    // Daily balance calculation
    cron.schedule('0 2 * * *', async () => {
        logger.info('Running daily leave balance calculation job');
        try {
            const organizations = await Organization.find({});
            const currentYear = new Date().getFullYear();

            for (const org of organizations) {
                try {
                    // Recalculate balances for current year
                    await leaveBalanceEngine.recalculateBalances(org._id, currentYear);
                } catch (error) {
                    logger.error('Error in balance calculation for organization', {
                        organizationId: org._id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in leave balance job', { error: error.message });
        }
    });

    // Year-end carry-forward processing
    // Runs on January 1st at 3 AM
    cron.schedule('0 3 1 1 *', async () => {
        logger.info('Running year-end carry-forward job');
        try {
            const organizations = await Organization.find({});
            const previousYear = new Date().getFullYear() - 1;
            const currentYear = new Date().getFullYear();

            for (const org of organizations) {
                try {
                    await leaveBalanceEngine.processYearEndCarryForward(
                        org._id,
                        previousYear,
                        currentYear
                    );
                } catch (error) {
                    logger.error('Error in carry-forward for organization', {
                        organizationId: org._id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in year-end carry-forward job', { error: error.message });
        }
    });

    logger.info('Leave balance jobs scheduled');
};

