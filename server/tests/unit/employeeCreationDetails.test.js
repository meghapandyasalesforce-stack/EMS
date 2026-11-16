import { describe, it, expect } from '@jest/globals';
import { employeeCreationDetails } from '../../helpers/employeeCreationDetails.js';
import Employee from '../../models/employee.model.js';

describe('employee creation profile details', () => {
    it('preserves contact, identity, dates and payroll fields using the employee schema', () => {
        const details = employeeCreationDetails({
            phone1: ' 0123456789 ', personalEmail: 'personal@example.com', birthDate: '1998-05-12',
            address: '12 Main Street', gender: 'Female', nationalIdType: 'Passport', nationalId: 'P123',
            emergencyContactName: 'Sam', emergencyContactPhone: '9876543210',
            financialDetails: { bankName: 'Bank', accountNo: '0012345', ifsc: 'ABCD0123456', taxRegime: 'new' },
        });
        const employee = new Employee(details);
        expect(employee.phone1).toBe('0123456789');
        expect(employee.birthDate.toISOString()).toBe('1998-05-12T00:00:00.000Z');
        expect(employee.financialDetails.accountNo).toBe('0012345');
        expect(employee.emergencyContactName).toBe('Sam');
        expect(employee.validateSync()?.errors.phone1).toBeUndefined();
    });

    it('ignores access fields, operator objects and empty optional values', () => {
        expect(employeeCreationDetails({
            organizationId: 'other-tenant', role: 'admin', status: 'active', birthDate: '',
            phone1: { $ne: null }, gender: ' ', financialDetails: { accountNo: { $gt: '' }, deductPf: false },
        })).toEqual({});
    });
});
