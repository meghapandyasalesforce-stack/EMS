import { describe, it, expect, jest, beforeEach } from '@jest/globals';

jest.unstable_mockModule('../../models/employee.model.js', () => ({
    default: {
        findById: jest.fn(),
        findOne: jest.fn(),
    },
}));

const Employee = (await import('../../models/employee.model.js')).default;
const { resolveEmployeeLeaveBalanceAccess } = await import('../../helpers/leaveBalanceAccessHelper.js');

describe('resolveEmployeeLeaveBalanceAccess', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it('allows HR Manager via workforce profile when authContext is missing', async () => {
        const req = {
            organizationId: 'org-1',
            employee: {
                _id: 'hr-radha',
                jobTitle: 'HR Manager',
                department: 'HR',
                position: 'Manager',
                functionalRoles: [],
            },
        };

        const access = await resolveEmployeeLeaveBalanceAccess(req, 'emp-shreyansh', { forAdjust: false });

        expect(access.ok).toBe(true);
        expect(access.role).toBe('hr');
        expect(access.canAdjust).toBe(true);
        expect(Employee.findOne).not.toHaveBeenCalled();
    });

    it('allows HR when functionalRoles includes hr without authContext', async () => {
        const req = {
            organizationId: 'org-1',
            employee: {
                _id: 'hr-exec',
                jobTitle: 'HR Executive',
                department: 'Engineering',
                functionalRoles: ['hr'],
            },
        };

        const access = await resolveEmployeeLeaveBalanceAccess(req, 'emp-other', { forAdjust: false });
        expect(access.ok).toBe(true);
        expect(access.role).toBe('hr');
    });

    it('denies non-HR employee who is not the target manager', async () => {
        Employee.findOne.mockReturnValue({
            select: () => ({
                lean: async () => ({
                    _id: 'emp-shreyansh',
                    managerId: 'mgr-vivek',
                    manager: 'Vivek Rajput',
                    organizationId: 'org-1',
                }),
            }),
        });

        const req = {
            organizationId: 'org-1',
            employee: {
                _id: 'emp-other',
                jobTitle: 'Software Engineer',
                department: 'Engineering',
                functionalRoles: ['tech'],
                name: 'Other',
                lastName: 'User',
            },
        };

        const access = await resolveEmployeeLeaveBalanceAccess(req, 'emp-shreyansh', { forAdjust: false });
        expect(access.ok).toBe(false);
        expect(access.status).toBe(403);
        expect(access.message).toMatch(/Access denied/i);
    });
});
