import { describe, it, expect } from '@jest/globals';
import { parseSoftwareNotes } from '../../services/itProvisioningService.js';

describe('itProvisioningService.parseSoftwareNotes', () => {
    it('preserves legacy plain-text notes', () => {
        const parsed = parseSoftwareNotes('Use your company email to sign in.');
        expect(parsed.legacyNotes).toBe('Use your company email to sign in.');
        expect(parsed.details).toEqual({});
        expect(parsed.timeline).toEqual([]);
    });

    it('parses structured provisioning notes', () => {
        const raw = JSON.stringify({
            __accessProvisioning: true,
            legacyNotes: 'Assigned by HR',
            details: { accountId: 'abc@company.com', role: 'Member' },
            timeline: [{ type: 'approved', label: 'Approved', at: '2026-07-28T07:16:14.696Z', by: 'Tara Kumari' }],
            assignedByName: 'Tara Kumari',
            assignedOn: '2026-07-28T07:16:14.696Z',
            approvedDate: '2026-07-28T07:16:14.696Z',
            systemNote: 'Ticket created for IT provisioning',
        });

        const parsed = parseSoftwareNotes(raw);
        expect(parsed.legacyNotes).toBe('Assigned by HR');
        expect(parsed.details.accountId).toBe('abc@company.com');
        expect(parsed.assignedByName).toBe('Tara Kumari');
        expect(parsed.systemNote).toBe('Ticket created for IT provisioning');
    });

    it('recovers structured notes when older records have appended text', () => {
        const raw = `${JSON.stringify({
            __accessProvisioning: true,
            legacyNotes: 'test',
            details: { accountId: 'abc@gmail.com', role: 'team' },
            timeline: [{ type: 'approved', label: 'Approved', at: '2026-07-28T07:16:14.696Z', by: 'Tara Kumari' }],
            assignedByName: 'Tara Kumari',
            assignedOn: '2026-07-28T07:16:14.696Z',
            approvedDate: '2026-07-28T07:16:14.696Z',
        })} | Manual Processing Required — assign IT and mark provisioned when complete`;

        const parsed = parseSoftwareNotes(raw);
        expect(parsed.legacyNotes).toBe('test');
        expect(parsed.details.accountId).toBe('abc@gmail.com');
        expect(parsed.systemNote).toContain('Manual Processing Required');
    });
});
