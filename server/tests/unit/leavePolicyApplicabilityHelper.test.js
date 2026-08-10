import { describe, it, expect } from '@jest/globals';
import {
    isLeavePolicyApplicableToEmployee,
    validateLeavePolicyApplicability,
    normalizeLeavePolicyApplicability,
    resolveEmployeeAssignedRoleId,
    isLeavePolicyEffectiveOnDate,
    selectApplicableLeavePolicy,
    buildEmployeeLeavePolicyMonthMap,
    resolveFirstApplicablePolicyMonth,
    groupLeavePolicyMonthMapIntoWindows,
    compareLeavePolicySelectionPriority,
    getLeavePolicyApplicabilitySpecificity,
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

        it('matches position case-insensitively', () => {
            const policy = {
                applicableTo: 'position',
                applicablePositions: ['Intern'],
            };
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    position: 'intern',
                })
            ).toBe(true);
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    position: 'Junior',
                })
            ).toBe(false);
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    jobTitle: 'Intern',
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

        it('custom OR includes position', () => {
            const policy = {
                applicableTo: 'custom',
                applicablePositions: ['Intern'],
                applicableDepartments: [],
            };
            expect(
                isLeavePolicyApplicableToEmployee(policy, {
                    _id: empId,
                    position: 'Intern',
                })
            ).toBe(true);
        });
    });

    describe('effective date windows', () => {
        const base = {
            _id: 'p1',
            applicableTo: 'all',
            isActive: true,
            leaveTypes: [{ type: 'casual', enabled: true, accrual: { amount: 1 } }],
        };

        it('excludes future-dated policies', () => {
            const policy = {
                ...base,
                effectiveDate: new Date(2026, 6, 1),
            };
            expect(isLeavePolicyEffectiveOnDate(policy, new Date(2026, 5, 30))).toBe(false);
            expect(isLeavePolicyEffectiveOnDate(policy, new Date(2026, 6, 1))).toBe(true);
        });

        it('excludes expired policies', () => {
            const policy = {
                ...base,
                effectiveDate: new Date(2026, 0, 1),
                expiryDate: new Date(2026, 5, 30),
            };
            expect(isLeavePolicyEffectiveOnDate(policy, new Date(2026, 5, 30))).toBe(true);
            expect(isLeavePolicyEffectiveOnDate(policy, new Date(2026, 6, 1))).toBe(false);
        });

        it('selects newest effective policy that is in window', () => {
            const oldPolicy = {
                ...base,
                _id: 'old',
                effectiveDate: new Date(2026, 0, 1),
                expiryDate: new Date(2026, 5, 30),
                policyName: 'H1',
            };
            const newPolicy = {
                ...base,
                _id: 'new',
                effectiveDate: new Date(2026, 6, 1),
                policyName: 'H2',
            };
            const employee = { _id: empId };

            expect(
                selectApplicableLeavePolicy([oldPolicy, newPolicy], employee, new Date(2026, 2, 15))
                    ?._id
            ).toBe('old');
            expect(
                selectApplicableLeavePolicy([oldPolicy, newPolicy], employee, new Date(2026, 7, 15))
                    ?._id
            ).toBe('new');
            expect(
                selectApplicableLeavePolicy([newPolicy], employee, new Date(2026, 2, 15))
            ).toBeNull();
        });

        it('breaks ties by specificity (employee > all)', () => {
            const allPolicy = {
                ...base,
                _id: 'all',
                applicableTo: 'all',
                effectiveDate: new Date(2026, 0, 1),
            };
            const empPolicy = {
                ...base,
                _id: 'emp',
                applicableTo: 'employee',
                applicableEmployees: [empId],
                effectiveDate: new Date(2026, 0, 1),
            };
            expect(
                selectApplicableLeavePolicy([allPolicy, empPolicy], { _id: empId }, new Date(2026, 3, 1))
                    ?._id
            ).toBe('emp');
            expect(compareLeavePolicySelectionPriority(empPolicy, allPolicy)).toBeLessThan(0);
        });

        it('ranks position above department and below role', () => {
            expect(getLeavePolicyApplicabilitySpecificity({ applicableTo: 'position' })).toBe(3);
            expect(getLeavePolicyApplicabilitySpecificity({ applicableTo: 'department' })).toBe(2);
            expect(getLeavePolicyApplicabilitySpecificity({ applicableTo: 'role' })).toBe(4);

            const deptPolicy = {
                ...base,
                _id: 'dept',
                applicableTo: 'department',
                applicableDepartments: ['Engineering'],
                effectiveDate: new Date(2026, 0, 1),
            };
            const posPolicy = {
                ...base,
                _id: 'pos',
                applicableTo: 'position',
                applicablePositions: ['Intern'],
                effectiveDate: new Date(2026, 0, 1),
            };
            expect(
                selectApplicableLeavePolicy(
                    [deptPolicy, posPolicy],
                    { _id: empId, department: 'Engineering', position: 'Intern' },
                    new Date(2026, 3, 1)
                )?._id
            ).toBe('pos');
        });

        it('builds mid-year month map and windows', () => {
            const oldPolicy = {
                ...base,
                _id: 'old',
                effectiveDate: new Date(2026, 0, 1),
                expiryDate: new Date(2026, 5, 30),
            };
            const newPolicy = {
                ...base,
                _id: 'new',
                effectiveDate: new Date(2026, 6, 1),
            };
            const map = buildEmployeeLeavePolicyMonthMap(
                [oldPolicy, newPolicy],
                { _id: empId },
                2026,
                0,
                2026,
                11
            );
            expect(map).toHaveLength(12);
            expect(map[0].policy._id).toBe('old');
            expect(map[5].policy._id).toBe('old');
            expect(map[6].policy._id).toBe('new');
            expect(map[11].policy._id).toBe('new');

            const windows = groupLeavePolicyMonthMapIntoWindows(map);
            expect(windows).toHaveLength(2);
            expect(windows[0].policy._id).toBe('old');
            expect(windows[0].endMonthIndex).toBe(5);
            expect(windows[1].policy._id).toBe('new');
            expect(windows[1].startMonthIndex).toBe(6);
        });

        it('finds the first month where a policy applies', () => {
            const futurePolicy = {
                ...base,
                _id: 'future',
                effectiveDate: new Date(2026, 5, 1),
            };
            const first = resolveFirstApplicablePolicyMonth(
                [futurePolicy],
                { _id: empId },
                2026,
                0,
                2026,
                11
            );
            expect(first).toEqual({
                year: 2026,
                monthIndex: 5,
                policy: futurePolicy,
            });
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
            expect(
                validateLeavePolicyApplicability({
                    applicableTo: 'position',
                    applicablePositions: [],
                }).length
            ).toBeGreaterThan(0);
            expect(
                validateLeavePolicyApplicability({
                    applicableTo: 'position',
                    applicablePositions: ['Intern'],
                })
            ).toEqual([]);
        });

        it('clears unused scopes on normalize', () => {
            expect(
                normalizeLeavePolicyApplicability({
                    applicableTo: 'department',
                    applicableDepartments: ['HR', 'HR'],
                    applicablePositions: ['Intern'],
                    applicableRoles: [roleId],
                    applicableEmployees: [empId],
                })
            ).toEqual({
                applicableTo: 'department',
                applicableDepartments: ['HR'],
                applicablePositions: [],
                applicableRoles: [],
                applicableEmployees: [],
            });

            expect(
                normalizeLeavePolicyApplicability({
                    applicableTo: 'position',
                    applicableDepartments: ['HR'],
                    applicablePositions: ['Intern', 'Intern'],
                    applicableRoles: [roleId],
                })
            ).toEqual({
                applicableTo: 'position',
                applicableDepartments: [],
                applicablePositions: ['Intern'],
                applicableRoles: [],
                applicableEmployees: [],
            });
        });
    });
});
