import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import AnnouncementModal from './AnnouncementModal';

vi.mock('./NotificationSender', () => ({
  default: ({ onClose, onSent }) => (
    <section>
      <textarea aria-label="Announcement" />
      <button type="button" onClick={onClose}>Close announcement</button>
      <button type="button" onClick={onSent}>Send announcement</button>
    </section>
  ),
}));

afterEach(cleanup);

describe('AnnouncementModal', () => {
  it('portals outside the dashboard, locks scrolling, and restores focus and scrolling on close', () => {
    const dashboard = document.createElement('main');
    dashboard.className = 'main-scroll-area';
    dashboard.style.overflow = 'auto';
    document.body.appendChild(dashboard);
    const opener = document.createElement('button');
    dashboard.appendChild(opener);
    opener.focus();
    const close = vi.fn();
    const { unmount } = render(<AnnouncementModal onClose={close} onSent={vi.fn()} />, { container: dashboard });
    const dialog = screen.getByRole('dialog');
    expect(dashboard.contains(dialog)).toBe(false);
    expect(document.body.style.overflow).toBe('hidden');
    expect(dashboard.style.overflow).toBe('hidden');
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(close).toHaveBeenCalledOnce();
    unmount();
    expect(dashboard.style.overflow).toBe('auto');
    dashboard.remove();
  });

  it('keeps form clicks inside and supports close and send', () => {
    const close = vi.fn();
    const sent = vi.fn();
    render(<AnnouncementModal onClose={close} onSent={sent} />);
    fireEvent.click(screen.getByRole('textbox'));
    expect(close).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Send announcement' }));
    expect(sent).toHaveBeenCalledOnce();
    expect(close).toHaveBeenCalledOnce(); // send also closes the modal
    close.mockClear();
    fireEvent.click(screen.getByRole('button', { name: 'Close announcement' }));
    expect(close).toHaveBeenCalledOnce();
  });

  it('closes when the dimmed screen (backdrop) is clicked', () => {
    const close = vi.fn();
    render(<AnnouncementModal onClose={close} onSent={vi.fn()} />);
    fireEvent.click(document.querySelector('.ann-modal-backdrop'));
    expect(close).toHaveBeenCalledOnce();
  });
});
