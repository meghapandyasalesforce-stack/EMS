import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import axios from '../utils/axios';
import useCareerPortalIdentifier from './useCareerPortalIdentifier';
vi.mock('../utils/axios', () => ({ default: { get: vi.fn() } }));
const currentId = '6aaa62a8fb45a608bc3b3655';
const otherId = '6a3cbbacc02ff3769ba3e8c6';
beforeEach(() => { vi.clearAllMocks(); localStorage.clear(); });
function setup() {
    const store = configureStore({ reducer: (state = { auth: { user: { _id: 'one', organizationId: currentId } } }, action) => action.type === 'user' ? { auth: { user: action.payload } } : state });
    const wrapper = ({ children }) => <Provider store={store}>{children}</Provider>;
    return { ...renderHook(() => useCareerPortalIdentifier(), { wrapper }), store };
}
describe('session-owned career links', () => {
    it.each(['megha', otherId])('ignores stale browser organization %s', async value => {
        localStorage.setItem('organizationId', value);
        axios.get.mockResolvedValue({ data: { data: { organizationId: currentId } } });
        const { result } = setup();
        expect(result.current).toBe('');
        await waitFor(() => expect(result.current).toBe(currentId));
        expect(axios.get).toHaveBeenCalledWith('/v1/admin/recruitment/career-link', { withCredentials: true });
    });
    it('does not use browser data when the server request fails', async () => {
        localStorage.setItem('organizationId', otherId);
        axios.get.mockRejectedValue(new Error('Offline'));
        const { result } = setup();
        await act(async () => {});
        expect(result.current).toBe('');
    });
    it('discards a delayed link after changing authenticated organization', async () => {
        let finishOld;
        axios.get.mockImplementationOnce(() => new Promise(resolve => { finishOld = resolve; }))
            .mockResolvedValueOnce({ data: { data: { organizationId: otherId } } });
        const { result, store } = setup();
        act(() => store.dispatch({ type: 'user', payload: { _id: 'two', organizationId: otherId } }));
        await waitFor(() => expect(result.current).toBe(otherId));
        await act(async () => finishOld({ data: { data: { organizationId: currentId } } }));
        expect(result.current).toBe(otherId);
    });
    it('rejects a name returned instead of an organization ID', async () => {
        axios.get.mockResolvedValue({ data: { data: { organizationId: 'megha' } } });
        const { result } = setup();
        await act(async () => {});
        expect(result.current).toBe('');
    });
});
