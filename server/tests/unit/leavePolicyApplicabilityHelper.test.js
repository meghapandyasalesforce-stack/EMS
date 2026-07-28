import { describe, it, expect } from '@jest/globals';
import {
    isLeavePolicyApplicableToEmployee,
    validateLeavePolicyApplicability,
    normalizeLeavePolicyApplicability,
    resolveEmployeeAssignedRoleId,
} from '../../helpers/leavePolicyApplicabilityHelper.js';

describe('leavePolicyApplicabilityHelper', () => {
    const roleId = '64b000000000000000000001';
    const empId = '64b0000000000000000000aa';

    describe('resolveEmployeeAssignedRoleId', () => {
        it('reads ObjectId and populated assignedRole', () => {
            expect(resolveEmployeeAssignedRoleId({ assignedRole: roleId })).toBe(roleId);
            expect(
                resolveEmployeeAssignedRoleId({ assignedRole: { _id: roleId, name: 'Manager' } })
            ).toBe(roleId);
            expect(resolveEmployeeAssignedRoleId({ role: 'admin' })).toBeNull();
        });
    });

    describe('isLeavePolicyApplicableToEmployee', () => {
        it('matches all', () => {
            expect(
                isLeavePolicyApplicableToEmployee({ applicableTo: 'all' }, { _id: empId })
            ).toBe(true);
        });

        it('matches department case-insensitively', () => {
            const policy = {
                applicableTo: 'department',
                applicableDepartments: ['Engineering'],
            };
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    department: 'engineering',
                })
            ).toBe(true);
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    department: 'Sales',
                })
            ).toBe(false);
        });

        it('matches assignedRole, not system role string', () => {
            const policy = {
                applicableTo: 'role',
                applicableRoles: [roleId],
            };
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    role: 'admin',
                    assignedRole: roleId,
                })
            ).toBe(true);
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    role: 'admin',
                })
            ).toBe(false);
        });

        it('matches specific employees including populated refs', () => {
            const policy = {
                applicableTo: 'employee',
                applicableEmployees: [{ _id: empId, name: 'A' }],
            };
            expect(isLeavePolicyApplicableToEmployee(policy, { _id: empId })).toBe(true);
            expect(
                isLeavePolicyApplicableToEmployee(policy, { _id: '64b0000000000000000000bb' })
            ).toBe(false);
        });
    });

    describe('validate + normalize', () => {
        it('requires selections for scoped policies', () => {
            expect(
                validateLeavePolicyApplicability({
                    applicableTo: 'department',
                    applicableDepartments: [],
                }).length
            ).toBeGreaterThan(0);
            expect(
                validateLeavePolicyApplicability({
                    applicableTo: 'department',
                    applicableDepartments: ['HR'],
                })
            ).toEqual([]);
        });

        it('clears unused scopes on normalize', () => {
            expect(
                normalizeLeavePolicyApplicability({
                    applicableTo: 'department',
                    applicableDepartments: ['HR', 'HR'],
                    applicableRoles: [roleId],
                    applicableEmployees: [empId],
                })
            ).toEqual({
                applicableTo: 'department',
                applicableDepartments: ['HR'],
                applicableRoles: [],
                applicableEmployees: [],
            });
        });
    });
});
