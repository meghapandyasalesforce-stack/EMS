import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import Header from './Header';

vi.mock('../context/store', () => ({ persistor: { purge: vi.fn() } }));
vi.mock('../components/NotificationDropdown', () => ({ default: () => null }));
vi.mock('../components/PortalSwitcher', () => ({ default: () => null }));
vi.mock('../Hooks/useDocumentModeSettings', () => ({ default: () => ({ ready: true, enableDocumentRequests: true, enableSelfServiceDocuments: true }) }));
vi.mock('../utils/navigationConfig', async (importOriginal) => ({ ...(await importOriginal()), getNavigationItems: () => [{ path: '/dashboard-employee', name: 'Dashboard', icon: null }, { path: '/employee-payroll', name: 'Payroll', icon: null }, { path: '/projects', name: 'Projects', icon: null }] }));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function renderHeader(role, width = 1366, path = '/dashboard-employee', { activePortal, availablePortals } = {}) {
  window.innerWidth = width;
  const portalByRole = {
    admin: { activePortal: 'admin', availablePortals: [{ id: 'admin' }, { id: 'hr_manager' }, { id: 'employee' }] },
    hr: { activePortal: 'hr_manager', availablePortals: [{ id: 'hr_manager' }] },
    manager: { activePortal: 'line_manager', availablePortals: [{ id: 'line_manager' }] },
    employee: { activePortal: 'employee', availablePortals: [{ id: 'employee' }] },
  };
  const portals = portalByRole[role] || portalByRole.employee;
  const state = {
    auth: {
      user: { _id: 'self', employeeId: 'EMP001', name: 'Megha', role },
      permissions: [],
      permissionFlags: role === 'admin' ? { isOrgOwner: true } : {},
      roleBuckets: role === 'admin' ? ['admin', 'hr', 'employee'] : [role],
      activePortal: activePortal ?? portals.activePortal,
      availablePortals: availablePortals ?? portals.availablePortals,
      sessionValidated: true,
      saasFeatures: {},
    },
    employeeDetails: { employee: null },
  };
  const store = configureStore({ reducer: () => state });
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Header /><Location /></MemoryRouter></Provider>);
}

describe('desktop Profile navigation', () => {
  it('omits Profile from the Admin portal', () => {
    renderHeader('admin', 1366, '/organization/dashboard');
    const nav = document.querySelector('[data-hrms-sidebar-nav]');
    expect(within(nav).queryByRole('button', { name: 'Profile', exact: true })).not.toBeInTheDocument();
  });
  it.each([
    ['hr', 'hr_manager'],
    ['manager', 'line_manager'],
    ['employee', 'employee'],
    ['admin', 'hr_manager'],
    ['admin', 'employee'],
  ])('places Profile last for %s on %s portal', (role, portal) => {
    const availablePortals = role === 'admin'
      ? [{ id: 'admin' }, { id: 'hr_manager' }, { id: 'employee' }]
      : [{ id: portal }];
    renderHeader(role, 1366, '/dashboard-employee', { activePortal: portal, availablePortals });
    const nav = document.querySelector('[data-hrms-sidebar-nav]');
    const labels = within(nav).getAllByRole('button').map(button => button.textContent);
    expect(labels.indexOf('Profile')).toBe(labels.length - 1);
    fireEvent.click(within(nav).getByRole('button', { name: 'Profile', exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile-details');
    expect(within(nav).getByRole('button', { name: 'Profile', exact: true })).toHaveClass('is-active');
  });
  it.each(['/profile-details', '/contact-details', '/education-qualifications', '/professional-experience', '/family-details', '/job-details', '/financial-details', '/profile-security'])('highlights Profile on %s', path => {
    renderHeader('employee', 1366, path);
    expect(screen.getByRole('button', { name: 'Profile', exact: true })).toHaveClass('is-active');
  });
  it('uses More sheet on Me phone instead of hamburger Profile list', () => {
    renderHeader('employee', 375);
    expect(screen.queryByRole('button', { name: 'Open menu' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Profile', exact: true })).toBeInTheDocument();
  });
  it.each([768, 1023])('keeps Open menu on Me tablet rail at %spx', width => {
    renderHeader('employee', width);
    expect(screen.getByRole('button', { name: 'Open menu' })).toBeInTheDocument();
  });
  it('keeps the mobile dropdown own-profile navigation working', () => {
    renderHeader('employee', 375);
    fireEvent.click(screen.getByRole('button', { name: 'Profile menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Megha' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile-details');
  });
});
