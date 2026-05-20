/**
 * Employee work-plan edit rules:
 * - Direct assignee on item → can edit that item
 * - Assignee on any ancestor task → can edit that item and all descendants
 *   (parent task owner can edit all subtasks under that task)
 */

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
        ancestorAssignees.set(
            id,
            chain
                .map((p) => {
                    if (!p.assignee) return null;
                    return p.assignee._id?.toString() || p.assignee.toString();
                })
                .filter(Boolean)
        );
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
    const assigneeId = item.assignee
        ? item.assignee._id?.toString() || item.assignee.toString()
        : null;
    if (assigneeId && assigneeId === eid) return true;

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
