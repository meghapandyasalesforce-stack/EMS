/** @typedef {{ id: string, reportsTo: string|null, department?: string, departmentId?: string|null, position?: string, [key: string]: unknown }} ChartEmployee */

export const NODE_WIDTH = 214;
export const NODE_CENTER_X = NODE_WIDTH / 2;
/** Must match .employee-node height in CSS (prototype: 128px = 95 main + 33 footer). */
export const NODE_HEIGHT = 128;
/** Vertical distance between node tops (prototype spacing). */
export const LEVEL_GAP = 194;

/** Position levels treated as org-wide leadership (badges / stats; not auto-included in dept filters). */
export const EXECUTIVE_POSITIONS = new Set([
  'CEO',
  'CTO',
  'CFO',
  'VP',
  'Executive',
  'Director',
]);

export function getFullName(employee) {
  if (!employee) return '';
  return `${employee.name || ''} ${employee.lastName || ''}`.trim();
}

export function getById(employees, id) {
  return employees.find((e) => String(e.id) === String(id));
}

export function getChildren(employees, parentId) {
  return employees.filter((e) => e.reportsTo && String(e.reportsTo) === String(parentId));
}

export function getAncestors(employees, id) {
  const chain = [];
  let current = getById(employees, id);
  const seen = new Set();
  while (current) {
    const currentId = String(current.id);
    if (seen.has(currentId)) break;
    seen.add(currentId);
    chain.unshift(current);
    current = current.reportsTo ? getById(employees, current.reportsTo) : null;
  }
  return chain;
}

export function getDescendants(employees, id, seen = new Set()) {
  const rootId = String(id);
  if (seen.has(rootId)) return [];
  seen.add(rootId);

  const found = [];
  for (const child of getChildren(employees, id)) {
    const childId = String(child.id);
    if (seen.has(childId)) continue;
    found.push(child, ...getDescendants(employees, childId, seen));
  }
  return found;
}

export function isExecutive(employee) {
  if (!employee?.position) return false;
  return EXECUTIVE_POSITIONS.has(String(employee.position).trim());
}

export function matchesDepartment(employee, departmentFilter, departmentList = []) {
  if (!departmentFilter || departmentFilter === 'all') return true;
  const filter = String(departmentFilter);
  if (
    String(employee.departmentId || '') === filter ||
    String(employee.department || '') === filter
  ) {
    return true;
  }
  // Catalog chip uses ObjectId; employee may only store department name
  const chip = departmentList.find((d) => String(d.id || d.name) === filter);
  if (chip?.name) {
    return (
      String(employee.department || '').trim().toLowerCase() ===
      String(chip.name).trim().toLowerCase()
    );
  }
  return false;
}

/**
 * Department filter: Admin/CEO root(s) + selected-department employees +
 * ancestors needed to connect those employees to the root.
 * Do NOT include unrelated executives or other direct reports of the root.
 * Departments are grouping only — never tree nodes.
 */
export function getAllowedIds(employees, departmentFilter, departmentList = []) {
  if (!departmentFilter || departmentFilter === 'all') {
    return new Set(employees.map((e) => String(e.id)));
  }

  const ids = new Set();
  const inDept = (e) => matchesDepartment(e, departmentFilter, departmentList);

  // Always keep organization Admin / top-level root(s) (no manager)
  for (const e of employees) {
    if (!e.reportsTo) {
      ids.add(String(e.id));
    }
  }

  // Selected department people and their reporting-chain ancestors to the root
  for (const e of employees.filter(inDept)) {
    ids.add(String(e.id));
    getAncestors(employees, e.id).forEach((a) => ids.add(String(a.id)));
  }

  // In-department descendants under already-allowed nodes (subtree within dept)
  for (const id of [...ids]) {
    getDescendants(employees, id).forEach((d) => {
      if (inDept(d)) ids.add(String(d.id));
    });
  }

  return ids;
}

/**
 * Default expansion: open every manager who has a visible direct report.
 * Otherwise people under non-Admin / non-executive managers stay hidden
 * until each branch is opened manually.
 */
export function getSmartInitialExpanded(employees, allowedIds) {
  const allowed = new Set([...allowedIds].map(String));
  const expanded = new Set();

  for (const e of employees) {
    const id = String(e.id);
    if (!allowed.has(id)) continue;

    // Always open roots so the tree has an entry point
    if (!e.reportsTo) expanded.add(id);

    // Open every parent that has a visible child (full reporting chain)
    if (e.reportsTo) {
      const parentId = String(e.reportsTo);
      if (allowed.has(parentId)) expanded.add(parentId);
    }
  }

  return expanded;
}

export function buildChartLayout(employees, allowedIds, expandedIds) {
  const allowed = new Set([...allowedIds].map(String));
  const expanded = new Set([...expandedIds].map(String));

  const roots = employees.filter((e) => !e.reportsTo && allowed.has(String(e.id)));
  const orphanRoots = employees.filter(
    (e) => e.reportsTo && !allowed.has(String(e.reportsTo)) && allowed.has(String(e.id))
  );
  const allRoots = [...roots, ...orphanRoots.filter((o) => !roots.some((r) => r.id === o.id))];

  const positions = new Map();
  const widths = new Map();

  const visibleChildren = (emp, ancestry) => {
    if (!expanded.has(String(emp.id))) return [];
    return getChildren(employees, emp.id).filter((c) => {
      const childId = String(c.id);
      if (!allowed.has(childId)) return false;
      // Break circular manager chains (A → B → A) so layout cannot recurse forever
      if (ancestry.has(childId)) return false;
      return true;
    });
  };

  function width(emp, ancestry = new Set()) {
    const id = String(emp.id);
    if (widths.has(id)) return widths.get(id);
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(id);
    const ch = visibleChildren(emp, nextAncestry);
    const w = ch.length ? ch.reduce((sum, c) => sum + width(c, nextAncestry), 0) : NODE_WIDTH + 40;
    widths.set(id, w);
    return w;
  }

  let maxDepth = 0;

  function place(emp, left, depth, ancestry = new Set()) {
    const id = String(emp.id);
    if (ancestry.has(id)) return;
    const nextAncestry = new Set(ancestry);
    nextAncestry.add(id);
    const w = widths.get(id) ?? NODE_WIDTH + 40;
    positions.set(id, { x: left + w / 2 - NODE_CENTER_X, y: depth * LEVEL_GAP });
    maxDepth = Math.max(maxDepth, depth);
    let cursor = left;
    for (const child of visibleChildren(emp, nextAncestry)) {
      place(child, cursor, depth + 1, nextAncestry);
      cursor += widths.get(String(child.id)) ?? NODE_WIDTH + 40;
    }
  }

  let x = 0;
  for (const root of allRoots) {
    width(root);
    place(root, x, 0);
    x += widths.get(String(root.id));
  }

  return {
    positions,
    dimensions: {
      width: Math.max(x, NODE_WIDTH + 80),
      height: maxDepth * LEVEL_GAP + NODE_HEIGHT + 48,
    },
  };
}

/**
 * Prototype-style orthogonal connectors: parent bottom → mid bar → child top.
 */
export function buildConnectorEdges(positions, employees, pathIds) {
  const pathSet = new Set([...(pathIds || [])].map(String));
  const pos = (id) => (id == null ? null : positions.get(String(id)) || null);
  const edges = [];

  for (const id of positions.keys()) {
    const emp = getById(employees, id);
    if (!emp?.reportsTo) continue;

    const parent = pos(emp.reportsTo);
    const child = pos(id);
    if (!parent || !child) continue;

    const x1 = parent.x + NODE_CENTER_X;
    const y1 = parent.y + NODE_HEIGHT;
    const x2 = child.x + NODE_CENTER_X;
    const y2 = child.y;
    const mid = y1 + Math.max(28, (y2 - y1) * 0.42);
    const highlighted = pathSet.has(String(id)) && pathSet.has(String(emp.reportsTo));

    edges.push({
      id: `${emp.reportsTo}-${id}`,
      d: `M ${x1} ${y1} V ${mid} H ${x2} V ${y2}`,
      highlighted,
    });
  }

  return edges;
}

function roundRectPath(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fitCanvasText(ctx, text, maxWidth) {
  const raw = String(text || '').trim() || '—';
  if (ctx.measureText(raw).width <= maxWidth) return raw;
  let out = raw;
  while (out.length > 1 && ctx.measureText(`${out}…`).width > maxWidth) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/**
 * Draw the organization flowchart onto a canvas (no DOM/html2canvas — avoids oklch issues).
 * Uses the same layout positions as the interactive chart.
 */
export function renderOrgChartToCanvas({
  employees,
  positions,
  dimensions,
  scale = 2,
  padding = 48,
  title = 'Organization Chart',
}) {
  const contentW = Math.max(Number(dimensions?.width) || 0, NODE_WIDTH + 80);
  const contentH = Math.max(Number(dimensions?.height) || 0, NODE_HEIGHT + 80);
  const titleH = title ? 36 : 0;
  const width = contentW + padding * 2;
  const height = contentH + padding * 2 + titleH;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil(width * scale);
  canvas.height = Math.ceil(height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  ctx.scale(scale, scale);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);

  if (title) {
    ctx.fillStyle = '#334155';
    ctx.font = '600 16px Inter, Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, width / 2, padding / 2 + 4);
    ctx.textAlign = 'left';
  }

  const ox = padding;
  const oy = padding + titleH;

  // Connectors (orthogonal: parent → mid → child)
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const [id, childPos] of positions.entries()) {
    const emp = getById(employees, id);
    if (!emp?.reportsTo) continue;
    const parentPos = positions.get(String(emp.reportsTo));
    if (!parentPos) continue;

    const x1 = ox + parentPos.x + NODE_CENTER_X;
    const y1 = oy + parentPos.y + NODE_HEIGHT;
    const x2 = ox + childPos.x + NODE_CENTER_X;
    const y2 = oy + childPos.y;
    const mid = y1 + Math.max(28, (y2 - y1) * 0.42);

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x1, mid);
    ctx.lineTo(x2, mid);
    ctx.lineTo(x2, y2);
    ctx.strokeStyle = '#c5cfc0';
    ctx.lineWidth = 1.6;
    ctx.stroke();
  }

  // Employee cards
  for (const [id, pos] of positions.entries()) {
    const emp = getById(employees, id);
    if (!emp) continue;
    const x = ox + pos.x;
    const y = oy + pos.y;
    const childCount = getChildren(employees, emp.id).filter((c) =>
      positions.has(String(c.id))
    ).length;

    // Card
    roundRectPath(ctx, x, y, NODE_WIDTH, NODE_HEIGHT, 14);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.25;
    ctx.stroke();

    // Avatar circle
    const ax = x + 22;
    const ay = y + 28;
    ctx.beginPath();
    ctx.arc(ax, ay, 16, 0, Math.PI * 2);
    ctx.fillStyle = '#d1fae5';
    ctx.fill();
    ctx.fillStyle = '#0f766e';
    ctx.font = '600 12px Inter, Segoe UI, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const initial = (getFullName(emp) || '?').charAt(0).toUpperCase();
    ctx.fillText(initial, ax, ay + 0.5);
    ctx.textAlign = 'left';

    // Name + role
    const textLeft = x + 46;
    const textMax = NODE_WIDTH - 58;
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 13px Inter, Segoe UI, system-ui, sans-serif';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(fitCanvasText(ctx, getFullName(emp), textMax), textLeft, y + 24);

    ctx.fillStyle = '#64748b';
    ctx.font = '500 11px Inter, Segoe UI, system-ui, sans-serif';
    ctx.fillText(fitCanvasText(ctx, emp.jobTitle || '—', textMax), textLeft, y + 42);

    // Level + department pills
    const pillY = y + 56;
    let pillX = x + 14;
    const drawPill = (label, bg, fg) => {
      const t = fitCanvasText(ctx, label, 90);
      ctx.font = '600 10px Inter, Segoe UI, system-ui, sans-serif';
      const tw = ctx.measureText(t).width;
      const pw = tw + 14;
      const ph = 18;
      roundRectPath(ctx, pillX, pillY, pw, ph, 9);
      ctx.fillStyle = bg;
      ctx.fill();
      ctx.fillStyle = fg;
      ctx.textBaseline = 'middle';
      ctx.fillText(t, pillX + 7, pillY + ph / 2 + 0.5);
      pillX += pw + 6;
    };
    if (emp.position) drawPill(String(emp.position), '#f1f5f9', '#334155');
    if (emp.department) drawPill(String(emp.department), '#ecfdf5', '#0f766e');

    // Footer
    ctx.strokeStyle = '#f1f5f9';
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 92);
    ctx.lineTo(x + NODE_WIDTH - 10, y + 92);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.font = '500 10px Inter, Segoe UI, system-ui, sans-serif';
    ctx.textBaseline = 'middle';
    const footer =
      childCount > 0
        ? `${childCount} direct ${childCount === 1 ? 'report' : 'reports'}`
        : emp.employeeId
          ? String(emp.employeeId)
          : 'No direct reports';
    ctx.fillText(fitCanvasText(ctx, footer, NODE_WIDTH - 28), x + 14, y + 110);
  }

  return canvas;
}

/** Keep panned chart partially on screen so users don't lose it. */
export function clampPan(pan, zoom, dimensions, canvasWidth, canvasHeight) {
  if (!dimensions.width || !canvasWidth) return pan;
  const contentW = dimensions.width * zoom;
  const contentH = dimensions.height * zoom;
  const margin = 80;
  const minX = Math.min(margin, canvasWidth - contentW - margin);
  const maxX = Math.max(margin, canvasWidth - margin);
  const minY = Math.min(margin, canvasHeight - contentH - margin);
  const maxY = Math.max(margin, canvasHeight - margin);
  return {
    x: Math.min(maxX, Math.max(minX, pan.x)),
    y: Math.min(maxY, Math.max(minY, pan.y)),
  };
}

/**
 * Build unique department chips. Dedupes catalog id vs employee string name
 * (e.g. catalog "Engineering" + employees with department="Engineering" only).
 */
export function mergeDepartmentsWithCounts(catalogDepartments, employees) {
  const normalize = (name) => String(name || '').trim().toLowerCase();
  const byName = new Map();

  for (const d of catalogDepartments || []) {
    const name = String(d.name || '').trim();
    if (!name) continue;
    const norm = normalize(name);
    const existing = byName.get(norm);
    if (!existing) {
      byName.set(norm, {
        id: d.id ? String(d.id) : name,
        name: d.name || name,
        employeeCount: Number(d.employeeCount) || 0,
      });
    } else {
      // Prefer ObjectId from catalog when merging duplicates
      if (d.id && !/^[a-f\d]{24}$/i.test(String(existing.id))) {
        existing.id = String(d.id);
      }
      existing.employeeCount = Math.max(existing.employeeCount, Number(d.employeeCount) || 0);
      if (d.name && d.name.length >= existing.name.length) existing.name = d.name;
    }
  }

  // Recount from employees so chips stay accurate even if API counts differ
  for (const entry of byName.values()) {
    entry.employeeCount = 0;
  }

  for (const e of employees) {
    const name = String(e.department || '').trim();
    if (!name) continue;
    const norm = normalize(name);

    let entry = null;
    if (e.departmentId) {
      entry = [...byName.values()].find((d) => String(d.id) === String(e.departmentId));
    }
    if (!entry) entry = byName.get(norm);

    if (!entry) {
      entry = {
        id: e.departmentId || name,
        name,
        employeeCount: 0,
      };
      byName.set(norm, entry);
    }
    entry.employeeCount += 1;
  }

  return [...byName.values()]
    .filter((d) => d.name && normalize(d.name) !== 'unknown')
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function managerStateLabel(state) {
  switch (state) {
    case 'top_level':
      return 'Admin root (no manager)';
    case 'unresolved':
      return 'Manager not linked';
    case 'manager_missing':
      return 'Manager record missing';
    case 'manager_inactive':
      return 'Manager inactive';
    case 'manager_not_visible':
      return 'Manager outside your view';
    case 'linked':
      return null;
    default:
      return null;
  }
}
