import { describe, it, expect } from '@jest/globals';
import leaveBalanceEngine from '../../services/leaveBalanceEngine.js';

describe('leaveBalanceEngine', () => {
    describe('calculateMonthsWorked', () => {
        it('counts months from year start through current month', () => {
            const year = 2026;
            const joiningDate = new Date(2020, 5, 15);
            const endDate = new Date(2026, 2, 15);
            const months = leaveBalanceEngine.calculateMonthsWorked(joiningDate, year, endDate);
            expect(months).toBe(3);
        });

        it('starts accrual from joining month when employee joins mid-year', () => {
            const year = 2026;
            const joiningDate = new Date(2026, 5, 1);
            const endDate = new Date(2026, 7, 31);
            const months = leaveBalanceEngine.calculateMonthsWorked(joiningDate, year, endDate);
            expect(months).toBe(3);
        });
    });

    describe('calculateSingleMonthEarned', () => {
        it('credits full monthly rate for join month from policy amount', () => {
            const employee = { joiningDate: new Date(2026, 5, 20) };
            const earned = leaveBalanceEngine.calculateSingleMonthEarned(
                0.5,
                employee,
                2026,
                5,
                employee.joiningDate
            );
            expect(earned).toBe(0.5);
        });

        it('returns 0 before joining month', () => {
            const employee = { joiningDate: new Date(2026, 5, 20) };
            const earned = leaveBalanceEngine.calculateSingleMonthEarned(
                0.5,
                employee,
                2026,
                4,
                employee.joiningDate
            );
            expect(earned).toBe(0);
        });
    });

    describe('calculateAccruedThroughDate', () => {
        it('sums policy monthly amount from join month through July', () => {
            const leaveTypeConfig = {
                type: 'casual',
                enabled: true,
                accrual: { method: 'monthly', frequency: 'monthly', amount: 0.5, maxAccrual: 6 },
            };
            const employee = { joiningDate: new Date(2026, 3, 1) };
            const julyEnd = new Date(2026, 6, 31);
            const total = leaveBalanceEngine.calculateAccruedThroughDate(
                leaveTypeConfig,
                employee,
                2026,
                julyEnd
            );
            expect(total).toBe(2);
        });

        it('caps accrual at annual entitlement', () => {
            const leaveTypeConfig = {
                type: 'sick',
                enabled: true,
                accrual: { method: 'monthly', frequency: 'monthly', amount: 1, maxAccrual: 6 },
            };
            const employee = { joiningDate: new Date(2020, 0, 1) };
            const decEnd = new Date(2026, 11, 31);
            const total = leaveBalanceEngine.calculateAccruedThroughDate(
                leaveTypeConfig,
                employee,
                2026,
                decEnd
            );
            expect(total).toBe(6);
        });
    });
});
