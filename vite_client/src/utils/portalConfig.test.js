import { describe, it, expect } from 'vitest';
import {
  canSwitchPortals,
  deriveAvailablePortals,
  deriveEntitledPortalIds,
  getEffectiveActivePortal,
  resolvePrimaryPortalId,
  isPortalSwitchAllowed,
  isHrPortalUser,
} from './portalConfig';

describe('portalConfig — SaaS portal switching policy', () => {
  const orgAdmin = { role: 'admin', _id: '1', position: 'vp' };
  const orgAdminFlags = { isOrgOwner: true, isHrManager: true };
  const orgAdminBuckets = ['org_owner', 'hr_manager', 'employee'];
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

  it('allows portal switching only for org owners on an admin session', () => {
    const orgOwnerAdminFlags = { isOrgOwner: true, jwtRole: 'admin' };
    expect(canSwitchPortals(orgAdmin, orgOwnerAdminFlags, orgAdminBuckets)).toBe(true);
    expect(canSwitchPortals(orgAdmin, { isOrgOwner: true, jwtRole: 'admin' }, ['org_owner'])).toBe(true);
    expect(canSwitchPortals({ role: 'employee' }, { isOrgOwner: true, jwtRole: 'employee' }, ['org_owner'])).toBe(false);
    expect(canSwitchPortals(hrEmployee.user, { ...hrEmployee.permissionFlags, jwtRole: 'employee' }, hrEmployee.roleBuckets)).toBe(false);
    expect(isHrPortalUser(hrEmployee.permissionFlags)).toBe(true);
    expect(canSwitchPortals(orgAdmin, { isHrManager: true, jwtRole: 'employee' }, [])).toBe(false);
    expect(canSwitchPortals({ role: 'admin' }, {}, [])).toBe(false);
    expect(canSwitchPortals(lineManager.user, lineManager.permissionFlags, lineManager.roleBuckets)).toBe(false);
    expect(canSwitchPortals(pureEmployee.user, pureEmployee.permissionFlags, pureEmployee.roleBuckets)).toBe(false);
  });

  it('returns Admin + HR + Me tabs for org owners on admin session', () => {
    const portals = deriveAvailablePortals({
      user: orgAdmin,
      roleBuckets: ['org_owner', 'hr_manager'],
      permissionFlags: { isOrgOwner: true, isHrManager: true, jwtRole: 'admin' },
    });
    expect(portals.map((p) => p.id)).toEqual(['admin', 'hr_manager', 'employee']);
    expect(portals.length).toBe(3);
    const meTab = portals.find((p) => p.id === 'employee');
    expect(meTab?.home).toBe('/dashboard-employee');
  });

  it.each(['manager', 'project_manager', 'finance', 'executive', 'hr'])('keeps Me on employee dashboard for an admin assigned %s', (role) => {
    const portals = deriveAvailablePortals({
      user: orgAdmin,
      employee: { _id: 'e0', functionalRoles: [role] },
      roleBuckets: orgAdminBuckets,
      permissionFlags: { isOrgOwner: true, isHrManager: true, jwtRole: 'admin' },
    });
    const meTab = portals.find((p) => p.id === 'employee');
    expect(meTab?.home).toBe('/dashboard-employee');
  });

  it('does not allow portal switching for HR staff (employee session)', () => {
    const hrFlags = {
      ...hrEmployee.permissionFlags,
      jwtRole: 'employee',
    };
    expect(canSwitchPortals(hrEmployee.user, hrFlags, hrEmployee.roleBuckets)).toBe(false);
    const portals = deriveAvailablePortals({
      ...hrEmployee,
      permissionFlags: hrFlags,
      user: { ...hrEmployee.user, role: 'employee' },
    });
    expect(portals.map((p) => p.id)).toEqual(['hr_manager']);
    expect(portals.length).toBe(1);
  });

  it('returns a single locked portal for line managers', () => {
    const portals = deriveAvailablePortals({
      ...lineManager,
      permissionFlags: { ...lineManager.permissionFlags, jwtRole: 'employee' },
      user: { ...lineManager.user, role: 'employee' },
    });
    expect(portals).toHaveLength(1);
    expect(portals[0].id).toBe('line_manager');
  });

  it('returns a single employee portal for pure employees', () => {
    const portals = deriveAvailablePortals({
      ...pureEmployee,
      permissionFlags: { jwtRole: 'employee' },
      user: { ...pureEmployee.user, role: 'employee' },
    });
    expect(portals.map((p) => p.id)).toEqual(['employee']);
    expect(portals.length).toBe(1);
  });

  it('resolvePrimaryPortalId skips admin for delegated roles', () => {
    const ids = deriveEntitledPortalIds(hrEmployee);
    expect(resolvePrimaryPortalId(ids)).toBe('hr_manager');
  });

  it('ignores tampered activePortal for non-tab users', () => {
    const portals = deriveAvailablePortals({
      ...lineManager,
      permissionFlags: { ...lineManager.permissionFlags, jwtRole: 'employee' },
      user: { ...lineManager.user, role: 'employee' },
    });
    const effective = getEffectiveActivePortal({
      user: { ...lineManager.user, role: 'employee' },
      permissionFlags: { ...lineManager.permissionFlags, jwtRole: 'employee' },
      roleBuckets: lineManager.roleBuckets,
      availablePortals: portals,
      activePortal: 'admin',
      routeHint: '/dashboard-manager',
    });
    expect(effective).toBe('line_manager');
  });

  it('honours activePortal for org admins when valid', () => {
    const portals = deriveAvailablePortals({
      user: orgAdmin,
      roleBuckets: orgAdminBuckets,
      permissionFlags: { isOrgOwner: true, isHrManager: true, jwtRole: 'admin' },
      employee: { _id: 'e0' },
    });
    const effective = getEffectiveActivePortal({
      user: orgAdmin,
      permissionFlags: { isOrgOwner: true, jwtRole: 'admin' },
      roleBuckets: orgAdminBuckets,
      availablePortals: portals,
      activePortal: 'employee',
    });
    expect(effective).toBe('employee');
  });

  it('does not allow portal switching for HR staff', () => {
    const portals = deriveAvailablePortals(hrEmployee);
    expect(
      isPortalSwitchAllowed('admin', {
        user: hrEmployee.user,
        permissionFlags: hrEmployee.permissionFlags,
        roleBuckets: hrEmployee.roleBuckets,
        availablePortals: portals,
      })
    ).toBe(false);
    expect(
      isPortalSwitchAllowed('employee', {
        user: hrEmployee.user,
        permissionFlags: hrEmployee.permissionFlags,
        roleBuckets: hrEmployee.roleBuckets,
        availablePortals: portals,
      })
    ).toBe(false);
  });
});
