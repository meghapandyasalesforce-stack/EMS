import React, { StrictMode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import RoleBasedDashboard from './RoleBasedDashboard';
import axios from '../utils/axios';
import { beginDashboardSession, endDashboardSession, hasInitialDashboardRedirect, markInitialDashboardRedirect } from '../utils/initialDashboardSession';

vi.mock('../utils/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('./FirstLoginPermissionRequest', () => ({ default: () => null }));
const employee = { _id: 'one', organizationId: 'org', role: 'employee' };
const homes = ['/dashboard-admin', '/dashboard-hr', '/dashboard-manager', '/dashboard-employee', '/dashboard-finance', '/dashboard-administration', '/organization/dashboard'];
function Page({ name }) {
  const location = useLocation();
  return <><h1>{name}</h1><output>{location.pathname + location.search + location.hash}</output><Link to="/attendance">Attendance</Link><Link to="/leave">Leave Management</Link></>;
}
function mount(path, user = employee, overrides = {}) {
  const store = configureStore({ reducer: () => ({
    auth: { user, authChecked: true, permissions: [], permissionFlags: {}, saasFeatures: {}, ...overrides },
    employeeDetails: { employee: null },
  }) });
  return render(<StrictMode><Provider store={store}><MemoryRouter initialEntries={[path]}><Routes>
    <Route path="/dashboard" element={<ProtectedRoute><RoleBasedDashboard /></ProtectedRoute>} />
    {homes.map(home => <Route key={home} path={home} element={<ProtectedRoute><Page name="Dashboard" /></ProtectedRoute>} />)}
    <Route path="/attendance" element={<ProtectedRoute><Page name="Attendance page" /></ProtectedRoute>} />
    <Route path="/leave" element={<ProtectedRoute><Page name="Leave page" /></ProtectedRoute>} />
    <Route path="/restricted" element={<ProtectedRoute requiredPermissions={['admin.manage']} redirectTo="/denied"><Page name="Secret page" /></ProtectedRoute>} />
    <Route path="/login" element={<h1>Login</h1>} />
    <Route path="/denied" element={<h1>Denied</h1>} />
    <Route path="/job-details" element={<ProtectedRoute><h1>Required onboarding</h1></ProtectedRoute>} />
  </Routes></MemoryRouter></Provider></StrictMode>);
}
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear(); endDashboardSession(); vi.clearAllMocks();
  axios.get.mockResolvedValue({ data: { success: true, dashboardRoute: '/dashboard-employee' } });
});

describe('first dashboard navigation', () => {
  const owner = { ...employee, role: 'admin', assignedRole: { dashboardRoute: '/dashboard-manager' }, functionalRoles: ['manager'] };
  const ownerPortal = (activePortal) => ({
    activePortal, permissionFlags: { isOrgOwner: true, jwtRole: 'admin' }, roleBuckets: ['org_owner', 'line_manager'],
    // Reproduce stale persisted home URLs for every profile.
    availablePortals: ['admin', 'hr_manager', 'employee'].map(id => ({ id, home: '/dashboard-manager' })),
  });

  it.each([
    ['admin', '/organization/dashboard'], ['hr_manager', '/dashboard-hr'], ['employee', '/dashboard-employee'],
  ])('opens the selected %s profile instead of the account manager role', async (portal, home) => {
    axios.get.mockResolvedValue({ data: { success: true, dashboardRoute: '/dashboard-manager' } });
    mount('/attendance', owner, ownerPortal(portal));
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText(home)).toBeInTheDocument();
    expect(axios.get).not.toHaveBeenCalled();
    expect(hasInitialDashboardRedirect(owner, portal)).toBe(true);
  });

  it('opens each profile dashboard once and preserves subsequent page navigation', async () => {
    let app = mount('/attendance', owner, ownerPortal('admin'));
    await screen.findByText('/organization/dashboard'); app.unmount();
    app = mount('/attendance', owner, ownerPortal('hr_manager'));
    await screen.findByText('/dashboard-hr'); app.unmount();
    app = mount('/leave', owner, ownerPortal('admin'));
    await screen.findByRole('heading', { name: 'Leave page' }); app.unmount();
    mount('/attendance?month=11#history', owner, ownerPortal('hr_manager'));
    await screen.findByRole('heading', { name: 'Attendance page' });
    expect(screen.getByText('/attendance?month=11#history')).toBeInTheDocument();
  });

  it('corrects an already-open manager dashboard while Admin is selected', async () => {
    markInitialDashboardRedirect(owner, 'admin');
    mount('/dashboard-manager', owner, ownerPortal('admin'));
    await screen.findByText('/organization/dashboard');
  });

  it.each([
    [{ isHrManager: true }, 'hr_manager', '/dashboard-hr'],
    [{ isHrExecutive: true }, 'hr_manager', '/dashboard-hr'],
    [{ isLineManager: true }, 'line_manager', '/dashboard-manager'],
    [{ isProjectManager: true }, 'project_manager', '/dashboard-manager'],
    [{ isPayrollAdmin: true }, 'payroll_admin', '/dashboard-finance'],
    [{ isExecutive: true }, 'executive', '/dashboard-administration'],
    [{}, 'employee', '/dashboard-employee'],
  ])('uses verified staff entitlements for %s despite stale saved portals', async (permissionFlags, portal, home) => {
    mount('/attendance', employee, {
      permissionFlags, activePortal: 'admin',
      availablePortals: [{ id: portal, home: '/dashboard-manager' }],
    });
    await screen.findByText(home);
    expect(hasInitialDashboardRedirect(employee, portal)).toBe(true);
  });

  it('uses the selected workspace when explicitly opening the generic dashboard route', async () => {
    markInitialDashboardRedirect(owner, 'admin');
    mount('/dashboard', owner, ownerPortal('admin'));
    await screen.findByText('/organization/dashboard');
    expect(axios.get).not.toHaveBeenCalled();
  });

  it.each(homes)('uses the existing server dashboard resolver for %s', async home => {
    axios.get.mockResolvedValue({ data: { success: true, dashboardRoute: home } });
    mount('/attendance', { ...employee, assignedRole: { dashboardRoute: home } });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText(home)).toBeInTheDocument();
  });

  it('redirects only once and preserves Attendance, Leave, query and hash on refresh', async () => {
    const first = mount('/attendance');
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(hasInitialDashboardRedirect(employee)).toBe(true);
    fireEvent.click(screen.getByRole('link', { name: 'Attendance' }));
    await screen.findByRole('heading', { name: 'Attendance page' });
    fireEvent.click(screen.getByRole('link', { name: 'Leave Management' }));
    await screen.findByRole('heading', { name: 'Leave page' });
    first.unmount();
    const refreshed = mount('/attendance?month=11#history');
    await screen.findByRole('heading', { name: 'Attendance page' });
    expect(screen.getByText('/attendance?month=11#history')).toBeInTheDocument();
    refreshed.unmount();
    mount('/leave');
    await screen.findByRole('heading', { name: 'Leave page' });
  });

  it.each([
    [{ role: 'admin' }, '/dashboard-admin'],
    [{ functionalRoles: ['hr'] }, '/dashboard-hr'],
    [{ functionalRoles: ['manager'] }, '/dashboard-manager'],
    [{ functionalRoles: ['finance'] }, '/dashboard-finance'],
    [{ functionalRoles: ['executive'] }, '/dashboard-administration'],
    [{}, '/dashboard-employee'],
  ])('preserves role-based fallback when the route API is unavailable (%s)', async (profile, home) => {
    axios.get.mockRejectedValue({ response: { status: 401 } });
    mount('/leave', { ...employee, ...profile });
    await screen.findByRole('heading', { name: 'Dashboard' });
    expect(screen.getByText(home)).toBeInTheDocument();
  });

  it('redirects again for a different user and for a new login by the same user', async () => {
    let app = mount('/attendance');
    await screen.findByRole('heading', { name: 'Dashboard' }); app.unmount();
    app = mount('/leave', { ...employee, _id: 'two' });
    await screen.findByRole('heading', { name: 'Dashboard' }); app.unmount();
    beginDashboardSession();
    mount('/leave');
    await screen.findByRole('heading', { name: 'Dashboard' });
  });

  it('preserves authentication and permission checks', async () => {
    const guest = mount('/attendance', null);
    await screen.findByRole('heading', { name: 'Login' }); guest.unmount();
    mount('/restricted', employee, { permissions: ['attendance.read'] });
    await screen.findByRole('heading', { name: 'Denied' });
    expect(hasInitialDashboardRedirect(employee)).toBe(false);
  });

  it('waits for authentication and preserves required first-login onboarding', async () => {
    const loading = mount('/attendance', employee, { authChecked: false });
    expect(screen.queryByRole('heading', { name: 'Dashboard' })).not.toBeInTheDocument();
    expect(hasInitialDashboardRedirect(employee)).toBe(false); loading.unmount();
    sessionStorage.setItem('redirectToOfferLetterOnLogin', '1');
    mount('/job-details');
    await screen.findByRole('heading', { name: 'Required onboarding' });
    expect(hasInitialDashboardRedirect(employee)).toBe(false);
  });
});
