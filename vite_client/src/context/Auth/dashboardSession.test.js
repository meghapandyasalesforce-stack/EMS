import { configureStore } from '@reduxjs/toolkit';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import reducer, { checkAuthSession, logoutUser, setUser } from './authSlice';
import axios from '../../utils/axios';
import { beginDashboardSession, endDashboardSession, hasInitialDashboardRedirect, markInitialDashboardRedirect } from '../../utils/initialDashboardSession';

vi.mock('../../utils/axios', () => ({ default: { post: vi.fn() } }));
const user = { _id: 'employee', organizationId: 'org', role: 'employee' };
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); endDashboardSession(); vi.clearAllMocks();
  beginDashboardSession(); markInitialDashboardRedirect(user);
});

describe('authentication dashboard session lifecycle', () => {
  it('does not reset the flag when restoring authentication or updating the profile', () => {
    const store = configureStore({ reducer: { auth: reducer } });
    store.dispatch(setUser(user));
    store.dispatch(checkAuthSession.fulfilled({ employee: user, permissions: [], permissionFlags: {} }, 'restore'));
    store.dispatch(setUser({ ...user, name: 'Updated name' }));
    expect(store.getState().auth.user.name).toBe('Updated name');
    expect(hasInitialDashboardRedirect(user)).toBe(true);
  });

  it.each([false, true])('clears the flag on logout even when the endpoint fails (%s)', async fails => {
    if (fails) axios.post.mockRejectedValue(new Error('Offline'));
    else axios.post.mockResolvedValue({ data: { success: true } });
    const store = configureStore({ reducer: { auth: reducer } });
    store.dispatch(setUser(user));
    await store.dispatch(logoutUser('employee'));
    expect(store.getState().auth.user).toBeNull();
    expect(hasInitialDashboardRedirect(user)).toBe(false);
  });
});
