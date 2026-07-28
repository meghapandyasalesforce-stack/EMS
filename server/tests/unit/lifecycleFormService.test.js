import { describe, expect, it } from '@jest/globals';
import { buildFormReport, exportResponsesCsv } from '../../services/lifecycleFormService.js';

describe('lifecycleFormService reports', () => {
    const responses = [
        { _id: 'r1', status: 'Submitted', createdAt: new Date('2026-01-01T10:00:00Z'), submittedAt: new Date('2026-01-01T12:00:00Z') },
        { _id: 'r2', status: 'Draft', createdAt: new Date('2026-01-02T10:00:00Z') },
        { _id: 'r3', status: 'Rejected', createdAt: new Date('2026-01-03T10:00:00Z'), submittedAt: new Date('2026-01-03T11:00:00Z') },
        { _id: 'r4', status: 'Approved', createdAt: new Date('2026-01-04T10:00:00Z'), submittedAt: new Date('2026-01-04T14:00:00Z') },
    ];

    it('builds submission report aggregates', () => {
        const report = buildFormReport(responses);
        expect(report.total).toBe(4);
        expect(report.completed).toBe(2);
        expect(report.pending).toBe(1);
        expect(report.rejected).toBe(1);
        expect(report.avgCompletionHours).toBeGreaterThan(0);
    });

    it('exports responses as CSV', () => {
        const form = {
            fields: [
                { key: 'name', type: 'text', label: 'Name' },
                { key: 'heading1', type: 'heading', label: 'Section' },
            ],
        };
        const csv = exportResponsesCsv(form, [
            { _id: 'r1', status: 'Submitted', employeeId: 'e1', submittedAt: '2026-01-01', responses: { name: 'Alice' } },
        ]);
        expect(csv).toContain('responseId,status,employeeId,submittedAt,name');
        expect(csv).toContain('"Alice"');
        expect(csv).not.toContain('heading1');
    });
});
