import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  beginDashboardSession, endDashboardSession, hasInitialDashboardRedirect,
  markInitialDashboardRedirect,
} from './initialDashboardSession';

const user = { _id: 'employee-1', organizationId: 'org-1' };
beforeEach(() => { vi.restoreAllMocks(); sessionStorage.clear(); endDashboardSession(); });

describe('initial dashboard session', () => {
  it('keeps separate flags for each user and organization', () => {
    markInitialDashboardRedirect(user);
    expect(hasInitialDashboardRedirect(user)).toBe(true);
    expect(hasInitialDashboardRedirect({ ...user, _id: 'employee-2' })).toBe(false);
    expect(hasInitialDashboardRedirect({ ...user, organizationId: 'org-2' })).toBe(false);
    expect(hasInitialDashboardRedirect(null)).toBe(false);
  });

  it('survives module reloads/refreshes but resets on a new login or logout', async () => {
    beginDashboardSession();
    markInitialDashboardRedirect(user);
    vi.resetModules();
    const refreshed = await import('./initialDashboardSession');
    expect(refreshed.hasInitialDashboardRedirect(user)).toBe(true);
    refreshed.beginDashboardSession();
    expect(refreshed.hasInitialDashboardRedirect(user)).toBe(false);
    refreshed.markInitialDashboardRedirect(user);
    refreshed.endDashboardSession();
    expect(refreshed.hasInitialDashboardRedirect(user)).toBe(false);
  });

  it('handles missing/corrupt storage and prevents loops when storage is restricted', () => {
    sessionStorage.setItem('ems.initialDashboardSession', '{broken');
    expect(hasInitialDashboardRedirect(user)).toBe(false);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
    beginDashboardSession();
    markInitialDashboardRedirect(user);
    expect(hasInitialDashboardRedirect(user)).toBe(true);
    endDashboardSession();
    expect(hasInitialDashboardRedirect(user)).toBe(false);
  });
});
