import { describe, it, expect } from '@jest/globals';
import { normalizeAccessDataScope } from '../../helpers/employeeListScopeHelper.js';

describe('employeeListScopeHelper', () => {
  it('normalizes accessDataScope values', () => {
    expect(normalizeAccessDataScope('organization')).toBe('organization');
    expect(normalizeAccessDataScope('DEPARTMENTS')).toBe('departments');
    expect(normalizeAccessDataScope('nope')).toBe('default');
    expect(normalizeAccessDataScope(null)).toBe('default');
  });
});
