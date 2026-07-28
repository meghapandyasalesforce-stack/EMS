import { describe, it, expect } from '@jest/globals';
import {
    STATUTORY_DOC_TYPES,
    STATUTORY_MODULES,
    validatePan,
    validateUan,
    validateAadhaar,
    validateEsiNumber,
    financialYear,
} from '../../services/indiaStatutoryComplianceService.js';
import { listItTicketingProviders } from '../../services/itTicketingAdapter.js';
import { buildSoftwareInventoryDashboard } from '../../services/itProvisioningService.js';
import { listDashboardTypes } from '../../services/lifecycleDashboardService.js';
import { listSearchCategories } from '../../services/lifecycleSearchService.js';
import { BULK_OPERATIONS } from '../../services/lifecycleBulkOperationsService.js';
import { NOTIFICATION_CHANNELS } from '../../services/lifecycleNotificationCenterService.js';
import { applyBrandingToLetterHtml } from '../../services/lifecycleBrandingService.js';

describe('indiaStatutoryComplianceService', () => {
    it('exports all statutory doc types', () => {
        expect(STATUTORY_DOC_TYPES).toContain('form16');
        expect(STATUTORY_DOC_TYPES).toContain('tds_summary');
        expect(STATUTORY_DOC_TYPES.length).toBeGreaterThanOrEqual(10);
    });

    it('exports statutory modules metadata for all doc types', () => {
        expect(STATUTORY_MODULES).toHaveLength(STATUTORY_DOC_TYPES.length);
        for (const key of STATUTORY_DOC_TYPES) {
            const mod = STATUTORY_MODULES.find((m) => m.key === key);
            expect(mod).toBeTruthy();
            expect(mod.label).toBeTruthy();
            expect(mod.category).toBeTruthy();
            expect(mod.featureKey).toBeTruthy();
        }
    });

    it('validates PAN / UAN / Aadhaar / ESI and exposes financialYear', () => {
        expect(validatePan('ABCDE1234F').valid).toBe(true);
        expect(validatePan('bad').valid).toBe(false);
        expect(validateUan('123456789012').valid).toBe(true);
        expect(validateUan('123').valid).toBe(false);
        expect(validateAadhaar('123456789012').valid).toBe(true);
        expect(validateEsiNumber('1234567890').valid).toBe(true);
        expect(financialYear().label).toMatch(/^FY /);
    });
});

describe('itTicketingAdapter', () => {
    it('lists ticketing providers', () => {
        const providers = listItTicketingProviders();
        expect(providers.some((p) => p.key === 'servicenow')).toBe(true);
        expect(providers.some((p) => p.key === 'jira')).toBe(true);
    });
});

describe('itProvisioningService', () => {
    it('builds software inventory dashboard', () => {
        const dash = buildSoftwareInventoryDashboard([
            { softwareRequests: [{ system: 'GitHub', status: 'Provisioned' }, { system: 'Jira', status: 'Pending' }] },
        ]);
        expect(dash.totals.provisioned).toBe(1);
        expect(dash.totals.pending).toBe(1);
    });
});

describe('lifecycleDashboardService', () => {
    it('lists dashboard types', () => {
        const types = listDashboardTypes();
        expect(types.some((t) => t.key === 'executive')).toBe(true);
        expect(types.some((t) => t.key === 'hr')).toBe(true);
    });
});

describe('lifecycleSearchService', () => {
    it('lists search categories', () => {
        expect(listSearchCategories()).toContain('employees');
        expect(listSearchCategories()).toContain('workflows');
    });
});

describe('lifecycleBulkOperationsService', () => {
    it('defines bulk operations', () => {
        expect(BULK_OPERATIONS).toContain('onboarding_create');
        expect(BULK_OPERATIONS).toContain('letter_generate');
    });
});

describe('lifecycleNotificationCenterService', () => {
    it('defines notification channels', () => {
        expect(NOTIFICATION_CHANNELS).toContain('email');
        expect(NOTIFICATION_CHANNELS).toContain('teams');
    });
});

describe('lifecycleBrandingService', () => {
    it('applies branding placeholders', () => {
        const html = applyBrandingToLetterHtml('Hello {{companyName}}', { companyName: 'Acme Corp' });
        expect(html).toContain('Acme Corp');
    });
});
