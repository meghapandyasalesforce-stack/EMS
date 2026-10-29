import React from 'react';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';
import { render, screen, within, waitFor, fireEvent, act } from '@testing-library/react';
import SentAnnouncements from './SentAnnouncements';
import axios from '../utils/axios';

vi.mock('../utils/axios', () => ({ default: { get: vi.fn(), delete: vi.fn(), post: vi.fn() } }));
let row;
const createInteractions = () => ({
  click: async element => { await act(async () => { fireEvent.mouseDown(element); fireEvent.mouseUp(element); fireEvent.click(element); }); },
  keyboard: async () => { await act(async () => { fireEvent.keyDown(document.activeElement, { key: 'Escape' }); }); },
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
  row = { _id: 'notice1', metadata: { title: 'Company notice' }, message: 'Announcement body', broadcastStatus: 'sent', createdAt: '2026-10-29' };
  axios.get.mockImplementation(async url => ({ data: url.endsWith('/receipts')
    ? { success: true, data: { seenCount: 1, notSeenCount: 2, seen: [], notSeen: [] } }
    : { success: true, announcements: [row], pagination: { current: 1, pages: 1, total: 1 } } }));
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

async function openActions() {
  const user = createInteractions();
  render(<SentAnnouncements />);
  const trigger = await screen.findByRole('button', { name: 'Row actions' });
  await user.click(trigger);
  return { user, trigger, dialog: await screen.findByRole('dialog', { name: 'Announcement actions' }) };
}

describe('Announcement row actions popup', () => {
  it('opens outside the table, contains the original sent actions, and closes with Escape', async () => {
    const { user, trigger, dialog } = await openActions();
    expect(dialog.closest('table')).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Read status' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(document.documentElement.style.overflow).toBe('hidden');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(trigger).toHaveFocus();
    expect(document.documentElement.style.overflow).not.toBe('hidden');
  });
  it('closes through the close button', async () => {
    const { user, dialog } = await openActions();
    await user.click(within(dialog).getByRole('button', { name: 'Close actions' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('opens the existing read-status popup for the selected announcement', async () => {
    const { user, dialog } = await openActions();
    await user.click(within(dialog).getByRole('button', { name: 'Read status' }));
    expect(await screen.findByRole('dialog', { name: 'Company notice' })).toBeInTheDocument();
    expect(screen.queryByRole('dialog', { name: 'Announcement actions' })).not.toBeInTheDocument();
  });
  it('preserves delete confirmation and does not delete when cancelled', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    const { user, dialog } = await openActions();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(window.confirm).toHaveBeenCalledWith('Delete this announcement? This cannot be undone.');
    expect(axios.delete).not.toHaveBeenCalled();
  });
  it('deletes only the selected announcement after confirmation', async () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    const { user, dialog } = await openActions();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    expect(axios.delete).toHaveBeenCalledWith(expect.stringContaining('/sent-announcements/notice1'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('preserves publishing a scheduled announcement', async () => {
    row.broadcastStatus = 'scheduled';
    const { user, dialog } = await openActions();
    await user.click(within(dialog).getByRole('button', { name: 'Send now' }));
    expect(axios.post).toHaveBeenCalledWith(expect.stringContaining('/sent-announcements/notice1/publish'));
  });
  it('preserves draft editing', async () => {
    row.broadcastStatus = 'draft';
    const onEditDraft = vi.fn();
    const user = createInteractions();
    render(<SentAnnouncements onEditDraft={onEditDraft} />);
    await user.click(await screen.findByRole('button', { name: 'Row actions' }));
    const dialog = await screen.findByRole('dialog', { name: 'Announcement actions' });
    expect(within(dialog).queryByRole('button', { name: 'Read status' })).not.toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Send now' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Edit' }));
    expect(onEditDraft).toHaveBeenCalledWith(row);
  });
});
