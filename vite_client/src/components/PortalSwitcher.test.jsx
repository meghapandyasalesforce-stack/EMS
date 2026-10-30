import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, useLocation } from 'react-router-dom';
import PortalSwitcher from './PortalSwitcher';
vi.mock('../context/Auth/authSlice', () => ({
    switchPortal: id => ({ type: 'test/switch', payload: id }),
    checkAuthSession: () => ({ type: 'test/session' }),
}));
vi.mock('../context/employeeDetailsSlice', () => ({ fetchEmployeeOwnInfo: () => ({ type: 'test/profile' }) }));
function Location() { return <output data-testid="path">{useLocation().pathname}</output>; }
function setup() {
    const initial = {
        user: { role: 'admin' }, permissionFlags: { isOrgOwner: true, jwtRole: 'admin' }, roleBuckets: ['org_owner', 'line_manager'], activePortal: 'admin',
        availablePortals: [
            { id: 'admin', label: 'Admin', home: '/organization/dashboard' },
            { id: 'hr_manager', label: 'HR', home: '/dashboard-hr' },
            // Reproduce a persisted portal object from before the fix.
            { id: 'employee', label: 'Me', home: '/dashboard-manager' },
        ],
    };
    const store = configureStore({ reducer: { auth: (state = initial, action) => action.type === 'test/switch' ? { ...state, activePortal: action.payload } : state } });
    render(<Provider store={store}><MemoryRouter initialEntries={['/organization/dashboard']}><PortalSwitcher /><Location /></MemoryRouter></Provider>);
    return store;
}
describe('admin navbar portal navigation', () => {
    it('opens employee dashboard from Me even with a persisted manager home', () => {
        const store = setup();
        fireEvent.click(screen.getByRole('tab', { name: 'Me', exact: true }));
        expect(screen.getByTestId('path')).toHaveTextContent('/dashboard-employee');
        expect(store.getState().auth.activePortal).toBe('employee');
        expect(screen.getByRole('tab', { name: 'Me', exact: true })).toHaveAttribute('aria-selected', 'true');
    });
    it('preserves HR and Admin dashboard targets when switching back', () => {
        setup();
        fireEvent.click(screen.getByRole('tab', { name: 'Me', exact: true }));
        fireEvent.click(screen.getByRole('tab', { name: 'HR', exact: true }));
        expect(screen.getByTestId('path')).toHaveTextContent('/dashboard-hr');
        fireEvent.click(screen.getByRole('tab', { name: 'Admin', exact: true }));
        expect(screen.getByTestId('path')).toHaveTextContent('/organization/dashboard');
    });
});
