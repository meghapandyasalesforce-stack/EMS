import { describe, it, expect } from 'vitest';
import { canAccess, PERMISSIONS } from './permissions';
import { getNavigationItems } from './navigationConfig';

const chartAccess = {
  allowedRoles: ['admin', 'hr', 'executive'],
  requireRoleMatch: true,
};

describe('Organization chart access', () => {
  it('hides Organization in the manager workspace even with employee access', () => {
    const items = getNavigationItems(
      { role: 'employee', _id: '1', employeeProfileId: 'e1' },
      { _id: 'e1', functionalRoles: ['manager'] },
      [PERMISSIONS.EMPLOYEE_VIEW_TEAM, PERMISSIONS.EMPLOYEE_VIEW_ALL],
      { isLineManager: true },
      'line_manager',
    );
    expect(items.some((item) => item.path === '/dashboard-manager')).toBe(true);
    expect(items.some((item) => item.path === '/organization/chart')).toBe(false);
  });

  it('rejects direct manager access despite employee permissions', () => {
    expect(canAccess([PERMISSIONS.EMPLOYEE_VIEW_ALL], [PERMISSIONS.EMPLOYEE_VIEW_ALL], {
      ...chartAccess, effectiveRoles: ['manager', 'employee'],
    })).toBe(false);
  });

  it.each(['admin', 'hr', 'executive'])('preserves %s access with employee permissions', (role) => {
    expect(canAccess([PERMISSIONS.EMPLOYEE_VIEW_ALL], [PERMISSIONS.EMPLOYEE_VIEW_ALL], {
      ...chartAccess, effectiveRoles: [role, 'employee'],
    })).toBe(true);
  });

  it('still checks permissions after the role check', () => {
    expect(canAccess([PERMISSIONS.LEAVE_VIEW_TEAM], [PERMISSIONS.EMPLOYEE_VIEW_ALL], {
      ...chartAccess, effectiveRoles: ['hr', 'employee'],
    })).toBe(false);
  });
});
