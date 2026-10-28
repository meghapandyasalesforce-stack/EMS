import { describe, it, expect } from 'vitest';
import { buildConnectorEdges, buildChartLayout, getAllowedIds, mergeDepartmentsWithCounts } from './chartUtils';
import { buildDesktopLayout, chooseSiblingColumns, hiddenDescendantCounts, indexHierarchy, initialDesktopExpansion, REPORT_BATCH, safeExportScale } from './desktopChartUtils';

function fixture(count, flat = false) {
  return Array.from({ length: count }, (_, i) => ({ id: String(i), name: i < 2 ? 'Duplicate' : `Employee ${i}`, employeeId: `EMP${i}`, reportsTo: i ? String(flat ? 0 : Math.floor((i - 1) / 6)) : null, department: `Department ${i % 8}`, position: i ? 'Employee' : 'CEO' }));
}
function assertNoOverlap(positions) {
  const list = [...positions.values()];
  for (let i = 0; i < list.length; i += 1) for (let j = i + 1; j < list.length; j += 1) {
    const a = list[i]; const b = list[j];
    expect(a.x + a.width <= b.x || b.x + b.width <= a.x || a.y + a.height <= b.y || b.y + b.height <= a.y).toBe(true);
  }
}

describe('scalable desktop hierarchy', () => {
  it('keeps siblings on one row through a double batch (mock-style)', () => {
    expect(chooseSiblingColumns(3, false, 40)).toBe(3);
    expect(chooseSiblingColumns(6, true, 40)).toBe(6);
    expect(chooseSiblingColumns(6, false, 40)).toBe(6);
    expect(chooseSiblingColumns(12, true, 40)).toBe(12);
    expect(chooseSiblingColumns(12, false, 200)).toBe(12);
    expect(chooseSiblingColumns(20, true, 200)).toBeLessThanOrEqual(8);
    expect(chooseSiblingColumns(20, false, 200)).toBeLessThanOrEqual(8);
    expect(chooseSiblingColumns(100, true, 500)).toBeLessThanOrEqual(8);
  });

  it('places a batch of leaf peers on a single Y row', () => {
    const employees = fixture(7, true);
    const index = indexHierarchy(employees);
    const layout = buildDesktopLayout(index, new Set(['0']), new Map([['0', REPORT_BATCH]]));
    const childYs = [...layout.positions.entries()]
      .filter(([id]) => id !== '0')
      .map(([, pos]) => pos.y);
    expect(childYs).toHaveLength(REPORT_BATCH);
    expect(new Set(childYs).size).toBe(1);
  });
  it.each([20, 50, 200, 500])('represents every one of %i employees exactly once with accurate edges', count => {
    const employees = fixture(count); const before = JSON.stringify(employees); const index = indexHierarchy(employees);
    const layout = buildDesktopLayout(index, new Set(index.byId.keys()));
    expect(layout.positions.size).toBe(count);
    expect(new Set(layout.positions.keys()).size).toBe(count);
    expect(buildConnectorEdges(layout.positions, employees, new Set())).toHaveLength(count - 1);
    assertNoOverlap(layout.positions);
    expect(JSON.stringify(employees)).toBe(before);
    for (const employee of employees.slice(1)) {
      const position = layout.positions.get(employee.id);
      expect(position.parentRoute.parentId).toBe(employee.reportsTo);
      expect(position.y).toBeGreaterThan(layout.positions.get(employee.reportsTo).y);
    }
  });
  it('packs a 500-report branch into bounded rows and batches it without losing employees', () => {
    const employees = fixture(500, true); const index = indexHierarchy(employees);
    const collapsed = buildDesktopLayout(index, new Set(['0']), new Map([['0', REPORT_BATCH]]));
    expect(collapsed.positions.size).toBe(REPORT_BATCH + 1);
    expect(hiddenDescendantCounts(index, collapsed.positions).get('0')).toBe(499 - REPORT_BATCH);
    const full = buildDesktopLayout(index, new Set(index.byId.keys()));
    expect(full.positions.size).toBe(500); expect(full.dimensions.width).toBeLessThan(4000);
    assertNoOverlap(full.positions);
  });
  it('reveals a searched ID beyond the batch without expanding unrelated siblings', () => {
    const index = indexHierarchy(fixture(500, true));
    const layout = buildDesktopLayout(index, new Set(['0']), new Map([['0', 6]]), new Set(['499']));
    expect(layout.positions.has('499')).toBe(true);
    expect(layout.positions.has('498')).toBe(false);
    expect(layout.positions.size).toBe(8);
  });
  it('uses practical defaults but expands small organizations completely', () => {
    for (const count of [20, 50, 200, 500]) {
      const index = indexHierarchy(fixture(count));
      const limits = count > 50 ? new Map([...index.byId.keys()].map(id => [id, 6])) : new Map();
      const layout = buildDesktopLayout(index, initialDesktopExpansion(index), limits);
      if (count <= 50) expect(layout.positions.size).toBe(count);
      else expect(layout.positions.size).toBeLessThan(60);
    }
  });
  it('keeps department employees and their reporting context; counts scoped hidden descendants', () => {
    const employees = fixture(200); const allowed = getAllowedIds(employees, 'Department 5');
    const scoped = indexHierarchy(employees.filter(employee => allowed.has(employee.id)));
    const full = buildDesktopLayout(scoped, new Set(scoped.byId.keys()));
    expect(full.positions.size).toBe(allowed.size);
    const hidden = hiddenDescendantCounts(scoped, full.positions);
    expect([...hidden.values()].every(count => count === 0)).toBe(true);
    const catalog = mergeDepartmentsWithCounts([], employees);
    expect(catalog.reduce((sum, department) => sum + department.employeeCount, 0)).toBe(200);
  });
  it('handles multiple roots, missing managers, and cyclic bad data without duplicates or hanging', () => {
    const employees = [{ id: 'a', reportsTo: 'b' }, { id: 'b', reportsTo: 'a' }, { id: 'c', reportsTo: 'missing' }, { id: 'd', reportsTo: null }];
    const index = indexHierarchy(employees); const layout = buildDesktopLayout(index, new Set(index.byId.keys()));
    expect(layout.positions.size).toBe(4); assertNoOverlap(layout.positions);
  });
  it('retains the existing mobile layout utility and keeps raster exports within safe bounds', () => {
    const employees = fixture(20); const allowed = new Set(employees.map(employee => employee.id));
    expect(buildChartLayout(employees, allowed, allowed).positions.size).toBe(20);
    const full = buildDesktopLayout(indexHierarchy(fixture(500, true)), new Set(fixture(500, true).map(employee => employee.id)));
    const scale = safeExportScale(full.dimensions);
    expect((full.dimensions.width + 96) * scale).toBeLessThanOrEqual(8192);
    expect((full.dimensions.height + 132) * scale).toBeLessThanOrEqual(8192);
    expect((full.dimensions.width + 96) * (full.dimensions.height + 132) * scale * scale).toBeLessThanOrEqual(32_000_001);
  });
});
