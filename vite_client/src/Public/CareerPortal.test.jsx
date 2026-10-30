import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import CareerPortal from './CareerPortal';
import axios from '../utils/axios';
vi.mock('../utils/axios', () => ({ default: { get: vi.fn(), post: vi.fn() } }));
const job = { _id: 'job-one', jobTitle: 'Paarsiv Engineer', department: 'Engineering', location: 'Remote', employmentType: 'Full-time' };
beforeEach(() => {
    vi.clearAllMocks();
    axios.post.mockRejectedValue({ response: { status: 404 } });
});
function setup(initial = '/careers/paarsiv') {
    render(<MemoryRouter initialEntries={[initial]}><Link to="/careers/megha">Other portal</Link><Link to="/careers/paarsiv">Company portal</Link><Routes><Route path="/careers/:organizationId" element={<CareerPortal />} /></Routes></MemoryRouter>);
}
describe('career portal organization navigation', () => {
    it('uses the URL identifier and removes old jobs and errors when changing portals', async () => {
        axios.get.mockImplementation(url => url.endsWith('/paarsiv/jobs')
            ? Promise.resolve({ data: { data: [job] } }) : Promise.reject({ response: { status: 404 } }));
        setup();
        await screen.findByText(job.jobTitle);
        fireEvent.click(screen.getByRole('link', { name: 'Other portal' }));
        await screen.findByText('Career portal not found');
        expect(screen.queryByText(job.jobTitle)).not.toBeInTheDocument();
        expect(axios.get).toHaveBeenLastCalledWith('/v1/public/recruitment/megha/jobs');
        fireEvent.click(screen.getByRole('link', { name: 'Company portal' }));
        await screen.findByText(job.jobTitle);
        expect(screen.queryByText('Career portal not found')).not.toBeInTheDocument();
    });
    it('ignores a delayed response from the previous portal', async () => {
        let resolveOld;
        axios.get.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }))
            .mockResolvedValueOnce({ data: { data: [job] } });
        setup('/careers/megha');
        fireEvent.click(screen.getByRole('link', { name: 'Company portal' }));
        await screen.findByText(job.jobTitle);
        resolveOld({ data: { data: [{ ...job, jobTitle: 'Previous tenant job' }] } });
        await waitFor(() => expect(screen.queryByText('Previous tenant job')).not.toBeInTheDocument());
        expect(screen.getByText(job.jobTitle)).toBeInTheDocument();
    });
});
