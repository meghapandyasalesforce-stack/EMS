/** Flatten only open reporting branches, retaining actual parent IDs and API order. */
export function flattenMobileHierarchy(index, expanded, limits = new Map(), revealed = new Set()) {
  const rows = [];
  const visited = new Set();
  const visit = (employee, depth, parentId = null) => {
    const id = String(employee.id);
    if (visited.has(id)) return;
    visited.add(id);
    rows.push({ id, employee, depth, parentId, key: id });
    if (!expanded.has(id)) return;
    const children = index.children.get(id) || [];
    const limit = limits.get(id) ?? Infinity;
    children.forEach((child, offset) => {
      if (offset < limit || revealed.has(String(child.id))) visit(child, depth + 1, id);
    });
    if (children.some((child, offset) => offset >= limit && !revealed.has(String(child.id)))) {
      rows.push({ key: `more-${id}`, parentId: id, depth: depth + 1, more: true });
    }
  };
  index.roots.forEach(employee => visit(employee, 0));
  return rows;
}
