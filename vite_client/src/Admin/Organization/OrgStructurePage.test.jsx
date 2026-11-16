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
        fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Finance' } });
        fireEvent.change(screen.getByLabelText(/Code/), { target: { value: 'FIN' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add department' }));
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/v1/admin/org-structure/departments', { name: 'Finance', code: 'FIN' }, { withCredentials: true }));
        await waitFor(() => expect(reload).toHaveBeenCalled());
        expect(screen.getByLabelText(/Name/)).toHaveValue('');
    });

    it('switches categories and creates a team under a department', async () => {
        render(<OrgStructurePage />);
        fireEvent.click(screen.getByRole('button', { name: /^Teams/ }));
        expect(screen.getByText('No teams yet')).toBeInTheDocument();
        fireEvent.change(screen.getByLabelText('Department'), { target: { value: 'engineering' } });
        fireEvent.change(screen.getByLabelText(/Name/), { target: { value: 'Platform' } });
        fireEvent.click(screen.getByRole('button', { name: 'Add team' }));
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/v1/admin/org-structure/teams', { name: 'Platform', code: undefined, departmentId: 'engineering' }, { withCredentials: true }));
    });

    it('initializes the catalog from the empty state and deactivates existing entries', async () => {
        render(<OrgStructurePage />);
        vi.spyOn(window, 'confirm').mockReturnValue(true);
        fireEvent.click(screen.getByRole('button', { name: 'Deactivate Engineering' }));
        await waitFor(() => expect(axios.delete).toHaveBeenCalledWith('/v1/admin/org-structure/departments/engineering', { withCredentials: true }));
        fireEvent.click(screen.getByRole('button', { name: /^Work Modes/ }));
        fireEvent.click(screen.getByRole('button', { name: /Start with defaults/ }));
        await waitFor(() => expect(axios.post).toHaveBeenCalledWith('/v1/admin/org-structure/seed', {}, { withCredentials: true }));
        window.confirm.mockRestore();
    });
});
