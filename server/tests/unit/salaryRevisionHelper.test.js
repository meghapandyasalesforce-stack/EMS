import { describe, it, expect } from '@jest/globals';
import {
    getEffectiveSalaryForMonth,
    buildSalaryRevisionEntries
} from '../../helpers/salaryRevisionHelper.js';

describe('salaryRevisionHelper', () => {
    describe('getEffectiveSalaryForMonth', () => {
        it('falls back to emp.salary when no revisions', () => {
            expect(getEffectiveSalaryForMonth({ salary: 120000 }, 'May', 2026)).toBe(120000);
        });

        it('picks latest revision on or before target month', () => {
            const emp = {
                salary: 125000,
                salaryRevisions: [
                    { salary: 100000, effectiveFrom: new Date('2026-04-01') },
                    { salary: 125000, effectiveFrom: new Date('2026-09-01') }
                ]
            };
            expect(getEffectiveSalaryForMonth(emp, 'July', 2026)).toBe(100000);
            expect(getEffectiveSalaryForMonth(emp, 'October', 2026)).toBe(125000);
        });
    });

    describe('buildSalaryRevisionEntries', () => {
        it('creates initial and revision entries when history is empty', () => {
            const entries = buildSalaryRevisionEntries({
                previousSalary: 100000,
                newSalary: 125000,
                joiningDate: new Date('2026-04-01'),
                effectiveFrom: new Date('2026-09-01'),
                note: 'Promotion'
            });
            expect(entries).toHaveLength(2);
            expect(entries[0].salary).toBe(100000);
            expect(entries[1].salary).toBe(125000);
            expect(entries[1].note).toBe('Promotion');
        });
    });
});
