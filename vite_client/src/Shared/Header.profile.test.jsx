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
vi.mock('../utils/navigationConfig', async (importOriginal) => ({ ...(await importOriginal()), getNavigationItems: () => [{ path: '/dashboard-employee', name: 'Dashboard', icon: null }] }));

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function renderHeader(role, width = 1366, path = '/dashboard-employee') {
  window.innerWidth = width;
  const state = {
    auth: { user: { _id: 'self', employeeId: 'EMP001', name: 'Megha', role }, permissions: [], permissionFlags: {}, roleBuckets: ['employee'], activePortal: 'employee', availablePortals: [{ id: 'employee' }], sessionValidated: true, saasFeatures: {} },
    employeeDetails: { employee: null },
  };
  const store = configureStore({ reducer: () => state });
  return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Header /><Location /></MemoryRouter></Provider>);
}

describe('desktop Profile navigation', () => {
  it.each(['admin', 'hr', 'manager', 'employee'])('opens the own-profile route for %s', role => {
    renderHeader(role);
    const nav = document.querySelector('[data-hrms-sidebar-nav]');
    fireEvent.click(within(nav).getByRole('button', { name: 'Profile', exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile-details');
    expect(within(nav).getByRole('button', { name: 'Profile', exact: true })).toHaveClass('text-white', 'shadow-md');
  });
  it.each(['/profile-details', '/contact-details', '/education-qualifications', '/professional-experience', '/family-details', '/job-details', '/financial-details', '/profile-security'])('highlights Profile on %s', path => {
    renderHeader('employee', 1366, path);
    expect(screen.getByRole('button', { name: 'Profile', exact: true })).toHaveClass('text-white', 'shadow-md');
  });
  it.each([375, 768, 1023])('keeps the additional Profile navigation out of the mobile menu at %spx', width => {
    renderHeader('employee', width);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    expect(screen.queryByRole('button', { name: 'Profile', exact: true })).not.toBeInTheDocument();
  });
  it('keeps the mobile dropdown own-profile navigation working', () => {
    renderHeader('employee', 375);
    fireEvent.click(screen.getByRole('button', { name: 'Profile menu' }));
    fireEvent.click(screen.getByRole('menuitem', { name: 'Megha' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile-details');
  });
});
