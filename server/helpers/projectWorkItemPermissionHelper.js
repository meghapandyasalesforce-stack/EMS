/**
 * Employee work-plan edit rules:
 * - Direct assignee on item → can edit that item
 * - Assignee on any ancestor task → can edit that item and all descendants
 *   (parent task owner can edit all subtasks under that task)
 * Supports multi-assignee (assignees[]) and legacy single assignee.
 */

import { getWorkItemAssigneeIds } from './workItemAssigneeHelper.js';

export function buildAssigneeAncestorMap(flatItems) {
    const byId = new Map();
    for (const item of flatItems) {
        byId.set(item._id.toString(), item);
    }

    const ancestorAssignees = new Map();

    for (const item of flatItems) {
        const id = item._id.toString();
        const chain = [];
        let current = item;
        while (current?.parentTask) {
            const parent = byId.get(current.parentTask.toString());
            if (!parent) break;
            chain.push(parent);
            current = parent;
        }
        const ancestorIds = [];
        const seen = new Set();
        for (const p of chain) {
            for (const aid of getWorkItemAssigneeIds(p)) {
                if (!seen.has(aid)) {
                    seen.add(aid);
                    ancestorIds.push(aid);
                }
            }
        }
        ancestorAssignees.set(id, ancestorIds);
    }

    return { byId, ancestorAssignees };
}

/**
 * @param {object} item - work item (mongoose doc or lean)
 * @param {string} employeeId
 * @param {Map} ancestorAssignees - from buildAssigneeAncestorMap
 */
export function canEmployeeEditWorkItem(item, employeeId, ancestorAssignees) {
    if (!employeeId || !item) return false;
    const eid = employeeId.toString();
    const assigneeIds = getWorkItemAssigneeIds(item);
    if (assigneeIds.includes(eid)) return true;

    const ancestors = ancestorAssignees?.get(item._id.toString()) || [];
    return ancestors.some((aid) => aid === eid);
}

export function annotateFlatWithCanEdit(flatItems, employeeId) {
    const { ancestorAssignees } = buildAssigneeAncestorMap(flatItems);
    return flatItems.map((item) => ({
        ...item,
        canEdit: canEmployeeEditWorkItem(item, employeeId, ancestorAssignees)
    }));
}

export function annotateTreeWithCanEdit(tree, flatWithFlags) {
    const flagById = new Map(flatWithFlags.map((i) => [i._id.toString(), i.canEdit]));
    const walk = (nodes) =>
        (nodes || []).map((node) => ({
            ...node,
            canEdit: flagById.get(node._id.toString()) ?? false,
            subtasks: walk(node.subtasks)
        }));
    return walk(tree);
}

export function computeWorkPlanProgress(flatItems) {
    if (!flatItems?.length) return { total: 0, completed: 0, percent: 0 };
    const total = flatItems.length;
    const completed = flatItems.filter((i) => i.status === "completed").length;
    const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { total, completed, percent };
}
