import { describe, it, expect } from '@jest/globals';
import {
    lifecycleStatusToEmployee,
    employeeStatusToLifecycle,
    mapLifecycleProbationToEmployee,
    buildEmployeeProbationFromOptIn,
    employeeHasActiveProbation,
    evaluateProbationStartLock,
} from '../../helpers/employeeProbationSyncHelper.js';

describe('employeeProbationSyncHelper', () => {
    describe('status mapping', () => {
        it('maps Lifecycle Not Started to employee None', () => {
            expect(lifecycleStatusToEmployee('Not Started')).toBe('None');
            expect(lifecycleStatusToEmployee(null)).toBe('None');
        });

        it('maps employee None to Lifecycle Not Started', () => {
            expect(employeeStatusToLifecycle('None')).toBe('Not Started');
            expect(employeeStatusToLifecycle('')).toBe('Not Started');
        });

        it('preserves shared statuses both ways', () => {
            for (const status of ['Active', 'Extended', 'Confirmed', 'Waived', 'Rejected', 'Terminated']) {
                expect(lifecycleStatusToEmployee(status)).toBe(status);
                expect(employeeStatusToLifecycle(status)).toBe(status);
            }
        });
    });

    describe('mapLifecycleProbationToEmployee', () => {
        it('copies core probation fields for Job Details', () => {
            const start = new Date('2026-01-01');
            const end = new Date('2026-07-01');
            const confirmedAt = new Date('2026-06-15');
            expect(
                mapLifecycleProbationToEmployee({
                    status: 'Confirmed',
                    startDate: start,
                    endDate: end,
                    confirmedAt,
                    rejectedAt: null,
                    extensionDays: 30,
                })
            ).toEqual({
                status: 'Confirmed',
                startDate: start,
                endDate: end,
                confirmedAt,
                rejectedAt: null,
            });
        });

        it('defaults empty probation to None', () => {
            expect(mapLifecycleProbationToEmployee(null).status).toBe('None');
        });
    });

    describe('buildEmployeeProbationFromOptIn', () => {
        it('defaults to no probation when not opted in', () => {
            expect(buildEmployeeProbationFromOptIn({ onProbation: false }).status).toBe('None');
            expect(buildEmployeeProbationFromOptIn({}).status).toBe('None');
        });

        it('creates Active probation with duration when opted in', () => {
            const join = new Date(2026, 7, 10);
            const result = buildEmployeeProbationFromOptIn({
                onProbation: true,
                probationMonths: 3,
                joiningDate: join,
            });
            expect(result.status).toBe('Active');
            expect(result.startDate.getTime()).toBe(join.getTime());
            expect(result.endDate.getFullYear()).toBe(2026);
            expect(result.endDate.getMonth()).toBe(10);
            expect(result.endDate.getDate()).toBe(10);
        });
    });

    describe('employeeHasActiveProbation', () => {
        it('is true only for Active/Extended', () => {
            expect(employeeHasActiveProbation({ probation: { status: 'Active' } })).toBe(true);
            expect(employeeHasActiveProbation({ probation: { status: 'Extended' } })).toBe(true);
            expect(employeeHasActiveProbation({ probation: { status: 'None' } })).toBe(false);
            expect(employeeHasActiveProbation({ probation: { status: 'Confirmed' } })).toBe(false);
        });
    });

    describe('evaluateProbationStartLock', () => {
        it('allows all starts when org toggle is on', () => {
            expect(
                evaluateProbationStartLock({
                    currentStatus: 'None',
                    nextStatus: 'Active',
                    allowProbationAfterJoining: true,
                }).allowed
            ).toBe(true);
            expect(
                evaluateProbationStartLock({
                    currentStatus: 'Confirmed',
                    nextStatus: 'Active',
                    allowProbationAfterJoining: true,
                }).allowed
            ).toBe(true);
        });

        it('blocks starting probation after join when toggle is off', () => {
            const result = evaluateProbationStartLock({
                currentStatus: 'None',
                nextStatus: 'Active',
                allowProbationAfterJoining: false,
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/creating the employee/i);
        });

        it('blocks restarting after confirmation when toggle is off', () => {
            const result = evaluateProbationStartLock({
                currentStatus: 'Confirmed',
                nextStatus: 'Active',
                allowProbationAfterJoining: false,
            });
            expect(result.allowed).toBe(false);
            expect(result.reason).toMatch(/cannot be put on probation again/i);
        });

        it('allows extend/reduce while already on probation', () => {
            expect(
                evaluateProbationStartLock({
                    currentStatus: 'Active',
                    nextStatus: 'Extended',
                    allowProbationAfterJoining: false,
                }).allowed
            ).toBe(true);
            expect(
                evaluateProbationStartLock({
                    currentStatus: 'Active',
                    nextStatus: 'Active',
                    allowProbationAfterJoining: false,
                }).allowed
            ).toBe(true);
        });

        it('allows confirmation while on probation', () => {
            expect(
                evaluateProbationStartLock({
                    currentStatus: 'Active',
                    nextStatus: 'Confirmed',
                    allowProbationAfterJoining: false,
                }).allowed
            ).toBe(true);
        });
    });
});
