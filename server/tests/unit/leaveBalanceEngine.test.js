import { describe, it, expect } from '@jest/globals';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';

describe('leaveBalanceEngine', () => {
    describe('calculateMonthsWorked', () => {
        it('counts months from year start through current month', () => {
            const year = 2026;
            const joiningDate = new Date(2020, 5, 15);
            const endDate = new Date(2026, 2, 15); // March 2026
            const months = leaveBalanceEngine.calculateMonthsWorked(joiningDate, year, endDate);
            expect(months).toBe(3);
        });

        it('starts accrual from joining month when employee joins mid-year', () => {
            const year = 2026;
            const joiningDate = new Date(2026, 5, 1); // June 2026
            const endDate = new Date(2026, 7, 31); // August 2026
            const months = leaveBalanceEngine.calculateMonthsWorked(joiningDate, year, endDate);
            expect(months).toBe(3);
        });
    });

    describe('calculateAccruedBalance monthly', () => {
        it('accrues monthly entitlement capped at yearly max', async () => {
            const leaveTypeConfig = {
                type: 'casual',
                maxDaysPerMonth: 2,
                accrual: { method: 'monthly', amount: 2, maxAccrual: 24 }
            };
            const employee = {
                joiningDate: new Date(2020, 0, 1)
            };
            const accrued = await leaveBalanceEngine.calculateAccruedBalance(
                leaveTypeConfig,
                employee,
                2026,
                'org-id'
            );
            const monthsThroughJune = leaveBalanceEngine.calculateMonthsWorked(
                employee.joiningDate,
                2026,
                new Date(2026, 5, 29)
            );
            expect(accrued).toBe(monthsThroughJune * 2);
            expect(accrued).toBeLessThanOrEqual(24);
        });
    });
});
