import { describe, it, expect } from '@jest/globals';
import { resolveDashboardFromAccessProfile } from '../../helpers/dashboardAccessHelper.js';

describe('resolveDashboardFromAccessProfile', () => {
  it('uses assignedRole.dashboardRoute first', () => {
    expect(
      resolveDashboardFromAccessProfile({
        assignedRole: { dashboardRoute: '/custom-home' },
        functionalRoles: ['hr'],
      })
    ).toBe('/custom-home');
  });

  it('maps functionalRoles to homes (not department)', () => {
    expect(resolveDashboardFromAccessProfile({ functionalRoles: ['finance'] })).toBe(
      '/dashboard-finance'
    );
    expect(resolveDashboardFromAccessProfile({ functionalRoles: ['hr'] })).toBe('/dashboard-hr');
    expect(resolveDashboardFromAccessProfile({ functionalRoles: ['manager'] })).toBe(
      '/dashboard-manager'
    );
    expect(resolveDashboardFromAccessProfile({ functionalRoles: ['executive'] })).toBe(
      '/dashboard-administration'
    );
  });

  it('does not use department strings — empty functionalRoles defaults to employee', () => {
    expect(
      resolveDashboardFromAccessProfile({
        functionalRoles: [],
        // callers must not pass department; ensure job strings alone without legacy titles stay employee
        position: 'Associate',
        jobTitle: 'Accountant',
      })
    ).toBe('/dashboard-employee');
  });

  it('uses legacy designation only when functionalRoles empty', () => {
    expect(
      resolveDashboardFromAccessProfile({
        functionalRoles: [],
        position: 'Manager',
        allowLegacyJobStrings: true,
      })
    ).toBe('/dashboard-manager');

    expect(
      resolveDashboardFromAccessProfile({
        functionalRoles: [],
        position: 'Manager',
        allowLegacyJobStrings: false,
      })
    ).toBe('/dashboard-employee');
  });

  it('prefers functionalRoles over legacy designation', () => {
    expect(
      resolveDashboardFromAccessProfile({
        functionalRoles: ['finance'],
        position: 'Manager',
      })
    ).toBe('/dashboard-finance');
  });
});
