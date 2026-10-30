import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import RecruitmentPage from './RecruitmentPage';
import axios from '../../utils/axios';
vi.mock('../../utils/axios', () => ({ default: { get: vi.fn() } }));
const currentId = '6aaa62a8fb45a608bc3b3655';
beforeEach(() => vi.clearAllMocks());
describe('Recruitment Career Portal button', () => {
    it.each(['megha', '6a3cbbacc02ff3769ba3e8c6'])('uses the server tenant with two jobs despite stale browser value %s', async stored => {
        localStorage.setItem('organizationId', stored);
        axios.get.mockImplementation(async url => ({ data: { success: true, data: url.endsWith('/career-link')
            ? { organizationId: currentId }
            : url.endsWith('/jobs') ? [{ _id: 'one', jobTitle: 'Current company role one', status: 'Open' }, { _id: 'two', jobTitle: 'Current company role two', status: 'Open' }] : [] } }));
        const store = configureStore({ reducer: () => ({ auth: { user: { _id: 'user', organizationId: currentId }, permissions: ['*'], permissionFlags: {} }, employeeDetails: { employee: null } }) });
        render(<Provider store={store}><MemoryRouter><RecruitmentPage /></MemoryRouter></Provider>);
        const link = await screen.findByRole('link', { name: 'Career Portal' });
        expect(link).toHaveAttribute('href', `/careers/${currentId}`);
        await screen.findByText('Current company role one');
        await screen.findByText('Current company role two');
        localStorage.clear();
    });
});
