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
  it('keeps the More sheet available on Me phone', () => {
    renderHeader('employee', 375);
    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(screen.getByRole('button', { name: 'More' }));
    expect(screen.getByRole('button', { name: 'Profile', exact: true })).toBeInTheDocument();
  });
  it('opens the employee phone drawer and closes it after navigation', () => {
    renderHeader('employee', 375);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(drawer).toBeInTheDocument();
    expect(document.body.style.overflow).toBe('hidden');
    fireEvent.click(within(drawer).getByRole('button', { name: 'Profile', exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile-details');
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();
    expect(document.body.style.overflow).not.toBe('hidden');
  });
  it('dismisses the employee phone drawer with Escape and restores focus', () => {
    renderHeader('employee', 375);
    const toggle = screen.getByRole('button', { name: 'Open menu' });
    toggle.focus();
    fireEvent.click(toggle);
    const drawer = screen.getByRole('dialog', { name: 'Navigation menu' });
    expect(within(drawer).getByRole('button', { name: 'Close menu', exact: true })).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog', { name: 'Navigation menu' })).not.toBeInTheDocument();
    expect(toggle).toHaveFocus();
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


describe('Employee reference navigation', () => {
  const destinations = [
    ['Dashboard', '/dashboard-employee'],
    ['Leave & attendance', '/employee/leave-attendance'],
    ['Regularization', '/my-attendance-regularization'],
    ['Projects', '/employee/projects'],
    ['Engagement', '/employee/engagement'],
    ['One-on-One', '/one-on-one'],
    ['Benefits & learning', '/employee/benefits-learning'],
    ['Internal jobs', '/employee/internal-jobs'],
    ['My lifecycle', '/onboarding'],
    ['Documents & ID', '/employee/documents-id'],
    ['Calendar', '/employee/calendar'],
    ['Payroll', '/employee-payroll'],
    ['Profile', '/profile-details'],
  ];

  it.each(destinations)('navigates to %s with only one active item', (label, path) => {
    renderHeader('employee');
    const nav = document.querySelector('[data-hrms-sidebar-nav]');
    fireEvent.click(within(nav).getByRole('button', { name: label, exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent(path);
    expect(nav.querySelectorAll('[aria-current="page"]')).toHaveLength(1);
    expect(within(nav).getByRole('button', { name: label, exact: true })).toHaveAttribute('aria-current', 'page');
    expect(within(nav).queryByRole('button', { expanded: false })).not.toBeInTheDocument();
  });

  it.each([375, 768])('exposes every destination at %spx and closes the menu after navigation', width => {
    renderHeader('employee', width);
    fireEvent.click(screen.getByRole('button', { name: width < 768 ? 'More' : 'Open menu', exact: true }));
    const menu = screen.getByRole('dialog', { name: width < 768 ? 'More' : 'Navigation menu' });
    const bottomPaths = ['/dashboard-employee', '/employee/leave-attendance', '/employee-payroll', '/employee/documents-id'];
    for (const [label, path] of destinations) {
      if (width < 768 && bottomPaths.includes(path)) continue;
      expect(within(menu).getByRole('button', { name: label, exact: true })).toBeInTheDocument();
    }
    fireEvent.click(within(menu).getByRole('button', { name: 'Calendar', exact: true }));
    expect(screen.getByTestId('location')).toHaveTextContent('/employee/calendar');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});
