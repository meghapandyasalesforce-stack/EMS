import { describe, expect, it, vi } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import reducer, { fetchProjectTasks } from './projectSlice';
import axios from '../utils/axios';
vi.mock('../utils/axios', () => ({ default: { get: vi.fn() } }));
vi.mock('react-toastify', () => ({ toast: { error: vi.fn() } }));

describe('project daily log refresh', () => {
  it('keeps the latest response when an older request finishes afterwards', async () => {
    let finishOlder;
    axios.get.mockReturnValueOnce(new Promise(resolve => { finishOlder = resolve; }));
    axios.get.mockResolvedValueOnce({ data: { tasks: [{ _id: 'new-log' }] } });
    const store = configureStore({ reducer });
    const older = store.dispatch(fetchProjectTasks('one'));
    await store.dispatch(fetchProjectTasks('one'));
    finishOlder({ data: { tasks: [] } });
    await older;
    expect(store.getState().projectTasks).toEqual([{ _id: 'new-log' }]);
    expect(store.getState().status).toBe('idle');
  });
});
