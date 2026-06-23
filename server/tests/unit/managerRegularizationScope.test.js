import { describe, it, expect } from '@jest/globals';
import {
    buildManagerRegularizationScopeFilter,
    isAssignedRegularizationApprover,
    canLineManagerAccessRegularization,
} from '../../helpers/managerHelper.js';

describe('manager regularization scope', () => {
    const manager = { _id: 'mgr-1', name: 'Pat', lastName: 'Lee' };

    it('buildManagerRegularizationScopeFilter includes team and assigned manager', () => {
        const filter = buildManagerRegularizationScopeFilter(manager, ['emp-1', 'emp-2']);

        expect(filter).toEqual({
            $or: [
                { employeeId: { $in: ['emp-1', 'emp-2'] } },
                { managerId: 'mgr-1' },
            ],
        });
    });

    it('buildManagerRegularizationScopeFilter still includes assigned manager with empty team', () => {
        const filter = buildManagerRegularizationScopeFilter(manager, []);

        expect(filter).toEqual({
            $or: [{ managerId: 'mgr-1' }],
        });
    });

    it('isAssignedRegularizationApprover matches request.managerId', () => {
        expect(
            isAssignedRegularizationApprover({ managerId: 'mgr-1' }, manager)
        ).toBe(true);
        expect(
            isAssignedRegularizationApprover({ managerId: { _id: 'mgr-1' } }, manager)
        ).toBe(true);
        expect(
            isAssignedRegularizationApprover({ managerId: 'other' }, manager)
        ).toBe(false);
    });

    it('canLineManagerAccessRegularization allows assigned approver without team link', () => {
        const req = {
            employee: { _id: 'mgr-1', isManager: true, isHR: false, name: 'Pat', lastName: 'Lee' },
        };
        const request = { managerId: 'mgr-1' };
        const employee = { manager: 'CEO', managerId: null };

        expect(canLineManagerAccessRegularization(req, request, employee)).toBe(true);
    });

    it('canLineManagerAccessRegularization denies unrelated manager', () => {
        const req = {
            employee: { _id: 'mgr-1', isManager: true, isHR: false, name: 'Pat', lastName: 'Lee' },
        };
        const request = { managerId: 'mgr-2' };
        const employee = { manager: 'CEO', managerId: null };

        expect(canLineManagerAccessRegularization(req, request, employee)).toBe(false);
    });
});
