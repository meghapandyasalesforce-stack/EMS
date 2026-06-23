import { describe, it, expect, afterEach, jest } from '@jest/globals';
import AttendanceRegularization from '../../models/attendanceRegularization.model.js';
import Employee from '../../models/employee.model.js';
import {
    createRegularizationRequest,
    rejectRegularization
} from '../../controllers/attendance/attendanceRegularizationController.js';

const createMockRes = () => {
    const res = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    return res;
};

describe('Attendance Regularization Controller', () => {
    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('rejects create request for non-current month', async () => {
        const req = {
            employee: { _id: 'employee-1', organizationId: 'org-1' },
            body: {
                attendanceDate: '2024-01-15T00:00:00.000Z',
                regularizationType: 'missing_clock_in',
                requestedClockIn: '2024-01-15T09:00:00.000Z',
                reason: 'Missed punch'
            }
        };
        const res = createMockRes();

        await createRegularizationRequest(req, res);

        expect(res.status).toHaveBeenCalledWith(400);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'Regularization is allowed only for the current month.'
            })
        );
    });

    it('reject denies manager for unlinked employee', async () => {
        const regularizationDoc = {
            _id: 'reg-1',
            organizationId: { toString: () => 'org-1' },
            employeeId: { _id: 'emp-1' },
            status: 'pending'
        };

        jest.spyOn(AttendanceRegularization, 'findById').mockReturnValue({
            populate: jest.fn().mockResolvedValue(regularizationDoc)
        });

        jest.spyOn(Employee, 'findById').mockReturnValue({
            select: jest.fn().mockReturnValue({
                lean: jest.fn().mockResolvedValue({
                    manager: 'Different Manager',
                    managerId: 'some-other-manager-id'
                })
            })
        });

        const req = {
            params: { id: 'reg-1' },
            body: { rejectionReason: 'Not valid' },
            employee: {
                _id: 'mgr-1',
                name: 'Current',
                lastName: 'Manager',
                organizationId: 'org-1',
                isManager: true,
                isHR: false
            }
        };
        const res = createMockRes();

        await rejectRegularization(req, res);

        expect(res.status).toHaveBeenCalledWith(403);
        expect(res.json).toHaveBeenCalledWith(
            expect.objectContaining({
                success: false,
                message: 'You can only reject regularization requests for employees linked to you or assigned to you.'
            })
        );
    });
});
