import cron from 'node-cron';
import leaveBalanceEngine from '../services/leaveBalanceEngine.js';
import leaveBalanceAutomationService from '../services/leaveBalanceAutomationService.js';
import Organization from '../models/organization.model.js';
import logger from '../helpers/logger.js';

/**
 * Daily job to calculate leave balances
 * Runs at 2 AM every day
 */
export const scheduleLeaveBalanceJobs = () => {
    // Daily balance refresh — rolling engine credits all eligible months through today
    cron.schedule('0 2 * * *', async () => {
        logger.info('Running daily leave balance refresh');
        try {
            const organizations = await Organization.find({});
            const currentYear = new Date().getFullYear();

            for (const org of organizations) {
                try {
                    await leaveBalanceEngine.recalculateBalances(org._id, currentYear);
                } catch (error) {
                    logger.error('Error in daily balance refresh for organization', {
                        organizationId: org._id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in leave balance job', { error: error.message });
        }
    });

    // Monthly allocation — 1st of each month at 1 AM (auto +1.5 days, skip duplicates)
    cron.schedule('0 1 1 * *', async () => {
        logger.info('Running monthly leave allocation job');
        try {
            const organizations = await Organization.find({});
            for (const org of organizations) {
                try {
                    await leaveBalanceAutomationService.runMonthlyAllocationForOrganization(org._id);
                } catch (error) {
                    logger.error('Error in monthly allocation for organization', {
                        organizationId: org._id,
                        error: error.message
                    });
                }
            }
        } catch (error) {
            logger.error('Error in monthly leave allocation job', { error: error.message });
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

