/**
 * Probation period management — start, extension, confirmation, rejection.
 */

import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { notify } from '../helpers/notificationManager.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { syncEmployeeProbationFromWorkflow } from '../helpers/employeeProbationSyncHelper.js';

export function initProbationForWorkflow(workflow, { probationMonths = 6, joiningDate, startDate = null, endDate = null } = {}) {
    const startRaw = startDate || joiningDate || workflow.joiningDate || workflow.startDate || new Date();
    const start = new Date(startRaw);
    const startDay = Number.isNaN(start.getTime())
        ? new Date()
        : new Date(start.getFullYear(), start.getMonth(), start.getDate());

    let end;
    if (endDate) {
        const parsedEnd = new Date(endDate);
        end = Number.isNaN(parsedEnd.getTime())
            ? null
            : new Date(parsedEnd.getFullYear(), parsedEnd.getMonth(), parsedEnd.getDate());
    }
    if (!end) {
        end = new Date(startDay);
        end.setMonth(end.getMonth() + Math.max(1, Math.min(36, Number(probationMonths) || 6)));
    }

    workflow.probation = workflow.probation?.startDate ? workflow.probation : {
        startDate: startDay,
        endDate: end,
        originalEndDate: end,
        status: 'Active',
        extensionDays: 0,
        extensionReason: '',
        midReview: { status: 'Pending', scheduledDate: null, completedAt: null, rating: null, feedback: '' },
        finalReview: { status: 'Pending', scheduledDate: null, completedAt: null, rating: null, feedback: '' },
        confirmationLetterId: null,
        rejectedAt: null,
        rejectionReason: '',
        confirmedAt: null,
        confirmedBy: null,
    };
    return workflow;
}

export async function extendProbation(workflow, { extensionDays, reason }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'probation')) throw new Error('Probation tracking is disabled');

    if (!workflow.probation) initProbationForWorkflow(workflow);
    if (workflow.probation.status === 'Waived') {
        throw new Error('Probation is waived for this workflow (feature disabled)');
    }
    const end = new Date(workflow.probation.endDate);
    end.setDate(end.getDate() + extensionDays);
    workflow.probation.endDate = end;
    workflow.probation.extensionDays = (workflow.probation.extensionDays || 0) + extensionDays;
    workflow.probation.extensionReason = reason || workflow.probation.extensionReason;
    workflow.probation.status = 'Extended';

    workflow.activityFeed.unshift({
        action: 'probation_extended',
        description: `Probation extended by ${extensionDays} days`,
        actor: actor?._id,
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Update', entityType: 'Onboarding', entityId: workflow._id,
        entityName: 'Probation Extension', actor, req, metadata: { extensionDays },
    });
    await syncEmployeeProbationFromWorkflow(workflow);
    return workflow;
}

export async function submitProbationReview(workflow, { reviewType, rating, feedback, decision }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'probation')) throw new Error('Probation tracking is disabled');
    if (!workflow.probation) initProbationForWorkflow(workflow);
    if (workflow.probation.status === 'Waived') {
        throw new Error('Probation is waived for this workflow (feature disabled)');
    }

    const key = reviewType === 'mid' ? 'midReview' : 'finalReview';
    workflow.probation[key] = {
        ...workflow.probation[key],
        status: 'Completed',
        rating,
        feedback,
        completedAt: new Date(),
        completedBy: actor?._id,
    };

    if (reviewType === 'final' && decision) {
        if (decision === 'confirm') {
            workflow.probation.status = 'Confirmed';
            workflow.probation.confirmedAt = new Date();
            workflow.probation.confirmedBy = actor?._id;
        } else if (decision === 'reject') {
            workflow.probation.status = 'Rejected';
            workflow.probation.rejectedAt = new Date();
            workflow.probation.rejectionReason = feedback || '';
        } else if (decision === 'extend') {
            workflow.probation.status = 'Extended';
        }
    }

    await notify({
        type: 'lifecycle_probation_review',
        organizationId: workflow.organizationId,
        data: { workflowId: workflow._id, reviewType, decision },
    }).catch(() => {});

    await syncEmployeeProbationFromWorkflow(workflow);
    return workflow;
}

export function syncProbationReminders(workflow) {
    if (!workflow.probation || workflow.probation.status === 'Confirmed') return workflow;
    const now = new Date();
    const end = new Date(workflow.probation.endDate);
    const daysLeft = Math.ceil((end - now) / 86400000);
    if (daysLeft <= 14 && workflow.probation.finalReview?.status === 'Pending') {
        workflow.probation.finalReview.scheduledDate = workflow.probation.finalReview.scheduledDate || end;
    }
    const mid = new Date(workflow.probation.startDate);
    mid.setMonth(mid.getMonth() + Math.floor((workflow.probation.originalEndDate - workflow.probation.startDate) / 2 / 86400000 / 30));
    if (now >= mid && workflow.probation.midReview?.status === 'Pending') {
        workflow.probation.midReview.scheduledDate = workflow.probation.midReview.scheduledDate || mid;
    }
    return workflow;
}

export function buildProbationDashboard(workflows) {
    const withProb = workflows.filter((w) => w.probation?.status && w.probation.status !== 'Waived');
    return {
        active: withProb.filter((w) => ['Active', 'Extended'].includes(w.probation.status)).length,
        confirmed: withProb.filter((w) => w.probation.status === 'Confirmed').length,
        rejected: withProb.filter((w) => w.probation.status === 'Rejected').length,
        endingSoon: withProb.filter((w) => {
            if (!w.probation?.endDate) return false;
            const days = Math.ceil((new Date(w.probation.endDate) - new Date()) / 86400000);
            return days >= 0 && days <= 30 && ['Active', 'Extended'].includes(w.probation.status);
        }).length,
    };
}
