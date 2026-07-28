/**
 * Work-item assignee helpers (supports multi-assignee + legacy single assignee).
 */

export function toAssigneeIdString(value) {
  if (!value) return null;
  if (typeof value === 'string') return value;
  if (value._id) return value._id.toString();
  return value.toString();
}

/**
 * Resolve unique assignee ids from assignees[] and/or legacy assignee.
 */
export function getWorkItemAssigneeIds(item) {
  if (!item) return [];
  const ids = [];
  const seen = new Set();

  const push = (val) => {
    const id = toAssigneeIdString(val);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  if (Array.isArray(item.assignees) && item.assignees.length) {
    item.assignees.forEach(push);
  }
  if (item.assignee) push(item.assignee);

  return ids;
}

/**
 * Normalize incoming API payload (assignees array and/or assignee) to id strings.
 */
export function normalizeAssigneeInput({ assignees, assignee } = {}) {
  const ids = [];
  const seen = new Set();
  const push = (val) => {
    const id = toAssigneeIdString(val);
    if (!id || seen.has(id)) return;
    seen.add(id);
    ids.push(id);
  };

  if (Array.isArray(assignees)) {
    assignees.forEach(push);
  } else if (assignee !== undefined) {
    if (assignee === null || assignee === '') {
      return [];
    }
    push(assignee);
  }

  return ids;
}

export function applyAssigneesToWorkItem(item, assigneeIds) {
  const ids = Array.isArray(assigneeIds) ? [...new Set(assigneeIds.map(toAssigneeIdString).filter(Boolean))] : [];
  item.assignees = ids;
  item.assignee = ids.length ? ids[0] : undefined;
  return item;
}
