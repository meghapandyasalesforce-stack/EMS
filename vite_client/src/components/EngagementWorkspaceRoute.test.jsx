import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter, Routes, Route, useLocation } from 'react-router-dom';
import { hrRoutes, renderProtectedRoutes } from '../routes';
import SurveyDetailPage from '../HR/Engagement/SurveyDetailPage';
import axios from '../utils/axios';
vi.mock('../utils/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const id = 'survey-one';
const employee = { _id: 'employee-one', role: 'employee' };
const personal = { user: employee, permissions: ['engagement.survey.take'], activePortal: 'employee' };
const hr = { user: { role: 'employee' }, permissions: ['engagement.manage'], activePortal: 'hr_manager', permissionFlags: { isHrManager: true } };
const ownerMe = { user: { role: 'admin' }, permissions: ['*'], activePortal: 'employee', permissionFlags: { isOrgOwner: true } };
const managementRoutes = hrRoutes.filter(r => r.engagementAccess).map(r => ({ ...r, component: () => <p>HR workspace rendered</p> }));
function Location() { const l = useLocation(); return <output data-testid="path">{l.pathname}</output>; }
function setup(auth, path, detail = false) {
    const store = configureStore({ reducer: () => ({ auth: { authChecked: true, permissionFlags: {}, ...auth }, employeeDetails: { employee } }) });
    return render(<Provider store={store}><MemoryRouter initialEntries={[path]}><Routes>
        {detail ? <><Route path="/engagement/surveys/:surveyId" element={<SurveyDetailPage />} /><Route path="/employee/engagement/surveys/:surveyId" element={<SurveyDetailPage />} /></> : renderProtectedRoutes(managementRoutes)}
        <Route path="/employee/engagement" element={<p>Personal engagement</p>} />
        {detail && <Route path="/engagement" element={<p>HR engagement</p>} />}
    </Routes><Location /></MemoryRouter></Provider>);
}
describe('engagement workspace isolation', () => {
    it.each(['/engagement', '/engagement/create-survey', '/engagement/surveys/one/edit', '/engagement/pulse/create', '/engagement/pulse/one', '/engagement/pulse/one/edit'])('redirects employees away from direct HR URL %s', async path => {
        setup(personal, path);
        await screen.findByText('Personal engagement');
        expect(screen.queryByText('HR workspace rendered')).not.toBeInTheDocument();
        expect(screen.getByTestId('path')).toHaveTextContent('/employee/engagement');
    });
    it.each(['/engagement', '/engagement/create-survey'])('keeps an org owner under ME out of HR URL %s', async path => {
        setup(ownerMe, path);
        await screen.findByText('Personal engagement');
        expect(screen.queryByText('HR workspace rendered')).not.toBeInTheDocument();
    });
    it.each(['/engagement', '/engagement/create-survey', '/engagement/surveys/one/edit'])('retains authorized HR access to %s', async path => {
        setup(hr, path);
        await screen.findByText('HR workspace rendered');
    });
    it('does not treat analytics access as permission to create surveys', async () => {
        setup({ ...hr, permissionFlags: {}, permissions: ['engagement.analytics.team'] }, '/engagement/create-survey');
        await screen.findByText('Personal engagement');
    });
});
const survey = { _id: id, title: 'My assigned survey', status: 'Active', startDate: '2020-01-01', endDate: '2099-01-01', questions: [{ _id: 'q1', question: 'Your feedback', type: 'Text', required: true }] };
function mockSurvey(found = true) {
    axios.get.mockImplementation(async url => ({ data: { data: url.endsWith('/analytics') ? { overview: { available: false } } : url.endsWith('/responses') ? [] : found ? survey : null } }));
}
describe('survey return navigation', () => {
    it.each([['legacy employee link', personal, `/engagement/surveys/${id}`], ['personal employee link', personal, `/employee/engagement/surveys/${id}`], ['owner in ME', ownerMe, `/engagement/surveys/${id}`], ['HR visiting a personal link', hr, `/employee/engagement/surveys/${id}`]])('returns %s to employee engagement without HR controls', async (_name, auth, path) => {
        mockSurvey(); setup(auth, path, true);
        await screen.findByRole('heading', { name: survey.title });
        expect(screen.queryByRole('button', { name: 'Edit Survey', exact: true })).not.toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Survey Analytics' })).not.toBeInTheDocument();
        fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
        await screen.findByText('Personal engagement');
    });
    it('returns HR survey management to the HR workspace', async () => {
        mockSurvey(); setup(hr, `/engagement/surveys/${id}`, true);
        await screen.findByRole('button', { name: 'Edit Survey', exact: true });
        fireEvent.click(screen.getByRole('button', { name: 'Back', exact: true }));
        await screen.findByText('HR engagement');
    });
    it('keeps the employee not-found Back button in the personal workspace', async () => {
        mockSurvey(false); setup(personal, `/engagement/surveys/${id}`, true);
        await screen.findByText('Survey not found');
        fireEvent.click(screen.getByRole('button', { name: 'Back to Engagement', exact: true }));
        await screen.findByText('Personal engagement');
    });
});
