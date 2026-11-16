import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrgStructurePage from './OrgStructurePage';
import useOrgStructureCatalog from '../../Hooks/useOrgStructureCatalog';
import axios from '../../utils/axios';

vi.mock('../../Hooks/useOrgStructureCatalog', () => ({ default: vi.fn() }));
vi.mock('../../utils/axios', () => ({ default: { post: vi.fn(), delete: vi.fn() } }));
vi.mock('react-toastify', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const reload = vi.fn();
const catalog = { departments: [{ _id: 'engineering', name: 'Engineering', code: 'ENG' }], teams: [], jobRoles: [], designations: [], locations: [], employmentTypes: [], workModes: [] };

beforeEach(() => {
    vi.clearAllMocks();
    useOrgStructureCatalog.mockReturnValue({ catalog, loading: false, reload });
    axios.post.mockResolvedValue({});
    axios.delete.mockResolvedValue({});
});

describe('Organization structure catalog', () => {
    it('shows existing departments and creates a department with its code', async () => {
        render(<OrgStructurePage />);
        expect(screen.getByText('Engineering')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: /^Add / }));
        fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Finance' } });
        fireEvent.change(screen.getByLabelText(/Code/), { target: { value: 'FIN' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/v1/admin/org-structure/departments', { name: 'Finance', code: 'FIN' }, { withCredentials: true }));
        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
    });

    it('switches categories and creates a team under a department', async () => {
        render(<OrgStructurePage />);
        fireEvent.click(screen.getByRole('button', { name: /^Teams/ }));
        expect(screen.getByText('No teams yet')).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
        fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'engineering' } });
        fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Platform' } });
        fireEvent.click(screen.getByRole('button', { name: 'Save' }));
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/v1/admin/org-structure/teams', { name: 'Platform', code: undefined, departmentId: 'engineering' }, { withCredentials: true }));
    });

    it.each([
        ['Departments', 'department'], ['Teams', 'team'], ['Job Roles', 'job role'],
        ['Designations', 'designation'], ['Locations', 'location'],
        ['Employment Types', 'employment type'], ['Work Modes', 'work mode'],
    ])('provides a compact add form for %s', (label, singular) => {
        render(<OrgStructurePage />);
        fireEvent.click(screen.getByRole('button', { name: new RegExp(`^${label}`) }));
        expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: `Add ${singular}` }));
        expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
        expect(screen.queryByLabelText(/Name/)).not.toBeInTheDocument();
    });

    it('filters entries and clears the search', () => {
        render(<OrgStructurePage />);
        fireEvent.change(screen.getByRole('textbox', { name: 'Search departments' }), { target: { value: 'finance' } });
        expect(screen.queryByText('Engineering')).not.toBeInTheDocument();
        expect(screen.getByText('No matching departments')).toBeInTheDocument();
        fireEvent.click(screen.getAllByRole('button', { name: 'Clear search' })[0]);
        expect(screen.getByText('Engineering')).toBeInTheDocument();
    });

    it('deactivates existing entries and offers manual creation in the empty state', async () => {
        render(<OrgStructurePage />);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        fireEvent.click(screen.getByRole('button', { name: 'Deactivate Engineering' }));
        await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/v1/admin/org-structure/departments/engineering', { withCredentials: true }));
        fireEvent.click(screen.getByRole('button', { name: /^Work Modes/ }));
        expect(screen.queryByRole('button', { name: /defaults/i })).not.toBeInTheDocument();
        expect(axios.post).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole('button', { name: 'Create work mode' }));
        expect(screen.getByLabelText(/Name/)).toBeInTheDocument();
        window.confirm.mockRestore();
    });
});
