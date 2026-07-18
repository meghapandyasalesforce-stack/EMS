import { describe, it, expect } from 'vitest';
import {
  resolveMePortalSystemRole,
  getMePortalHomePath,
  getNavigationItems,
} from './navigationConfig';
import { SYSTEM_ROLE_IDS } from './systemRoles';

describe('navigationConfig — Me portal', () => {
  it('defaults to employee role when no functional roles are set', () => {
    expect(resolveMePortalSystemRole({})).toBe(SYSTEM_ROLE_IDS.EMPLOYEE);
    expect(getMePortalHomePath({})).toBe('/dashboard-employee');
  });

  it('maps manager functional role to line manager workspace', () => {
    const profile = { functionalRoles: ['manager'] };
    expect(resolveMePortalSystemRole(profile)).toBe(SYSTEM_ROLE_IDS.LINE_MANAGER);
    expect(getMePortalHomePath(profile)).toBe('/dashboard-manager');
  });

  it('maps finance functional role to payroll admin workspace', () => {
    const profile = { functionalRoles: ['finance'] };
    expect(resolveMePortalSystemRole(profile)).toBe(SYSTEM_ROLE_IDS.PAYROLL_ADMIN);
    expect(getMePortalHomePath(profile)).toBe('/dashboard-finance');
  });

  it('shows employee workspace nav on Me tab for org owners without elevated functional roles', () => {
    const items = getNavigationItems(
      { role: 'admin', _id: '1' },
      { _id: 'e1', functionalRoles: [], position: 'Software Engineer' },
      [],
      { isOrgOwner: true, isHrManager: true },
      'employee'
    );

    expect(items.some((item) => item.path === '/dashboard-employee')).toBe(true);
    expect(items.some((item) => item.path === '/profile-details')).toBe(true);
    expect(items.some((item) => item.path === '/contact-details')).toBe(false);
  });

  it('shows manager workspace nav on Me tab when manager role is assigned', () => {
    const items = getNavigationItems(
      { role: 'admin', _id: '1', employeeProfileId: 'e1' },
      { _id: 'e1', functionalRoles: ['manager'] },
      [],
      { isOrgOwner: true, isHrManager: true },
      'employee'
    );

    expect(items.some((item) => item.path === '/dashboard-manager')).toBe(true);
    expect(items.some((item) => item.path === '/dashboard-employee')).toBe(false);
  });

  it.each([
    'employee',
    'executive',
    'hr_manager',
    'payroll_admin',
    'line_manager',
  ])('shows personal attendance regularization in the %s portal', (portalId) => {
    const items = getNavigationItems(
      { role: 'employee', _id: '1', employeeProfileId: 'e1' },
      { _id: 'e1' },
      [],
      {},
      portalId
    );

    expect(
      items.some((item) => item.path === '/my-attendance-regularization')
    ).toBe(true);
  });
});
