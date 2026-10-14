import { getFullName } from './chartUtils';

export const DESKTOP_NODE_WIDTH = 244;
export const DESKTOP_NODE_HEIGHT = 144;
export const REPORT_BATCH = 6;
export const MIN_DESKTOP_ZOOM = 0.55;
export const READABLE_FIT_ZOOM = 0.85;
const GAP = 32;
const BRANCH_GAP = 68;

/** Index the API's actual reporting links. Never infer managers from departments. */
export function indexHierarchy(employees) {
  const byId = new Map(employees.map(employee => [String(employee.id), employee]));
  const children = new Map([...byId.keys()].map(id => [id, []]));
  const roots = [];
  for (const employee of byId.values()) {
    const parent = employee.reportsTo == null ? null : String(employee.reportsTo);
    if (parent && children.has(parent) && parent !== String(employee.id)) children.get(parent).push(employee);
    else roots.push(employee);
  }
  // Keep malformed cyclic components accessible without rewriting the API links.
  const reachable = new Set();
  const visit = employee => {
    const id = String(employee.id);
    if (reachable.has(id)) return;
    reachable.add(id);
    for (const child of children.get(id) || []) visit(child);
  };
  roots.forEach(visit);
  for (const employee of byId.values()) {
    if (!reachable.has(String(employee.id))) { roots.push(employee); visit(employee); }
  }
  const descendants = new Map();
  const count = (id, ancestry = new Set()) => {
    if (ancestry.has(id)) return 0;
    if (descendants.has(id)) return descendants.get(id);
    const next = new Set(ancestry).add(id);
    const total = (children.get(id) || []).reduce((sum, child) => {
      const childId = String(child.id);
      return next.has(childId) ? sum : sum + 1 + count(childId, next);
    }, 0);
    descendants.set(id, total);
    return total;
  };
  roots.forEach(employee => count(String(employee.id)));
  return { byId, children, roots, descendants };
}

export function initialDesktopExpansion(index, filtered = false) {
  if (index.byId.size <= 50 || filtered) return new Set(index.children.keys());
  const expanded = new Set();
  for (const root of index.roots) {
    expanded.add(String(root.id));
  }
  return expanded;
}

/** Pack sibling subtrees into bounded rows, reserving gutters for real reporting edges. */
export function buildDesktopLayout(index, expanded, limits = new Map(), revealed = new Set()) {
  const positions = new Map();
  const measured = new Map();
  const childrenFor = employee => {
    const id = String(employee.id);
    if (!expanded.has(id)) return [];
    const children = index.children.get(id) || [];
    const limit = limits.get(id) ?? Infinity;
    return children.filter((child, offset) => offset < limit || revealed.has(String(child.id)));
  };
  const measure = (employee, ancestry = new Set()) => {
    const id = String(employee.id);
    if (measured.has(id)) return measured.get(id);
    const next = new Set(ancestry).add(id);
    const children = childrenFor(employee).filter(child => !next.has(String(child.id)));
    const blocks = children.map(child => ({ employee: child, ...measure(child, next) }));
    const leafOnly = blocks.every(block => !block.blocks.length);
    const columns = Math.max(1, Math.min(leafOnly ? 12 : 4, Math.ceil(Math.sqrt(blocks.length || 1))));
    const columnWidths = Array(columns).fill(DESKTOP_NODE_WIDTH);
    const rowHeights = [];
    blocks.forEach((block, i) => {
      columnWidths[i % columns] = Math.max(columnWidths[i % columns], block.width);
      const row = Math.floor(i / columns);
      rowHeights[row] = Math.max(rowHeights[row] || 0, block.height);
    });
    const width = Math.max(DESKTOP_NODE_WIDTH, columnWidths.reduce((sum, value) => sum + value, 0) + (columns - 1) * GAP);
    const height = DESKTOP_NODE_HEIGHT + (blocks.length ? BRANCH_GAP + rowHeights.reduce((sum, value) => sum + value, 0) + (rowHeights.length - 1) * GAP : 0);
    const result = { width, height, blocks, columns, columnWidths, rowHeights };
    measured.set(id, result);
    return result;
  };
  const place = (employee, left, top, parentRoute = null) => {
    const id = String(employee.id);
    if (positions.has(id)) return;
    const block = measured.get(id);
    const position = { x: left + (block.width - DESKTOP_NODE_WIDTH) / 2, y: top, width: DESKTOP_NODE_WIDTH, height: DESKTOP_NODE_HEIGHT, parentRoute };
    positions.set(id, position);
    block.blocks.forEach((child, i) => {
      const column = i % block.columns;
      const row = Math.floor(i / block.columns);
      const childLeft = left + block.columnWidths.slice(0, column).reduce((sum, value) => sum + value + GAP, 0);
      const childTop = top + DESKTOP_NODE_HEIGHT + BRANCH_GAP + block.rowHeights.slice(0, row).reduce((sum, value) => sum + value + GAP, 0);
      place(child.employee, childLeft, childTop, { parentId: id, lane: childLeft - GAP / 2, row });
    });
  };
  let left = GAP;
  let height = 0;
  for (const root of index.roots) {
    const block = measure(root);
    place(root, left, GAP);
    left += block.width + GAP;
    height = Math.max(height, block.height + GAP * 2);
  }
  return { positions, dimensions: { width: Math.max(left, DESKTOP_NODE_WIDTH + GAP * 2), height: Math.max(height, DESKTOP_NODE_HEIGHT + GAP * 2) } };
}


export function hiddenDescendantCounts(index, positions) {
  const visibleCounts = new Map();
  const count = (id, seen = new Set()) => {
    if (seen.has(id)) return 0;
    if (visibleCounts.has(id)) return visibleCounts.get(id);
    const next = new Set(seen).add(id);
    const total = (index.children.get(id) || []).reduce((sum, child) => {
      const childId = String(child.id);
      return next.has(childId) ? sum : sum + (positions.has(childId) ? 1 : 0) + count(childId, next);
    }, 0);
    visibleCounts.set(id, total);
    return total;
  };
  index.roots.forEach(root => count(String(root.id)));
  return new Map([...index.byId.keys()].map(id => [id, Math.max(0, (index.descendants.get(id) || 0) - (visibleCounts.get(id) || 0))]));
}

export function employeeSearchText(employee) {
  return [getFullName(employee), employee.employeeId, employee.jobTitle, employee.department, employee.position].join(' ').toLowerCase();
}

/** Bound raster dimensions/pixel count without dropping employees from full exports. */
export function safeExportScale(dimensions, desired = 2) {
  const width = dimensions.width + 96;
  const height = dimensions.height + 132;
  return Math.min(desired, 8192 / width, 8192 / height, Math.sqrt(32_000_000 / (width * height)));
}
