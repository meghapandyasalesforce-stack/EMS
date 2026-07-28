import { describe, expect, it } from '@jest/globals';
import {
    calculateNoticePeriod,
    resolveNoticePolicyDays,
    buildNoticePeriodDashboard,
} from '../../services/noticePeriodService.js';

describe('notice period service', () => {
    it('resolves default notice days from settings', () => {
        const days = resolveNoticePolicyDays({ noticePeriodPolicy: { defaultNoticeDays: 60 } });
        expect(days).toBe(60);
    });

    it('uses probation notice when applicable', () => {
        const days = resolveNoticePolicyDays(
            { noticePeriodPolicy: { defaultNoticeDays: 60, probationNoticeDays: 15 } },
            { isProbation: true },
        );
        expect(days).toBe(15);
    });

    it('calculates served and remaining days with buyout', () => {
        const result = calculateNoticePeriod({
            resignationDate: '2024-01-01',
            lastWorkingDate: '2024-01-20',
            policyDays: 30,
            buyoutDays: 5,
            leaveAdjustmentDays: 2,
        });
        expect(result.servedDays).toBe(12);
        expect(result.remainingDays).toBe(18);
        expect(result.status).toBe('Buyout');
    });

    it('marks notice as completed when fully served', () => {
        const result = calculateNoticePeriod({
            resignationDate: '2024-01-01',
            lastWorkingDate: '2024-02-01',
            policyDays: 30,
        });
        expect(result.remainingDays).toBe(0);
        expect(result.status).toBe('Completed');
    });

    it('builds notice period dashboard stats', () => {
        const stats = buildNoticePeriodDashboard([
            { noticePeriod: { status: 'Active' }, lastWorkingDate: new Date(Date.now() + 86400000 * 3) },
            { noticePeriod: { status: 'Completed' }, lastWorkingDate: new Date('2020-01-01') },
            { noticePeriod: { status: 'Buyout' }, lastWorkingDate: new Date(Date.now() + 86400000 * 5) },
        ]);
        expect(stats.active).toBe(1);
        expect(stats.completed).toBe(1);
        expect(stats.buyout).toBe(1);
        expect(stats.upcomingLwd).toBeGreaterThanOrEqual(1);
    });
});
