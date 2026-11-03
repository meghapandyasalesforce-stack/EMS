import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AddEmployee from './AddEmployee';

const { dispatch, create, catalog } = vi.hoisted(() => ({
    dispatch: vi.fn(async () => ({ type: 'employees/createEmployee/fulfilled', payload: { employee: { _id: 'new-employee' } } })),
    create: Object.assign(vi.fn((payload) => payload), { fulfilled: { match: () => true } }),
    catalog: {
        departments: [{ _id: 'dept', name: 'Engineering' }], teams: [],
        jobRoles: [{ _id: 'job', name: 'Developer' }], designations: [{ _id: 'title', name: 'Engineer' }],
        locations: [], employmentTypes: [], workModes: [],
    },
}));
vi.mock('react-redux', () => ({
    useDispatch: () => dispatch,
    useSelector: (select) => select({ employees: { status: 'idle' }, auth: { user: { role: 'hr' } }, employeeDetails: {} }),
}));
vi.mock('@tanstack/react-query', () => ({ useQueryClient: () => ({ invalidateQueries: vi.fn() }) }));
vi.mock('../../context/employeeSlice', () => ({ createEmployee: create }));
vi.mock('../../Hooks/useAuthPermissions', () => ({ default: () => ({ isHrManager: true, hasPermission: () => true }) }));
vi.mock('../../Hooks/useOrgStructureCatalog', () => ({ default: () => ({ catalog, loading: false }) }));
vi.mock('../../Hooks/useSuggestedSystemRole', () => ({ default: () => ({ suggestion: { systemRoleId: 'employee', reason: 'Job details' }, loading: false }) }));
vi.mock('../../utils/axios', () => ({ default: { get: vi.fn(async () => ({ data: { data: [], catalog: [{ id: 'employee', label: 'Employee' }] } })) } }));

describe('embedded employee creation', () => {
    it('collects the complete form and creates an employee without leaving the popup', async () => {
        const onCreated = vi.fn();
        render(<MemoryRouter><AddEmployee embedded onCreated={onCreated} /></MemoryRouter>);
        fireEvent.change(screen.getByLabelText('First name *'), { target: { value: 'Alex' } });
        fireEvent.change(screen.getByLabelText('Work email *'), { target: { value: 'alex@example.com' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        for (const [placeholder, option] of [['Select department', 'Engineering'], ['Select job role', 'Developer'], ['Select designation', 'Engineer']]) {
            fireEvent.click(screen.getByRole('button', { name: placeholder }));
            fireEvent.click(screen.getByRole('option', { name: option }));
        }
        fireEvent.change(screen.getByLabelText('Date of joining'), { target: { value: '2026-11-03' } });
        // Category and salary are mandatory before additional profile details.
        fireEvent.click(screen.getByRole('button', { name: 'Select job category' }));
        fireEvent.click(screen.getByRole('option', { name: 'Engineering' }));
        fireEvent.change(document.querySelector('[name="salary"]'), { target: { value: '50000' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        await screen.findByLabelText('Primary phone');
        fireEvent.change(screen.getByLabelText('Primary phone'), { target: { value: '9876543210' } });
        fireEvent.change(screen.getByLabelText('Account number'), { target: { value: '001234567' } });
        fireEvent.change(screen.getByLabelText('Contact name'), { target: { value: 'Sam' } });
        fireEvent.click(screen.getByRole('button', { name: 'Continue' }));
        fireEvent.click(screen.getByRole('button', { name: 'Create & Provision Employee' }));
        await waitFor(() => expect(onCreated).toHaveBeenCalledWith({ _id: 'new-employee' }));
        expect(create).toHaveBeenCalledWith(expect.objectContaining({
            joiningDate: '2026-11-03', phone1: '9876543210', emergencyContactName: 'Sam',
            financialDetails: { accountNo: '001234567' },
        }));
    });
});
