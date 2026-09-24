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

        it('with cutoff 15, credits join month when joining on the 15th', () => {
            const employee = { joiningDate: new Date(2026, 8, 15) }; // 15 Sep
            const earned = leaveBalanceEngine.calculateSingleMonthEarned(
                1.5,
                employee,
                2026,
                8,
                employee.joiningDate,
                15
            );
            expect(earned).toBe(1.5);
        });

        it('with cutoff 15, skips join month when joining after the 15th', () => {
            const employee = { joiningDate: new Date(2026, 8, 28) }; // 28 Sep
            const joinMonth = leaveBalanceEngine.calculateSingleMonthEarned(
                1.5,
                employee,
                2026,
                8,
                employee.joiningDate,
                15
            );
            const nextMonth = leaveBalanceEngine.calculateSingleMonthEarned(
                1.5,
                employee,
                2026,
                9,
                employee.joiningDate,
                15
            );
            expect(joinMonth).toBe(0);
            expect(nextMonth).toBe(1.5);
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

    describe('calculateAccruedBalance lump-sum methods', () => {
        it('grants full Amount on/after join anniversary', async () => {
            const leaveTypeConfig = {
                type: 'sick',
                enabled: true,
                accrual: {
                    method: 'on_anniversary',
                    frequency: 'yearly',
                    amount: 0,
                    maxAccrual: 5,
                },
            };
            const employee = { joiningDate: new Date(2024, 2, 15) }; // 15 Mar
            const before = await leaveBalanceEngine.calculateAccruedBalance(
                leaveTypeConfig,
                employee,
                2026,
                null,
                new Date(2026, 2, 14)
            );
            const after = await leaveBalanceEngine.calculateAccruedBalance(
                leaveTypeConfig,
                employee,
                2026,
                null,
                new Date(2026, 2, 15)
            );
            expect(before).toBe(0);
            expect(after).toBe(5);
        });

        it('grants full Amount for yearly method once employed in the year', async () => {
            const leaveTypeConfig = {
                type: 'vacation',
                enabled: true,
                accrual: {
                    method: 'yearly',
                    frequency: 'yearly',
                    amount: 0,
                    maxAccrual: 6,
                },
            };
            const employee = { joiningDate: new Date(2025, 5, 1) };
            const total = await leaveBalanceEngine.calculateAccruedBalance(
                leaveTypeConfig,
                employee,
                2026,
                null,
                new Date(2026, 0, 15)
            );
            expect(total).toBe(6);
        });

        it('does not grant yearly Amount before the employee joins', async () => {
            const leaveTypeConfig = {
                type: 'vacation',
                enabled: true,
                accrual: {
                    method: 'yearly',
                    frequency: 'yearly',
                    amount: 0,
                    maxAccrual: 6,
                },
            };
            const employee = { joiningDate: new Date(2026, 5, 1) };
            const total = await leaveBalanceEngine.calculateAccruedBalance(
                leaveTypeConfig,
                employee,
                2026,
                null,
                new Date(2026, 2, 1)
            );
            expect(total).toBe(0);
        });
    });

    describe('effective-date policy windows', () => {
        it('resolves isolated policy window start from policy effective date', () => {
            const start = leaveBalanceEngine.resolvePolicyWindowStartDate(
                {
                    isolateUsageFromPriorPolicies: true,
                    effectiveDate: new Date(2026, 5, 1),
                },
                { joiningDate: new Date(2020, 0, 1) },
                2026,
                new Date(2026, 7, 1)
            );
            expect(start).toEqual(new Date(2026, 5, 1, 12, 0, 0, 0));
        });

        it('does not credit monthly accrual before the first applicable policy month', async () => {
            const leaveTypeConfig = {
                type: 'casual',
                enabled: true,
                accrual: { method: 'monthly', frequency: 'monthly', amount: 0.5, maxAccrual: 6 },
            };
            const employee = { joiningDate: new Date(2026, 0, 1) };
            const asOfDate = new Date(2026, 7, 31);
            const total = await leaveBalanceEngine.calculateAccruedBalance(
                leaveTypeConfig,
                employee,
                2026,
                null,
                asOfDate,
                (year, monthIndex) => {
                    if (year === 2026 && monthIndex >= 5) {
                        return { ...leaveTypeConfig, _sourcePolicyId: 'june-policy' };
                    }
                    return null;
                }
            );
            expect(total).toBe(1.5);
        });
    });
});
