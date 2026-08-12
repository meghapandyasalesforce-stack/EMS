/**
 * Keep employee.probation (Job Details) and OnboardingWorkflow.probation (Lifecycle) in sync.
 * Leave reads Lifecycle first, then employee — both stores should match after any update.
 */

import Employee from '../models/employee.model.js';
import Organization from '../models/organization.model.js';
import { OnboardingWorkflow } from '../models/onboarding.model.js';
import logger from './logger.js';

const EMPLOYEE_STATUSES = new Set([
    'None',
    'Not Started',
    'Active',
    'Extended',
    'Confirmed',
    'Waived',
    'Rejected',
    'Terminated',
]);

const LIFECYCLE_STATUSES = new Set([
    'Not Started',
    'Active',
    'Extended',
    'Confirmed',
    'Waived',
    'Rejected',
    'Terminated',
]);

/** Map Lifecycle status → employee.probation.status */
export function lifecycleStatusToEmployee(status) {
    const s = String(status || '').trim();
    if (!s || s === 'Not Started') return 'None';
    if (EMPLOYEE_STATUSES.has(s)) return s;
    return 'None';
}

/** Map employee.probation.status → Lifecycle status */
export function employeeStatusToLifecycle(status) {
    const s = String(status || '').trim();
    if (!s || s === 'None') return 'Not Started';
    if (LIFECYCLE_STATUSES.has(s)) return s;
    return 'Not Started';
}

export function mapLifecycleProbationToEmployee(probation) {
    if (!probation || typeof probation !== 'object') {
        return {
            status: 'None',
            startDate: null,
            endDate: null,
            confirmedAt: null,
            rejectedAt: null,
        };
    }
    return {
        status: lifecycleStatusToEmployee(probation.status),
        startDate: probation.startDate || null,
        endDate: probation.endDate || null,
        confirmedAt: probation.confirmedAt || null,
        rejectedAt: probation.rejectedAt || null,
    };
}

/**
 * Build employee.probation from Add Employee opt-in.
 * Default is no probation — must explicitly opt in.
 */
export function buildEmployeeProbationFromOptIn({
    onProbation = false,
    probationMonths = 6,
    joiningDate = null,
} = {}) {
    const optedIn =
        onProbation === true ||
        onProbation === 'true' ||
        onProbation === 1 ||
        onProbation === '1' ||
        String(onProbation).toLowerCase() === 'yes';

    if (!optedIn) {
        return {
            status: 'None',
            startDate: null,
            endDate: null,
            confirmedAt: null,
            rejectedAt: null,
        };
    }

    const months = Math.max(1, Math.min(36, Number(probationMonths) || 6));
    const start = joiningDate ? new Date(joiningDate) : new Date();
    const startDay = Number.isNaN(start.getTime())
        ? new Date()
        : new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const end = new Date(startDay);
    end.setMonth(end.getMonth() + months);

    return {
        status: 'Active',
        startDate: startDay,
        endDate: end,
        confirmedAt: null,
        rejectedAt: null,
    };
}

export function employeeHasActiveProbation(employee) {
    const status = String(employee?.probation?.status || '');
    return status === 'Active' || status === 'Extended';
}

export function normalizeEmployeeProbationStatus(status) {
    const s = String(status || '').trim();
    if (!s || s === 'Not Started') return 'None';
    return s;
}

export function isActiveProbationStatus(status) {
    const s = normalizeEmployeeProbationStatus(status);
    return s === 'Active' || s === 'Extended';
}

export function isExitedProbationStatus(status) {
    const s = normalizeEmployeeProbationStatus(status);
    return s === 'Confirmed' || s === 'Waived' || s === 'Rejected' || s === 'Terminated';
}

export function isNeverStartedProbationStatus(status) {
    return normalizeEmployeeProbationStatus(status) === 'None';
}

/** Org setting: missing/false means probation can only start at Add Employee. */
export async function resolveAllowProbationAfterJoining(organizationId) {
    if (!organizationId) return false;
    try {
        const org = await Organization.findById(organizationId)
            .select('settings.allowProbationAfterJoining')
            .lean();
        return org?.settings?.allowProbationAfterJoining === true;
    } catch (err) {
        logger.warn('Failed to read allowProbationAfterJoining', {
            error: err?.message,
            organizationId: String(organizationId),
        });
        return false;
    }
}

/**
 * When allowProbationAfterJoining is false:
 * - cannot start probation if it was never opted in at create
 * - cannot restart after confirmation / exit
 * Extend/reduce while Active or Extended is always allowed.
 */
export function evaluateProbationStartLock({
    currentStatus,
    nextStatus,
    allowProbationAfterJoining = false,
} = {}) {
    if (allowProbationAfterJoining) {
        return { allowed: true };
    }

    const current = normalizeEmployeeProbationStatus(currentStatus);
    const next = normalizeEmployeeProbationStatus(nextStatus);

    if (!isActiveProbationStatus(next) || isActiveProbationStatus(current)) {
        return { allowed: true };
    }

    if (isNeverStartedProbationStatus(current)) {
        return {
            allowed: false,
            reason:
                'Probation can only be started when creating the employee. Enable “Allow adding probation after joining” in Admin General Settings to start probation later.',
        };
    }

    if (isExitedProbationStatus(current)) {
        return {
            allowed: false,
            reason:
                'This employee has already completed probation and cannot be put on probation again. Enable “Allow adding probation after joining” in Admin General Settings to restart probation.',
        };
    }

    return { allowed: true };
}

export function resolveProbationMonthsFromEmployee(employee, fallback = 6) {
    const start = employee?.probation?.startDate
        ? new Date(employee.probation.startDate)
        : null;
    const end = employee?.probation?.endDate ? new Date(employee.probation.endDate) : null;
    if (
        start &&
        end &&
        !Number.isNaN(start.getTime()) &&
        !Number.isNaN(end.getTime()) &&
        end > start
    ) {
        const months =
            (end.getFullYear() - start.getFullYear()) * 12 +
            (end.getMonth() - start.getMonth());
        if (months >= 1) return Math.min(36, months);
    }
    return Math.max(1, Math.min(36, Number(fallback) || 6));
}

/**
 * Copy Lifecycle workflow.probation → employee.probation (Job Details).
 */
export async function syncEmployeeProbationFromWorkflow(workflow) {
    const employeeId = workflow?.employeeId?._id || workflow?.employeeId;
    if (!employeeId || !workflow?.probation) {
        return null;
    }

    const payload = mapLifecycleProbationToEmployee(workflow.probation);
    try {
        const updated = await Employee.findByIdAndUpdate(
            employeeId,
            { $set: { probation: payload } },
            { new: true }
        ).select('probation');
        return updated;
    } catch (err) {
        logger.warn('Failed to sync employee probation from Lifecycle', {
            error: err?.message,
            employeeId: String(employeeId),
            workflowId: String(workflow?._id || ''),
        });
        return null;
    }
}

/**
 * Copy employee.probation → Lifecycle onboarding workflow (if one exists).
 * Merges into existing workflow.probation so reviews / extensions history stay intact.
 * When employee is first put on Active probation and workflow has no probation yet, initializes it.
 */
export async function syncWorkflowProbationFromEmployee({
    organizationId,
    employeeId,
    probation,
} = {}) {
    if (!organizationId || !employeeId || !probation || typeof probation !== 'object') {
        return null;
    }

    try {
        const workflow = await OnboardingWorkflow.findOne({
            organizationId,
            employeeId,
            isTemplate: { $ne: true },
        });
        if (!workflow) {
            return null;
        }

        const { initProbationForWorkflow } = await import(
            '../services/lifecycleProbationService.js'
        );

        const nextStatus = employeeStatusToLifecycle(probation.status);
        const needsInit =
            !workflow.probation?.startDate &&
            (nextStatus === 'Active' || nextStatus === 'Extended');

        if (needsInit) {
            const months = resolveProbationMonthsFromEmployee({ probation }, 6);
            initProbationForWorkflow(workflow, {
                probationMonths: months,
                joiningDate: probation.startDate || workflow.joiningDate,
                startDate: probation.startDate || null,
                endDate: probation.endDate || null,
            });
        } else if (!workflow.probation) {
            workflow.probation = {};
        }

        if (probation.status !== undefined) {
            workflow.probation.status = nextStatus;
        }
        if (probation.startDate !== undefined) {
            workflow.probation.startDate = probation.startDate
                ? new Date(probation.startDate)
                : workflow.probation.startDate;
        }
        if (probation.endDate !== undefined) {
            workflow.probation.endDate = probation.endDate
                ? new Date(probation.endDate)
                : workflow.probation.endDate;
        }
        if (probation.confirmedAt !== undefined) {
            workflow.probation.confirmedAt = probation.confirmedAt
                ? new Date(probation.confirmedAt)
                : null;
            if (probation.confirmedAt && workflow.probation.status === 'Not Started') {
                workflow.probation.status = 'Confirmed';
            }
        }
        if (probation.rejectedAt !== undefined) {
            workflow.probation.rejectedAt = probation.rejectedAt
                ? new Date(probation.rejectedAt)
                : null;
        }

        if (!workflow.probation.originalEndDate && workflow.probation.endDate) {
            workflow.probation.originalEndDate = workflow.probation.endDate;
        }

        await workflow.save();
        return workflow;
    } catch (err) {
        logger.warn('Failed to sync Lifecycle probation from employee', {
            error: err?.message,
            employeeId: String(employeeId),
            organizationId: String(organizationId),
        });
        return null;
    }
}
