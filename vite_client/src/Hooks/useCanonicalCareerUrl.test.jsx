import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import axios from '../utils/axios';
import useCanonicalCareerUrl from './useCanonicalCareerUrl';
vi.mock('../utils/axios', () => ({ default: { post: vi.fn() } }));
const id = '6aaa62a8fb45a608bc3b3655';
function Preview() {
    const location = useLocation();
    useCanonicalCareerUrl(location.pathname.split('/')[2]);
    return <output data-testid="path">{location.pathname}{location.search}{location.hash}</output>;
}
beforeEach(() => vi.clearAllMocks());
describe('automatic readable careers addresses', () => {
    it.each([['', ''], ['/jobs/job-one?ref=email#apply', '/jobs/job-one?ref=email#apply']])('replaces legacy IDs and preserves %s', async (suffix, expected) => {
        axios.post.mockResolvedValue({ data: { data: { slug: 'paarsiv-technologies' } } });
        render(<MemoryRouter initialEntries={[`/careers/${id}${suffix}`]}><Preview /></MemoryRouter>);
        await waitFor(() => expect(screen.getByTestId('path')).toHaveTextContent(`/careers/paarsiv-technologies${expected}`));
        expect(axios.post).toHaveBeenCalledTimes(1);
    });
    it('keeps the original link usable when initialization fails', async () => {
        axios.post.mockRejectedValue(new Error('Offline'));
        render(<MemoryRouter initialEntries={[`/careers/${id}`]}><Preview /></MemoryRouter>);
        await waitFor(() => expect(axios.post).toHaveBeenCalledTimes(1));
        expect(screen.getByTestId('path')).toHaveTextContent(`/careers/${id}`);
    });
    it('does not request a redirect for an already readable address', () => {
        render(<MemoryRouter initialEntries={['/careers/paarsiv']}><Preview /></MemoryRouter>);
        expect(axios.post).not.toHaveBeenCalled();
    });
});
