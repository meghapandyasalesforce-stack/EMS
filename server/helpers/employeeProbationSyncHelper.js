/**
 * Keep employee.probation (Job Details) and OnboardingWorkflow.probation (Lifecycle) in sync.
 * Leave reads Lifecycle first, then employee — both stores should match after any update.
 */

import Employee from '../models/employee.model.js';
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

        if (!workflow.probation) {
            workflow.probation = {};
        }

        if (probation.status !== undefined) {
            workflow.probation.status = employeeStatusToLifecycle(probation.status);
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

        // Keep originalEndDate if missing
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
