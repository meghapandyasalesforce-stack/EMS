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

  it('maps project_manager functional role to project manager workspace', () => {
    const profile = { functionalRoles: ['project_manager'] };
    expect(resolveMePortalSystemRole(profile)).toBe(SYSTEM_ROLE_IDS.PROJECT_MANAGER);
    expect(getMePortalHomePath(profile)).toBe('/dashboard-manager');
  });

  it('shows project manager nav for project_manager portal', () => {
    const items = getNavigationItems(
      { role: 'employee', _id: '1', employeeProfileId: 'e1' },
      { _id: 'e1', functionalRoles: ['project_manager'], jobTitle: 'Project Manager' },
      ['project.admin.view', 'employee.view.all'],
      { isProjectManager: true },
      'project_manager'
    );

    expect(items.some((item) => item.path === '/dashboard-manager')).toBe(true);
    expect(items.some((item) => item.path === '/projects')).toBe(true);
    expect(items.some((item) => item.path === '/leave-management')).toBe(false);
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

  it('shows employee workspace nav on Me tab even when manager role is assigned', () => {
    const items = getNavigationItems(
      { role: 'admin', _id: '1', employeeProfileId: 'e1' },
      { _id: 'e1', functionalRoles: ['manager'] },
      [],
      { isOrgOwner: true, isHrManager: true },
      'employee'
    );

    expect(items.some((item) => item.path === '/dashboard-employee')).toBe(true);
    expect(items.some((item) => item.path === '/dashboard-manager')).toBe(false);
  });

  it.each(['employee', 'payroll_admin', 'project_manager'])(
    'shows personal regularization in the %s portal sidebar',
    (portalId) => {
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
    }
  );

  it('shows team regularization (not personal) in the line_manager portal sidebar', () => {
    const items = getNavigationItems(
      { role: 'employee', _id: '1', employeeProfileId: 'e1' },
      { _id: 'e1' },
      [],
      {},
      'line_manager'
    );

    expect(
      items.some((item) => item.path === '/manager/attendance-regularization')
    ).toBe(true);
    expect(
      items.some((item) => item.path === '/my-attendance-regularization')
    ).toBe(false);
  });
});
