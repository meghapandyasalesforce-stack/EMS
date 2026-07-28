import { describe, it, expect } from '@jest/globals';
import { getArtifactsForInstalledPacks } from '../../constants/lifecyclePackWorkflowDefinitions.js';
import { resolveCountryCode, resolveCompliancePacksForCountry } from '../../services/lifecycleCountryAutoConfigService.js';
import { calculateNoticePeriod, resolveNoticePolicyDays } from '../../services/noticePeriodService.js';
import { seedMilestonesForWorkflow, computeMilestoneProgress } from '../../services/lifecycleMilestoneService.js';
import { calculateGratuity } from '../../services/gratuityCalculationService.js';

describe('gratuityCalculationService', () => {
    it('calculates India gratuity for eligible employee', () => {
        const result = calculateGratuity({
            lastDrawnBasic: 50000,
            lastDrawnDa: 10000,
            yearsOfService: 6,
            monthsOfService: 0,
        });
        expect(result.eligible).toBe(true);
        expect(result.amount).toBeGreaterThan(0);
    });

    it('rejects under 5 years service', () => {
        const result = calculateGratuity({
            lastDrawnBasic: 50000,
            yearsOfService: 3,
        });
        expect(result.eligible).toBe(false);
    });
});

describe('lifecyclePackWorkflowDefinitions', () => {
    it('merges IT industry pack artifacts', () => {
        const art = getArtifactsForInstalledPacks(['industry.it']);
        expect(art.tasks.some((t) => t.title.includes('GitHub'))).toBe(true);
        expect(art.softwareRequests.some((s) => s.system === 'GitHub')).toBe(true);
    });

    it('merges US compliance pack artifacts', () => {
        const art = getArtifactsForInstalledPacks(['compliance.us.core']);
        expect(art.tasks.some((t) => t.featureKey === 'compliance.us.i9')).toBe(true);
        expect(art.documentKeys).toContain('I9_FORM');
    });
});

describe('lifecycleCountryAutoConfigService', () => {
    it('resolves India country code', () => {
        expect(resolveCountryCode({ address: { country: 'India' } })).toBe('IN');
    });

    it('returns India compliance packs', () => {
        const packs = resolveCompliancePacksForCountry('IN');
        expect(packs).toContain('compliance.india.core');
    });

    it('returns US compliance pack', () => {
        const packs = resolveCompliancePacksForCountry('US');
        expect(packs).toContain('compliance.us.core');
    });
});

describe('noticePeriodService matrix', () => {
    it('uses grade policy when provided', () => {
        const days = resolveNoticePolicyDays({
            noticePeriodPolicy: {
                defaultNoticeDays: 30,
                gradePolicies: [{ grade: 'Senior', noticeDays: 90 }],
            },
        }, { grade: 'Senior' });
        expect(days).toBe(90);
    });

    it('calculates remaining notice days', () => {
        const start = new Date('2026-01-01');
        const lwd = new Date('2026-01-31');
        const result = calculateNoticePeriod({
            resignationDate: start,
            lastWorkingDate: lwd,
            policyDays: 30,
        });
        expect(result.servedDays).toBeGreaterThanOrEqual(0);
        expect(result.policyDays).toBe(30);
    });
});

describe('lifecycleMilestoneService', () => {
    it('seeds 30/60/90 milestones', () => {
        const wf = { milestones: [] };
        seedMilestonesForWorkflow(wf, new Date('2026-01-01'));
        expect(wf.milestones).toHaveLength(3);
        expect(wf.milestones.map((m) => m.day)).toEqual([30, 60, 90]);
    });

    it('computes milestone progress', () => {
        expect(computeMilestoneProgress([
            { status: 'Completed' },
            { status: 'Pending' },
            { status: 'Pending' },
        ])).toBe(33);
    });
});
