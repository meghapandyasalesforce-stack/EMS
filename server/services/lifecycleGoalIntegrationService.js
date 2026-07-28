/**
 * Onboarding ↔ Performance Goals integration (KRA/KPI during probation & milestones).
 */

import Goal from '../models/goal.model.js';
import { getOrCreateLifecycleSettings, isFeatureEnabled } from './lifecycleConfigService.js';
import { logLifecycleAudit } from './lifecycleAuditService.js';
import { notify } from '../helpers/notificationManager.js';

const DEFAULT_PROBATION_GOALS = [
    { title: 'Complete onboarding & mandatory training', goalType: 'KPI', category: 'Onboarding' },
    { title: 'Understand team processes and deliver first assigned task', goalType: 'KRA', category: 'Probation' },
    { title: 'Meet performance expectations for probation period', goalType: 'KPI', category: 'Probation' },
];

export async function assignOnboardingGoals(workflow, goalsPayload, { actor, req } = {}) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'goalAssignment')) {
        throw new Error('Goal assignment is disabled');
    }

    const employeeId = workflow.employeeId;
    const start = workflow.probation?.startDate || workflow.joiningDate || workflow.startDate || new Date();
    const end = workflow.probation?.endDate || new Date(start.getTime() + 180 * 86400000);

    const created = [];
    for (const g of goalsPayload) {
        const goal = await Goal.create({
            organizationId: workflow.organizationId,
            employeeId,
            title: g.title,
            description: g.description || `Onboarding/probation goal for workflow ${workflow._id}`,
            goalType: g.goalType || 'KPI',
            objective: g.objective,
            keyResults: g.keyResults || [],
            startDate: g.startDate || start,
            endDate: g.endDate || end,
            priority: g.priority || 'High',
            category: g.category || 'Onboarding',
            tags: [...(g.tags || []), 'onboarding', 'probation'],
            status: 'Not Started',
            progress: 0,
            milestones: g.milestones || [],
        });
        created.push(goal);
    }

    workflow.assignedGoalIds = [
        ...(workflow.assignedGoalIds || []).map(String),
        ...created.map((g) => g._id),
    ];

    workflow.activityFeed = workflow.activityFeed || [];
    workflow.activityFeed.unshift({
        action: 'goals_assigned',
        description: `${created.length} onboarding goal(s) assigned`,
        actor: actor?._id,
        createdAt: new Date(),
    });

    await logLifecycleAudit({
        action: 'Create',
        entityType: 'Onboarding',
        entityId: workflow._id,
        entityName: 'Goal Assignment',
        actor,
        req,
        metadata: { goalIds: created.map((g) => g._id) },
    });

    await notify({
        type: 'lifecycle_goals_assigned',
        organizationId: workflow.organizationId,
        data: { workflowId: workflow._id, employeeId, count: created.length },
    }).catch(() => {});

    return { goals: created, workflow };
}

export async function autoAssignDefaultProbationGoals(workflow, { actor } = {}) {
    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'goalAssignment')) return workflow;
    if (workflow.assignedGoalIds?.length) return workflow;

    const { workflow: updated } = await assignOnboardingGoals(
        workflow,
        DEFAULT_PROBATION_GOALS,
        { actor },
    );
    return updated;
}

export async function getOnboardingGoals(workflow) {
    if (!workflow.assignedGoalIds?.length) {
        const tagged = await Goal.find({
            organizationId: workflow.organizationId,
            employeeId: workflow.employeeId,
            tags: { $in: ['onboarding', 'probation'] },
        }).sort({ createdAt: -1 }).lean();
        return tagged;
    }
    return Goal.find({
        _id: { $in: workflow.assignedGoalIds },
        organizationId: workflow.organizationId,
    }).sort({ createdAt: -1 }).lean();
}

export function computeGoalsProgress(goals = []) {
    if (!goals.length) return 100;
    const avg = goals.reduce((sum, g) => sum + (g.progress || 0), 0) / goals.length;
    return Math.round(avg);
}

export async function syncGoalsProgressToWorkflow(workflow) {
    const goals = await getOnboardingGoals(workflow);
    workflow.goalsProgress = computeGoalsProgress(goals);
    workflow.onboardingGoals = goals.map((g) => ({
        goalId: g._id,
        title: g.title,
        goalType: g.goalType,
        progress: g.progress,
        status: g.status,
    }));
    return workflow;
}

export async function linkMilestoneGoals(workflow, day, goalTitles = []) {
    const milestone = (workflow.milestones || []).find((m) => m.day === day);
    if (!milestone) return workflow;

    const settings = await getOrCreateLifecycleSettings(workflow.organizationId);
    if (!isFeatureEnabled(settings, 'goalAssignment')) return workflow;

    const start = milestone.dueDate || new Date();
    const end = new Date(start);
    end.setDate(end.getDate() + 14);

    const payload = goalTitles.map((title) => ({
        title,
        goalType: 'KPI',
        category: `${day}-Day Milestone`,
        startDate: start,
        endDate: end,
        tags: ['milestone', `day_${day}`],
    }));

    if (payload.length) {
        await assignOnboardingGoals(workflow, payload, {});
    }
    return workflow;
}
