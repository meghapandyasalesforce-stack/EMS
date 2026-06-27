import { describe, it, expect } from 'vitest';
import {
  canSwitchPortals,
  deriveAvailablePortals,
  deriveEntitledPortalIds,
  getEffectiveActivePortal,
  resolvePrimaryPortalId,
  isPortalSwitchAllowed,
} from './portalConfig';

describe('portalConfig — SaaS portal switching policy', () => {
  const orgAdmin = { role: 'admin', _id: '1', position: 'vp' };
  const hrEmployee = {
    user: { role: 'employee', _id: '2' },
    employee: { _id: 'e1', position: 'analyst' },
    roleBuckets: ['hr_manager', 'employee'],
    permissionFlags: { isHrManager: true },
  };
  const lineManager = {
    user: { role: 'employee', _id: '3' },
    employee: { _id: 'e2' },
    roleBuckets: ['line_manager', 'employee'],
    permissionFlags: { isLineManager: true },
  };
  const pureEmployee = {
    user: { role: 'employee', _id: '4' },
    employee: { _id: 'e3' },
    roleBuckets: ['employee'],
    permissionFlags: {},
  };

  it('allows portal switching only for organization administrators', () => {
    expect(canSwitchPortals(orgAdmin, {})).toBe(true);
    expect(canSwitchPortals({ role: 'employee' }, { isOrgOwner: true })).toBe(true);
    expect(canSwitchPortals(hrEmployee.user, hrEmployee.permissionFlags)).toBe(false);
    expect(canSwitchPortals(lineManager.user, lineManager.permissionFlags)).toBe(false);
    expect(canSwitchPortals(pureEmployee.user, pureEmployee.permissionFlags)).toBe(false);
  });

  it('returns multiple portals for org admins', () => {
    const portals = deriveAvailablePortals({
      user: orgAdmin,
      employee: { _id: 'e0' },
      roleBuckets: ['org_owner', 'executive', 'employee'],
      permissionFlags: { isOrgOwner: true, isExecutive: true },
    });
    expect(portals.length).toBeGreaterThan(1);
    expect(portals.map((p) => p.id)).toContain('admin');
    expect(portals.map((p) => p.id)).toContain('employee');
  });

  it('returns a single locked portal for HR (no tab switcher)', () => {
    const portals = deriveAvailablePortals(hrEmployee);
    expect(portals).toHaveLength(1);
    expect(portals[0].id).toBe('hr_manager');
  });

  it('returns a single locked portal for line managers', () => {
    const portals = deriveAvailablePortals(lineManager);
    expect(portals).toHaveLength(1);
    expect(portals[0].id).toBe('line_manager');
  });

  it('returns employee portal for pure employees', () => {
    const portals = deriveAvailablePortals(pureEmployee);
    expect(portals).toHaveLength(1);
    expect(portals[0].id).toBe('employee');
  });

  it('resolvePrimaryPortalId skips admin for delegated roles', () => {
    const ids = deriveEntitledPortalIds(hrEmployee);
    expect(resolvePrimaryPortalId(ids)).toBe('hr_manager');
  });

  it('ignores tampered activePortal for non-admins', () => {
    const portals = deriveAvailablePortals(hrEmployee);
    const effective = getEffectiveActivePortal({
      user: hrEmployee.user,
      permissionFlags: hrEmployee.permissionFlags,
      availablePortals: portals,
      activePortal: 'admin',
      routeHint: '/dashboard-hr',
    });
    expect(effective).toBe('hr_manager');
  });

  it('honours activePortal for org admins when valid', () => {
    const portals = deriveAvailablePortals({
      user: orgAdmin,
      roleBuckets: ['org_owner', 'employee'],
      permissionFlags: { isOrgOwner: true },
      employee: { _id: 'e0' },
    });
    const effective = getEffectiveActivePortal({
      user: orgAdmin,
      permissionFlags: { isOrgOwner: true },
      availablePortals: portals,
      activePortal: 'employee',
    });
    expect(effective).toBe('employee');
  });

  it('blocks portal switch for non-admins', () => {
    expect(
      isPortalSwitchAllowed('admin', {
        user: hrEmployee.user,
        permissionFlags: hrEmployee.permissionFlags,
        availablePortals: [{ id: 'hr_manager' }],
      })
    ).toBe(false);
    expect(
      isPortalSwitchAllowed('employee', {
        user: orgAdmin,
        permissionFlags: { isOrgOwner: true },
        availablePortals: [{ id: 'admin' }, { id: 'employee' }],
      })
    ).toBe(true);
  });
});
