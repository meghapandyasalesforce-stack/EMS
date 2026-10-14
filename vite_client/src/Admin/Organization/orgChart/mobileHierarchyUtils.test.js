import { describe, expect, it } from 'vitest';
import { indexHierarchy } from './desktopChartUtils';
import { flattenMobileHierarchy } from './mobileHierarchyUtils';

describe('mobile reporting hierarchy', () => {
  for (const count of [20, 50, 200, 500]) {
    it(`includes all ${count} employees once in parent-first order`, () => {
      const employees = Array.from({ length: count }, (_, i) => ({ id: String(i), reportsTo: i ? String(Math.floor((i - 1) / 4)) : null }));
      const original = JSON.stringify(employees);
      const index = indexHierarchy(employees);
      const rows = flattenMobileHierarchy(index, new Set(index.byId.keys()));
      expect(rows).toHaveLength(count);
      expect(new Set(rows.map(row => row.id)).size).toBe(count);
      const offsets = new Map(rows.map((row, offset) => [row.id, offset]));
      for (const row of rows) {
        expect(row.parentId).toBe(row.employee.reportsTo);
        if (row.parentId) expect(offsets.get(row.parentId)).toBeLessThan(offsets.get(row.id));
      }
      expect(JSON.stringify(employees)).toBe(original);
      expect(flattenMobileHierarchy(index, new Set()).map(row => row.id)).toEqual(['0']);
    });
  }
  it('keeps batched reports accessible and reveals a searched report by ID', () => {
    const employees = Array.from({ length: 500 }, (_, i) => ({ id: String(i), reportsTo: i ? '0' : null, name: 'Duplicate name' }));
    const index = indexHierarchy(employees);
    const rows = flattenMobileHierarchy(index, new Set(['0']), new Map([['0', 6]]), new Set(['499']));
    expect(rows.filter(row => !row.more).map(row => row.id)).toEqual(['0', '1', '2', '3', '4', '5', '6', '499']);
    expect(rows.at(-1)).toMatchObject({ more: true, parentId: '0' });
    expect(flattenMobileHierarchy(index, new Set(['0']))).toHaveLength(500);
  });
  it('retains parent context across departments and handles disconnected roots', () => {
    const index = indexHierarchy([{ id: 'ceo', reportsTo: null }, { id: 'manager', reportsTo: 'ceo' }, { id: 'member', reportsTo: 'manager' }, { id: 'unlinked', reportsTo: 'missing' }]);
    const rows = flattenMobileHierarchy(index, new Set(['ceo', 'manager']));
    expect(rows.map(row => row.id)).toEqual(['ceo', 'manager', 'member', 'unlinked']);
    expect(rows[2]).toMatchObject({ depth: 2, parentId: 'manager' });
  });
});
