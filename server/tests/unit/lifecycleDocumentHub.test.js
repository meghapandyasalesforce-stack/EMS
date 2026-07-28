import { describe, expect, it } from '@jest/globals';
import {
    computeExpiryDate,
    resolveCatalogMeta,
    applyHubMetadataToDocument,
    buildMissingDocumentsReport,
    exportDocumentsCsv,
} from '../../services/lifecycleDocumentHubService.js';

describe('lifecycleDocumentHubService', () => {
    it('computes expiry date from catalog expiryDays', () => {
        const uploadedAt = new Date('2026-01-01T00:00:00Z');
        const expiry = computeExpiryDate({ expiryDays: 365 }, uploadedAt);
        expect(expiry.getFullYear()).toBe(2027);
    });

    it('resolves catalog metadata with org overrides', () => {
        const meta = resolveCatalogMeta('PAN', { mandatory: false, hubCategory: 'Identity' });
        expect(meta.label).toBe('PAN Card');
        expect(meta.mandatory).toBe(false);
    });

    it('applies hub metadata including job document type mapping', () => {
        const doc = { name: 'Document', approvalStatus: 'Pending' };
        applyHubMetadataToDocument(doc, { catalogKey: 'AADHAAR' });
        expect(doc.catalogKey).toBe('AADHAAR');
        expect(doc.hubCategory).toBe('Identity');
        expect(doc.employeeJobDocumentType).toBe('AADHAR_CARD');
        expect(doc.requiresApproval).toBe(true);
    });

    it('builds missing documents report for mandatory catalog items', () => {
        const report = buildMissingDocumentsReport('org1', 'emp1', [
            { key: 'PAN', mandatory: true },
            { key: 'PHOTO', mandatory: false },
        ], [{ catalogKey: 'PHOTO', isActive: true }]);
        expect(report.missingCount).toBe(1);
        expect(report.missing[0].key).toBe('PAN');
    });

    it('exports documents to CSV', () => {
        const csv = exportDocumentsCsv([{
            _id: 'd1',
            name: 'PAN Card',
            catalogKey: 'PAN',
            hubCategory: 'Identity',
            verificationStatus: 'Approved',
            uploadedBy: 'e1',
            createdAt: '2026-01-01',
        }]);
        expect(csv).toContain('catalogKey,hubCategory');
        expect(csv).toContain('PAN');
    });
});
