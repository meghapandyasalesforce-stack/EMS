import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import axios from '../utils/axios';
import useCareerPortalIdentifier from './useCareerPortalIdentifier';
vi.mock('../utils/axios', () => ({ default: { post: vi.fn() } }));
const id = '6a3cbbacc02ff3769ba3e8c6';
describe('organization ID career links', () => {
    it.each([id, { _id: id }, { id }])('uses the organization ID without requesting a name', value => {
        const { result } = renderHook(() => useCareerPortalIdentifier(value));
        expect(result.current).toBe(id);
        expect(axios.post).not.toHaveBeenCalled();
    });
    it('updates immediately when the organization changes', () => {
        const { result, rerender } = renderHook(({ value }) => useCareerPortalIdentifier(value), { initialProps: { value: id } });
        rerender({ value: '6aaa62a8fb45a608bc3b3655' });
        expect(result.current).toBe('6aaa62a8fb45a608bc3b3655');
    });
    it.each([null, undefined, ''])('does not generate a link without an organization ID', value => {
        const { result } = renderHook(() => useCareerPortalIdentifier(value));
        expect(result.current).toBe('');
    });
});
