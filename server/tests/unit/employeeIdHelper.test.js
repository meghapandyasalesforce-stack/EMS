import { describe, it, expect } from '@jest/globals';
import { buildPrefixedEmployeeId, planEmployeeIdMigration } from '../../helpers/employeeIdHelper.js';

describe('employeeIdHelper', () => {
    it('builds padded tenant-scoped codes', () => {
        expect(buildPrefixedEmployeeId('prs', 1, 3)).toBe('PRS001');
        expect(buildPrefixedEmployeeId('ACME', 12, 4)).toBe('ACME0012');
    });

    it('skips migration when IDs already match the plan', () => {
        const plan = planEmployeeIdMigration(
            [
                { _id: 'a', employeeId: 'PRS001' },
                { _id: 'b', employeeId: 'PRS002' },
            ],
            { prefix: 'PRS', minDigits: 3, startNumber: 1 }
        );
        expect(plan.needsMigration).toBe(false);
        expect(plan.nextNumber).toBe(3);
    });

    it('plans remumber when prefix or sequence differs', () => {
        const plan = planEmployeeIdMigration(
            [
                { _id: 'a', employeeId: 'EMP-ABC-2026-1111' },
                { _id: 'b', employeeId: 'PRS001' },
            ],
            { prefix: 'PRS', minDigits: 3, startNumber: 1 }
        );
        expect(plan.needsMigration).toBe(true);
        expect(plan.assignments.map((row) => row.to)).toEqual(['PRS001', 'PRS002']);
    });
});
