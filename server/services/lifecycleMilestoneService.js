/**
 * 30-60-90 day milestone tracking — integrated with onboarding workflow.
 */

import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { notify } from '../helpers/notificationManager.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';

export const MILESTONE_DAYS = Object.freeze([30, 60, 90]);

const defaultMilestone = (day) => ({
    day,
    title: `${day}-Day Review`,
    status: 'Pending',
    employeeReview: { status: 'Pending', rating: null, feedback: '', submittedAt: null },
    managerReview: { status: 'Pending', rating: null, feedback: '', submittedAt: null },
    hrReview: { status: 'Pending', rating: null, feedback: '', submittedAt: null },
    goals: [],
    actionItems: [],
    dueDate: null,
    completedAt: null,
});

export function seedMilestonesForWorkflow(workflow, joiningDate) {
    const base = joiningDate || workflow.joiningDate || workflow.startDate || new Date();
    const existing = new Map((workflow.milestones || []).map((m) => [m.day, m]));
    workflow.milestones = MILESTONE_DAYS.map((day) => {
        const m = existing.get(day) || defaultMilestone(day);
        if (!m.dueDate) {
            const due = new Date(base);
            due.setDate(due.getDate() + day);
            m.dueDate = due;
        }
        return m;
    });
    return workflow;
}

export function computeMilestoneProgress(milestones = []) {
    if (!milestones.length) return 0;
    const completed = milestones.filter((m) => m.status === 'Completed').length;
    return Math.round((completed / milestones.length) * 100);
}

export async function submitMilestoneReview(workflow, { day, reviewerRole, rating, feedback, goals, actionItems }, { actor, req }) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'milestone30_60_90')) {
        throw new Error('30-60-90 milestone tracking is disabled');
    }

    const milestone = (workflow.milestones || []).find((m) => m.day === day);
    if (!milestone) throw new Error(`Milestone day ${day} not found`);

    const reviewKey = reviewerRole === 'manager' ? 'managerReview'
        : reviewerRole === 'hr' ? 'hrReview' : 'employeeReview';

    milestone[reviewKey] = {
        status: 'Submitted',
        rating: rating ?? milestone[reviewKey]?.rating,
        feedback: feedback ?? milestone[reviewKey]?.feedback ?? '',
        submittedAt: new Date(),
        submittedBy: actor?._id,
    };
    if (goals?.length) milestone.goals = goals;
    if (actionItems?.length) milestone.actionItems = actionItems;

    const allSubmitted = ['employeeReview', 'managerReview', 'hrReview']
        .every((k) => milestone[k]?.status === 'Submitted' || milestone[k]?.status === 'Waived');
    if (allSubmitted) {
        milestone.status = 'Completed';
        milestone.completedAt = new Date();
    } else {
        milestone.status = 'In Progress';
    }

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'milestone_review_submitted',
        description: `${day}-day ${reviewerRole} review submitted`,
        actor: actor?._id,
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Update',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: `${day}-Day Milestone`,
        actor,
        req,
        metadata: { day, reviewerRole },
    });

    await notify({
        type: 'lifecycle_milestone_review_submitted',
        organizationId: workflow.organizationId,
        data: { workflowId: workflow._id, day, reviewerRole },
    }).catch(() => {});

    return workflow;
}

export function syncMilestoneOverdue(workflow) {
    const now = new Date();
    for (const m of workflow.milestones || []) {
        if (m.status !== 'Completed' && m.dueDate && new Date(m.dueDate) < now) {
            m.status = 'Overdue';
        }
    }
    return workflow;
}

export function buildMilestoneDashboard(workflows) {
    const all = workflows.flatMap((w) => (w.milestones || []).map((m) => ({ ...m, workflowId: w._id, employeeId: w.employeeId })));
    return {
        total: all.length,
        pending: all.filter((m) => m.status === 'Pending').length,
        inProgress: all.filter((m) => m.status === 'In Progress').length,
        completed: all.filter((m) => m.status === 'Completed').length,
        overdue: all.filter((m) => m.status === 'Overdue').length,
        byDay: Object.fromEntries(MILESTONE_DAYS.map((d) => [d, all.filter((m) => m.day === d)])),
    };
}
