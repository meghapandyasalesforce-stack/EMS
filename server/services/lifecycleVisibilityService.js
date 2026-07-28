/**
 * Role-based Employee Lifecycle visibility (onboarding + offboarding).
 * Views: self | tasks | team | buddy
 * HR/Admin: no filter (org-wide).
 */

import mongoose from 'mongoose';
import Employee from '../models/employee.model.js';
import { OnboardingWorkflow, OffboardingWorkflow } from '../models/onboarding.model.js';

const OPEN_WF = { $nin: ['Completed', 'Cancelled'] };
const OPEN_TASK = { $nin: ['Completed', 'Cancelled'] };

export function actorIdSet(roleCtx) {
    return [...new Set(
        [roleCtx?.employeeId, roleCtx?.userId]
            .filter(Boolean)
            .map((id) => String(id)),
    )];
}

export function toObjectIds(ids) {
    return ids
        .filter(Boolean)
        .map((id) => {
            try {
                return new mongoose.Types.ObjectId(String(id));
            } catch {
                return null;
            }
        })
        .filter(Boolean);
}

/** Direct reports via Employee.managerId (org hierarchy). */
export async function getDirectReportIds(organizationId, managerEmployeeId) {
    if (!organizationId || !managerEmployeeId) return [];
    const reports = await Employee.find({
        organizationId,
        managerId: managerEmployeeId,
        status: { $in: ['active', 'Active', 'onboarding', 'probation'] },
    }).select('_id').lean();
    return reports.map((r) => r._id);
}

export function hasPendingManagerWorkOnboarding(workflow, actorIds) {
    const actors = new Set((actorIds || []).map(String));
    const isAssignedManager = actors.has(String(workflow.assignedManager?._id || workflow.assignedManager || ''));

    const pendingActions = (workflow.managerActions || []).some((a) => a.status !== 'Completed');
    if (isAssignedManager && pendingActions) return true;

    const pendingManagerTasks = (workflow.tasks || []).some((t) => {
        if (t.assigneeRole !== 'manager') return false;
        if (['Completed', 'Cancelled'].includes(t.status)) return false;
        const assigned = String(t.assignedTo?._id || t.assignedTo || '');
        return actors.has(assigned) || (isAssignedManager && !assigned);
    });
    if (pendingManagerTasks) return true;

    const pendingChecklist = (workflow.checklist || []).some((c) => {
        if (c.assignedRole !== 'manager') return false;
        return !['Completed', 'Verified', 'Done'].includes(c.status);
    });
    if (isAssignedManager && pendingChecklist) return true;

    const pendingMilestone = (workflow.milestones || []).some((m) =>
        m.managerReview?.status && m.managerReview.status !== 'Completed' && m.status !== 'Waived');
    if (isAssignedManager && pendingMilestone) return true;

    return false;
}

export function hasPendingManagerWorkOffboarding(workflow, actorIds) {
    const actors = new Set((actorIds || []).map(String));
    const isAssignedManager = actors.has(String(workflow.assignedManager?._id || workflow.assignedManager || ''));

    const pendingTasks = (workflow.tasks || []).some((t) => {
        if (t.assigneeRole !== 'manager') return false;
        if (['Completed', 'Cancelled'].includes(t.status)) return false;
        const assigned = String(t.assignedTo?._id || t.assignedTo || '');
        return actors.has(assigned) || (isAssignedManager && !assigned);
    });
    if (pendingTasks) return true;

    const pendingClearance = (workflow.clearanceChecklist || []).some((c) => {
        if (c.assignedRole !== 'manager') return false;
        return !['Completed', 'Verified', 'Cleared', 'Done'].includes(c.status);
    });
    if (isAssignedManager && pendingClearance) return true;

    return false;
}

/**
 * Enrich onboarding role context with visibility capability flags.
 */
export async function enrichOnboardingVisibility(roleCtx) {
    const organizationId = roleCtx.organizationId;
    const employeeId = roleCtx.employeeId;
    const actors = actorIdSet(roleCtx);
    const actorOids = toObjectIds(actors);

    let hasDirectReports = false;
    let hasPendingManagerTasks = false;
    let hasSelfWorkflow = false;
    let directReportIds = [];

    if (employeeId && organizationId) {
        directReportIds = await getDirectReportIds(organizationId, employeeId);
        hasDirectReports = directReportIds.length > 0;
        hasSelfWorkflow = Boolean(await OnboardingWorkflow.exists({
            organizationId,
            employeeId,
            isTemplate: { $ne: true },
            status: OPEN_WF,
        }));

        if (roleCtx.isManager || roleCtx.isLineManager || hasDirectReports || roleCtx.hasTeamOnboarding) {
            const candidates = await OnboardingWorkflow.find({
                organizationId,
                isTemplate: { $ne: true },
                status: OPEN_WF,
                $or: [
                    { assignedManager: { $in: actorOids } },
                    {
                        tasks: {
                            $elemMatch: {
                                assigneeRole: 'manager',
                                assignedTo: { $in: actorOids },
                                status: OPEN_TASK,
                            },
                        },
                    },
                ],
            })
                .select('assignedManager managerActions tasks checklist milestones')
                .limit(80)
                .lean();

            hasPendingManagerTasks = candidates.some((wf) => hasPendingManagerWorkOnboarding(wf, actors));
        }
    }

    const isLineManager = Boolean(roleCtx.isLineManager || roleCtx.isManager || hasDirectReports);
    const canViewTasks = isLineManager || hasPendingManagerTasks || Boolean(roleCtx.hasTeamOnboarding);
    const canViewTeam = hasDirectReports;

    // Re-check buddy assignments (assignedBuddy OR buddy-role tasks) so managers also get the Buddy toggle.
    let hasBuddyAssignments = Boolean(roleCtx.hasBuddyAssignments || roleCtx.isBuddy);
    if (employeeId && organizationId && !hasBuddyAssignments) {
        const actors = actorIdSet(roleCtx);
        const actorOids = toObjectIds(actors);
        hasBuddyAssignments = Boolean(await OnboardingWorkflow.exists({
            organizationId,
            isTemplate: { $ne: true },
            status: { $nin: ['Cancelled'] },
            $or: [
                { assignedBuddy: { $in: actorOids } },
                {
                    tasks: {
                        $elemMatch: {
                            assigneeRole: 'buddy',
                            assignedTo: { $in: actorOids },
                        },
                    },
                },
            ],
        }));
    }
    const canViewBuddy = hasBuddyAssignments;
    const canViewSelf = Boolean(employeeId);

    return {
        ...roleCtx,
        isLineManager,
        isBuddy: hasBuddyAssignments || Boolean(roleCtx.isBuddy),
        hasBuddyAssignments,
        hasDirectReports,
        hasPendingManagerTasks,
        hasSelfWorkflow,
        directReportIds,
        canViewSelf,
        canViewTasks,
        canViewTeam,
        canViewBuddy,
        isManager: Boolean(roleCtx.isManager || isLineManager || hasPendingManagerTasks),
    };
}

export async function enrichOffboardingVisibility(roleCtx) {
    const organizationId = roleCtx.organizationId;
    const employeeId = roleCtx.employeeId;
    const actors = actorIdSet(roleCtx);
    const actorOids = toObjectIds(actors);

    let hasDirectReports = false;
    let hasPendingManagerTasks = false;
    let hasSelfWorkflow = false;
    let directReportIds = [];

    if (employeeId && organizationId) {
        directReportIds = roleCtx.directReportIds?.length
            ? roleCtx.directReportIds
            : await getDirectReportIds(organizationId, employeeId);
        hasDirectReports = directReportIds.length > 0;
        hasSelfWorkflow = Boolean(await OffboardingWorkflow.exists({
            organizationId,
            employeeId,
            status: OPEN_WF,
        }));

        if (roleCtx.isManager || hasDirectReports || roleCtx.isLineManager) {
            const candidates = await OffboardingWorkflow.find({
                organizationId,
                status: OPEN_WF,
                $or: [
                    { assignedManager: { $in: actorOids } },
                    {
                        tasks: {
                            $elemMatch: {
                                assigneeRole: 'manager',
                                assignedTo: { $in: actorOids },
                                status: OPEN_TASK,
                            },
                        },
                    },
                ],
            })
                .select('assignedManager tasks clearanceChecklist')
                .limit(80)
                .lean();

            hasPendingManagerTasks = candidates.some((wf) => hasPendingManagerWorkOffboarding(wf, actors));
        }
    }

    const isLineManager = Boolean(roleCtx.isLineManager || roleCtx.isManager || hasDirectReports);
    return {
        ...roleCtx,
        isLineManager,
        hasDirectReports,
        hasPendingManagerTasks,
        hasSelfWorkflow,
        directReportIds,
        canViewSelf: Boolean(employeeId),
        canViewTasks: isLineManager || hasPendingManagerTasks,
        canViewTeam: hasDirectReports,
        canViewBuddy: false, // offboarding has no buddy assignment
    };
}

/**
 * Build Mongo query for onboarding dashboard by view.
 * @returns {{ query: object, postFilter?: (docs) => docs }}
 */
export async function buildOnboardingViewQuery(organizationId, roleCtx, view = 'self') {
    const base = { organizationId, isTemplate: { $ne: true } };
    const actors = actorIdSet(roleCtx);
    const actorOids = toObjectIds(actors);
    const normalized = normalizeLifecycleView(view, roleCtx);

    if (roleCtx.isHR || roleCtx.isAdmin) {
        if (normalized === 'team' && roleCtx.employeeId) {
            const reportIds = roleCtx.directReportIds?.length
                ? roleCtx.directReportIds
                : await getDirectReportIds(organizationId, roleCtx.employeeId);
            return { query: { ...base, employeeId: { $in: reportIds } }, view: 'team' };
        }
        if (normalized === 'buddy' && actors.length) {
            return { query: { ...base, assignedBuddy: { $in: actorOids } }, view: 'buddy' };
        }
        if (normalized === 'tasks' && actors.length) {
            return {
                query: {
                    ...base,
                    status: OPEN_WF,
                    $or: [
                        { assignedManager: { $in: actorOids } },
                        {
                            tasks: {
                                $elemMatch: {
                                    assigneeRole: 'manager',
                                    assignedTo: { $in: actorOids },
                                    status: OPEN_TASK,
                                },
                            },
                        },
                    ],
                },
                view: 'tasks',
                postFilter: (docs) => docs.filter((wf) => hasPendingManagerWorkOnboarding(wf, actors)),
            };
        }
        return { query: base, view: 'all' };
    }

    if (normalized === 'tasks') {
        return {
            query: {
                ...base,
                status: OPEN_WF,
                $or: [
                    { assignedManager: { $in: actorOids } },
                    {
                        tasks: {
                            $elemMatch: {
                                assigneeRole: 'manager',
                                assignedTo: { $in: actorOids },
                                status: OPEN_TASK,
                            },
                        },
                    },
                ],
            },
            view: 'tasks',
            postFilter: (docs) => docs.filter((wf) => hasPendingManagerWorkOnboarding(wf, actors)),
        };
    }

    if (normalized === 'team') {
        const reportIds = roleCtx.directReportIds?.length
            ? roleCtx.directReportIds
            : await getDirectReportIds(organizationId, roleCtx.employeeId);
        return {
            query: { ...base, employeeId: { $in: reportIds.length ? reportIds : [null] } },
            view: 'team',
        };
    }

    if (normalized === 'buddy') {
        return {
            query: {
                ...base,
                status: { $nin: ['Cancelled'] },
                $or: [
                    { assignedBuddy: { $in: actorOids.length ? actorOids : [null] } },
                    {
                        tasks: {
                            $elemMatch: {
                                assigneeRole: 'buddy',
                                assignedTo: { $in: actorOids.length ? actorOids : [null] },
                            },
                        },
                    },
                ],
            },
            view: 'buddy',
        };
    }

    // self
    if (!roleCtx.employeeId) {
        return { query: { ...base, employeeId: null }, view: 'self' };
    }
    return { query: { ...base, employeeId: roleCtx.employeeId }, view: 'self' };
}

export async function buildOffboardingViewQuery(organizationId, roleCtx, view = 'self') {
    const base = { organizationId };
    const actors = actorIdSet(roleCtx);
    const actorOids = toObjectIds(actors);
    const normalized = normalizeLifecycleView(view, roleCtx, { allowBuddy: false });

    if (roleCtx.isHR || roleCtx.isAdmin) {
        return { query: base, view: 'all' };
    }

    // IT / Payroll keep work-queue access under tasks (or dedicated), but RBAC spec focuses manager/employee.
    if (normalized === 'tasks') {
        const or = [
            { assignedManager: { $in: actorOids } },
            {
                tasks: {
                    $elemMatch: {
                        assigneeRole: 'manager',
                        assignedTo: { $in: actorOids },
                        status: OPEN_TASK,
                    },
                },
            },
        ];
        if (roleCtx.isIT) {
            or.push({ 'clearanceChecklist.assignedRole': 'it' });
            or.push({ 'accessRevocation.status': { $ne: 'Completed' } });
        }
        if (roleCtx.isPayroll) {
            or.push({ 'clearanceChecklist.assignedRole': 'payroll' });
        }
        if (roleCtx.isAssignee) {
            or.push({ 'tasks.assignedTo': { $in: actorOids } });
        }
        return {
            query: { ...base, status: OPEN_WF, $or: or },
            view: 'tasks',
            postFilter: (docs) => {
                // Managers: only pending manager work; IT/payroll/assignee keep their matches
                if (!roleCtx.isManager && !roleCtx.isLineManager) return docs;
                return docs.filter((wf) => {
                    if (hasPendingManagerWorkOffboarding(wf, actors)) return true;
                    if (roleCtx.isIT || roleCtx.isPayroll || roleCtx.isAssignee) {
                        return (wf.tasks || []).some((t) =>
                            actors.includes(String(t.assignedTo?._id || t.assignedTo || '')));
                    }
                    return false;
                });
            },
        };
    }

    if (normalized === 'team') {
        const reportIds = roleCtx.directReportIds?.length
            ? roleCtx.directReportIds
            : await getDirectReportIds(organizationId, roleCtx.employeeId);
        return {
            query: { ...base, employeeId: { $in: reportIds.length ? reportIds : [null] } },
            view: 'team',
        };
    }

    if (!roleCtx.employeeId) {
        return { query: { ...base, employeeId: null }, view: 'self' };
    }
    return { query: { ...base, employeeId: roleCtx.employeeId }, view: 'self' };
}

export function normalizeLifecycleView(view, roleCtx, { allowBuddy = true } = {}) {
    const v = String(view || 'self').toLowerCase();
    if (v === 'mine' || v === 'me' || v === '') return 'self';
    if (v === 'tasks' || v === 'my-tasks' || v === 'mytasks') return 'tasks';
    if (v === 'team') return 'team';
    if (allowBuddy && (v === 'buddy' || v === 'buddy-onboarding')) return 'buddy';
    if (roleCtx?.isHR || roleCtx?.isAdmin) return v === 'all' ? 'all' : 'all';
    return 'self';
}

/** Sanitize tasks for buddy-only viewers: no HR/manager tasks. */
export function sanitizeTasksForLifecycleView(workflow, roleCtx, view) {
    const tasks = workflow?.tasks || [];
    if (roleCtx?.isHR || roleCtx?.isAdmin) return tasks;

    const normalized = normalizeLifecycleView(view, roleCtx);
    const actors = actorIdSet(roleCtx);
    const isSubject = String(workflow.employeeId?._id || workflow.employeeId || '') === String(roleCtx.employeeId || '');

    if (normalized === 'buddy' || (roleCtx.canViewBuddy && !roleCtx.canViewTasks && !roleCtx.canViewTeam && !isSubject)) {
        return tasks.filter((t) => {
            const assigned = String(t.assignedTo?._id || t.assignedTo || '');
            if (t.assigneeRole === 'buddy') return actors.includes(assigned) || !assigned;
            return actors.includes(assigned);
        });
    }

    if (normalized === 'self' || isSubject) {
        return tasks.filter((t) => {
            const assigned = String(t.assignedTo?._id || t.assignedTo || '');
            if (actors.includes(assigned)) return true;
            if (t.assigneeRole === 'employee' && isSubject) return true;
            return false;
        });
    }

    // Manager team/tasks: full visibility of workflow progress
    return tasks;
}
