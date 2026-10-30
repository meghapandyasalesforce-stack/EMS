import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import axios from '../utils/axios';
import useCareerPortalIdentifier from './useCareerPortalIdentifier';
vi.mock('../utils/axios', () => ({ default: { post: vi.fn() } }));
beforeEach(() => vi.clearAllMocks());
describe('readable career link generation', () => {
    it('uses the company slug returned by the authenticated endpoint', async () => {
        axios.post.mockResolvedValue({ data: { data: { slug: 'paarsiv-technologies' } } });
        const { result } = renderHook(() => useCareerPortalIdentifier('company-id'));
        await waitFor(() => expect(result.current).toBe('paarsiv-technologies'));
        expect(axios.post).toHaveBeenCalledWith('/v1/admin/recruitment/career-link', {}, { withCredentials: true });
    });
    it('retains ID links if the new endpoint is unavailable', async () => {
        axios.post.mockRejectedValue(new Error('Not deployed'));
        const { result } = renderHook(() => useCareerPortalIdentifier({ _id: 'company-id' }));
        await act(async () => {});
        expect(result.current).toBe('company-id');
    });
    it('does not reuse a prior company link when the tenant changes', async () => {
        let finishFirst;
        let finishSecond;
        axios.post.mockImplementationOnce(() => new Promise(resolve => { finishFirst = resolve; }))
            .mockImplementationOnce(() => new Promise(resolve => { finishSecond = resolve; }));
        const { result, rerender } = renderHook(({ id }) => useCareerPortalIdentifier(id), { initialProps: { id: 'one' } });
        rerender({ id: 'two' });
        expect(result.current).toBe('two');
        await act(async () => finishSecond({ data: { data: { slug: 'second-company' } } }));
        await act(async () => finishFirst({ data: { data: { slug: 'first-company' } } }));
        expect(result.current).toBe('second-company');
    });
});
