import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { MemoryRouter, useLocation } from 'react-router-dom';
import ProfileDropdown from './ProfileDropdown';

function Location() {
  return <output data-testid="location">{useLocation().pathname}</output>;
}
function renderMenu(role, props = {}) {
  const store = configureStore({ reducer: () => ({
    auth: { user: { name: 'Megha', role }, roleBuckets: [] },
    employeeDetails: { employee: { name: 'Other employee' } },
  }) });
  return render(<Provider store={store}><MemoryRouter initialEntries={['/dashboard']}>
    <ProfileDropdown {...props} /><Location />
  </MemoryRouter></Provider>);
}

describe('profile dropdown navigation', () => {
  it.each(['admin', 'hr', 'manager', 'employee'])('opens the own-profile route for %s and closes the dropdown', role => {
    const onClose = vi.fn();
    renderMenu(role, { onClose });
    fireEvent.click(screen.getByRole('menuitem', { name: 'Megha' }));
    expect(screen.getByTestId('location')).toHaveTextContent('/profile-details');
    expect(onClose).toHaveBeenCalledOnce();
  });
  it.each(['Megha', 'View Profile →'])('uses the existing profile callback when clicking %s', name => {
    const onViewProfile = vi.fn();
    const onClose = vi.fn();
    renderMenu('employee', { onViewProfile, onClose });
    fireEvent.click(screen.getByRole(name === 'Megha' ? 'menuitem' : 'button', { name }));
    expect(onViewProfile).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
  it('preserves logout', () => {
    const onLogout = vi.fn();
    const onClose = vi.fn();
    renderMenu('employee', { onLogout, onClose });
    fireEvent.click(screen.getByRole('button', { name: 'Logout' }));
    expect(onLogout).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
