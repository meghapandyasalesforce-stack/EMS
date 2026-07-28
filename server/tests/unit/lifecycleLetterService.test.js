import { describe, expect, it } from '@jest/globals';
import { applyPlaceholders, buildLetterHtml } from '../../helpers/lifecycleLetterPdf.js';
import {
    buildLetterReports,
    categoryForLetterType,
    exportLettersCsv,
} from '../../services/lifecycleLetterService.js';

describe('lifecycleLetterService', () => {
    it('applies placeholders to template', () => {
        const result = applyPlaceholders('Dear {{employeeName}}, welcome to {{companyName}}.', {
            '{{employeeName}}': 'Alice',
            '{{companyName}}': 'Acme Corp',
        });
        expect(result).toContain('Alice');
        expect(result).toContain('Acme Corp');
    });

    it('builds letter html from header body footer', () => {
        const html = buildLetterHtml({
            headerHtml: '<p>{{companyName}}</p>',
            bodyHtml: '<p>Hello {{employeeName}}</p>',
            footerHtml: '<p>{{signatureBlock}}</p>',
            data: {
                '{{companyName}}': 'Acme',
                '{{employeeName}}': 'Bob',
                '{{signatureBlock}}': 'Sign here',
            },
        });
        expect(html).toContain('Acme');
        expect(html).toContain('Bob');
        expect(html).toContain('Sign here');
    });

    it('maps letter type to category', () => {
        expect(categoryForLetterType('experience_letter')).toBe('offboarding');
        expect(categoryForLetterType('appointment_letter')).toBe('onboarding');
    });

    it('builds letter reports', () => {
        const report = buildLetterReports([
            { status: 'PendingApproval', letterType: 'experience_letter' },
            { status: 'Sent', letterType: 'relieving_letter' },
            { status: 'Acknowledged', letterType: 'experience_letter' },
        ]);
        expect(report.total).toBe(3);
        expect(report.pendingApproval).toBe(1);
        expect(report.sent).toBe(2);
        expect(report.byLetterType.experience_letter).toBe(2);
    });

    it('exports letters csv', () => {
        const csv = exportLettersCsv([{ _id: 'l1', letterType: 'experience_letter', status: 'Sent', createdAt: '2026-01-01' }]);
        expect(csv).toContain('letterType');
        expect(csv).toContain('experience_letter');
    });
});
